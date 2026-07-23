package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.*;
import com.domain.demo_backend.domain.community.dto.CommentRequest;
import com.domain.demo_backend.domain.community.dto.CommentResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostCommentServiceTest {

    @Mock PostCommentRepository commentRepository;
    @Mock CommunityPostRepository postRepository;
    @Mock UserRepository userRepository;
    @InjectMocks PostCommentService service;

    private User author;
    private CommunityPost post;

    @BeforeEach
    void setUp() {
        author = User.builder().userSqno(7L).userId("fan").nickname("Fan").build();
        post = CommunityPost.builder()
                .postId(11L)
                .author(author)
                .moderationStatus(ContentModerationStatus.APPROVED)
                .build();
    }

    @Test
    void createComment_startsPendingWithSla() {
        when(postRepository.findApprovedByPostIdWithDetails(11L)).thenReturn(Optional.of(post));
        when(userRepository.findById(7L)).thenReturn(Optional.of(author));
        when(commentRepository.save(any())).thenAnswer(invocation -> {
            PostComment comment = invocation.getArgument(0);
            comment.setCommentId(21L);
            return comment;
        });
        CommentRequest request = request("  useful route  ");

        CommentResponse response = service.createComment(11L, 7L, request);

        ArgumentCaptor<PostComment> captor = ArgumentCaptor.forClass(PostComment.class);
        verify(commentRepository).save(captor.capture());
        assertThat(captor.getValue().getContent()).isEqualTo("useful route");
        assertThat(captor.getValue().getModerationStatus()).isEqualTo(ContentModerationStatus.PENDING);
        assertThat(captor.getValue().getModerationDueAt()).isAfter(LocalDateTime.now().plusHours(23));
        assertThat(response.getCommentId()).isEqualTo(21L);
    }

    @Test
    void updateComment_requeuesApprovedCommentForModeration() {
        User admin = User.builder().userSqno(99L).role("ROLE_ADMIN").build();
        PostComment comment = comment(author);
        comment.setModerationStatus(ContentModerationStatus.APPROVED);
        comment.setModeratedBy(admin);
        comment.setModeratedAt(LocalDateTime.now());
        when(commentRepository.findVisibleByIdWithDetails(21L)).thenReturn(Optional.of(comment));

        CommentResponse response = service.updateComment(11L, 21L, 7L, request("changed"));

        assertThat(response.getModerationStatus()).isEqualTo("PENDING");
        assertThat(comment.getModeratedBy()).isNull();
        assertThat(comment.getModeratedAt()).isNull();
    }

    @Test
    void deleteComment_rejectsNonOwner() {
        PostComment comment = comment(author);
        when(commentRepository.findVisibleByIdWithDetails(21L)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> service.deleteComment(11L, 21L, 8L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("author");
        assertThat(comment.getDelYn()).isEqualTo("N");
    }

    private PostComment comment(User owner) {
        return PostComment.builder()
                .commentId(21L)
                .post(post)
                .author(owner)
                .content("original")
                .moderationStatus(ContentModerationStatus.PENDING)
                .moderationDueAt(LocalDateTime.now().plusHours(24))
                .delYn("N")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private CommentRequest request(String content) {
        CommentRequest request = new CommentRequest();
        request.setContent(content);
        return request;
    }
}
