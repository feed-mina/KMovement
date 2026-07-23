package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.*;
import com.domain.demo_backend.domain.community.dto.*;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("CommunityPostService 단위 테스트")
class CommunityPostServiceTest {

    @Mock
    private CommunityPostRepository postRepository;
    @Mock
    private PostImageRepository imageRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private SupabaseStorageService storageService;

    @InjectMocks
    private CommunityPostService postService;

    private User testUser;
    private CommunityPost testPost;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .userSqno(1L)
                .userId("testuser")
                .nickname("테스터")
                .build();

        testPost = CommunityPost.builder()
                .postId(100L)
                .author(testUser)
                .title("테스트 게시글")
                .content("테스트 내용입니다.")
                .likeCount(0L)
                .reportCount(0L)
                .delYn("N")
                .images(new ArrayList<>())
                .build();
        testPost.setAuthorSqno(1L);
        testPost.setCreatedAt(LocalDateTime.now());
        testPost.setUpdatedAt(LocalDateTime.now());
    }

    @Test
    @DisplayName("게시글 작성 — 이미지 없이 성공")
    void createPost_withoutImages_success() {
        // Given
        PostCreateRequest request = new PostCreateRequest();
        request.setTitle("새 게시글");
        request.setContent("내용");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(postRepository.save(any(CommunityPost.class))).thenAnswer(invocation -> {
            CommunityPost saved = invocation.getArgument(0);
            saved.setPostId(100L);
            saved.setCreatedAt(LocalDateTime.now());
            saved.setUpdatedAt(LocalDateTime.now());
            return saved;
        });

        // When
        PostResponse response = postService.createPost(1L, request, null);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("새 게시글");
        verify(postRepository, times(1)).save(any(CommunityPost.class));
        verify(imageRepository, never()).save(any(PostImage.class));
    }

    @Test
    @DisplayName("게시글 작성 — 존재하지 않는 사용자")
    void createPost_userNotFound_throwsException() {
        PostCreateRequest request = new PostCreateRequest();
        request.setTitle("새 게시글");

        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.createPost(999L, request, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("사용자를 찾을 수 없습니다.");
    }

    @Test
    @DisplayName("게시글 목록 조회 — 페이징")
    void getPostList_returnsPaginatedResult() {
        // Given
        Page<CommunityPost> page = new PageImpl<>(List.of(testPost));
        when(postRepository.findByDelYnAndModerationStatusOrderByCreatedAtDesc(
                eq("N"), eq(ContentModerationStatus.APPROVED), any(Pageable.class)))
                .thenReturn(page);

        // When
        Page<PostListResponse> result = postService.getPostList(0, 10);

        // Then
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getTitle()).isEqualTo("테스트 게시글");
    }

    @Test
    @DisplayName("게시글 상세 조회 — 성공")
    void getPostDetail_success() {
        testPost.setModerationStatus(ContentModerationStatus.APPROVED);
        when(postRepository.findByPostIdWithDetails(100L)).thenReturn(Optional.of(testPost));

        PostResponse response = postService.getPostDetail(100L);

        assertThat(response.getPostId()).isEqualTo(100L);
        assertThat(response.getTitle()).isEqualTo("테스트 게시글");
    }

    @Test
    @DisplayName("게시글 상세 조회 — 존재하지 않는 게시글")
    void getPostDetail_notFound_throwsException() {
        when(postRepository.findByPostIdWithDetails(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.getPostDetail(999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("게시글을 찾을 수 없습니다.");
    }

    @Test
    @DisplayName("작성자는 검수 대기 게시글 상세를 조회할 수 있다")
    void getPostDetail_pendingOwnerCanRead() {
        testPost.setModerationStatus(ContentModerationStatus.PENDING);
        when(postRepository.findByPostIdWithDetails(100L)).thenReturn(Optional.of(testPost));

        PostResponse response = postService.getPostDetail(100L, 1L, false);

        assertThat(response.getModerationStatus()).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("다른 사용자는 검수 대기 게시글 상세를 조회할 수 없다")
    void getPostDetail_pendingNonOwnerCannotRead() {
        testPost.setModerationStatus(ContentModerationStatus.PENDING);
        when(postRepository.findByPostIdWithDetails(100L)).thenReturn(Optional.of(testPost));

        assertThatThrownBy(() -> postService.getPostDetail(100L, 2L, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Published post not found.");
    }

    @Test
    @DisplayName("게시글 수정 — 작성자 본인만 가능")
    void updatePost_notOwner_throwsException() {
        when(postRepository.findByPostIdWithDetails(100L)).thenReturn(Optional.of(testPost));

        PostUpdateRequest request = new PostUpdateRequest();
        request.setTitle("수정된 제목");

        assertThatThrownBy(() -> postService.updatePost(100L, 999L, request, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("수정 권한이 없습니다.");
    }

    @Test
    @DisplayName("게시글 수정 — 작성자 본인 성공")
    void updatePost_owner_success() {
        when(postRepository.findByPostIdWithDetails(100L)).thenReturn(Optional.of(testPost));

        PostUpdateRequest request = new PostUpdateRequest();
        request.setTitle("수정된 제목");
        request.setContent("수정된 내용");

        PostResponse response = postService.updatePost(100L, 1L, request, null);

        assertThat(response.getTitle()).isEqualTo("수정된 제목");
        assertThat(response.getContent()).isEqualTo("수정된 내용");
    }

    @Test
    @DisplayName("게시글 삭제 — soft delete 처리")
    void deletePost_softDelete_success() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(testPost));

        postService.deletePost(100L, 1L);

        assertThat(testPost.getDelYn()).isEqualTo("Y");
    }

    @Test
    @DisplayName("게시글 삭제 — 작성자 아닌 경우 예외")
    void deletePost_notOwner_throwsException() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(testPost));

        assertThatThrownBy(() -> postService.deletePost(100L, 999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("삭제 권한이 없습니다.");
    }
}
