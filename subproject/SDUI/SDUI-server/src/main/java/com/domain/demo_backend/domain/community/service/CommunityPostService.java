package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.*;
import com.domain.demo_backend.domain.community.dto.*;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityPostService {

    private final CommunityPostRepository postRepository;
    private final PostImageRepository imageRepository;
    private final UserRepository userRepository;
    private final SupabaseStorageService storageService;

    private static final int MAX_IMAGES = 10;

    @Transactional
    public PostResponse createPost(Long userSqno, PostCreateRequest request, List<MultipartFile> images) {
        List<MultipartFile> files = images == null ? List.of() : images;
        long validCount = files.stream().filter(f -> !f.isEmpty()).count();
        if (validCount > MAX_IMAGES) {
            throw new IllegalArgumentException("이미지는 최대 " + MAX_IMAGES + "장까지 가능합니다.");
        }

        User author = userRepository.findById(userSqno)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        CommunityPost post = CommunityPost.builder()
                .author(author)
                .title(request.getTitle())
                .content(request.getContent())
                .build();

        postRepository.save(post);

        int sortOrder = 1;
        int failCount = 0;
        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;
            try {
                String publicUrl = storageService.upload(file, post.getPostId());
                PostImage postImage = PostImage.builder()
                        .post(post)
                        .storageUrl(publicUrl)
                        .originalName(file.getOriginalFilename())
                        .storedName(storageService.getStoredName(publicUrl))
                        .mimeType(file.getContentType())
                        .fileSize(file.getSize())
                        .sortOrder(sortOrder++)
                        .build();
                imageRepository.save(postImage);
                post.getImages().add(postImage);
            } catch (IOException e) {
                log.error("이미지 업로드 실패: {}", e.getMessage());
                failCount++;
            }
        }
        if (failCount > 0 && post.getImages().isEmpty()) {
            throw new RuntimeException("모든 이미지 업로드에 실패했습니다. 서버 설정을 확인해주세요.");
        }

        return PostResponse.from(post);
    }

    @Transactional(readOnly = true)
    public Page<PostListResponse> getPostList(int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)));
        return postRepository.findByDelYnAndModerationStatusOrderByCreatedAtDesc(
                        "N", ContentModerationStatus.APPROVED, pageable)
                .map(PostListResponse::from);
    }

    @Transactional(readOnly = true)
    public PostResponse getPostDetail(Long postId) {
        return getPostDetail(postId, null, false);
    }

    @Transactional(readOnly = true)
    public PostResponse getPostDetail(Long postId, Long viewerSqno, boolean admin) {
        CommunityPost post = postRepository.findByPostIdWithDetails(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        Long authorSqno = post.getAuthorSqno() != null
                ? post.getAuthorSqno()
                : post.getAuthor() == null ? null : post.getAuthor().getUserSqno();
        boolean owner = viewerSqno != null && viewerSqno.equals(authorSqno);
        if (post.getModerationStatus() != ContentModerationStatus.APPROVED && !owner && !admin) {
            throw new IllegalArgumentException("Published post not found.");
        }
        return PostResponse.from(post);
    }

    @Transactional
    public PostResponse updatePost(Long postId, Long userSqno, PostUpdateRequest request, List<MultipartFile> newImages) {
        CommunityPost post = postRepository.findByPostIdWithDetails(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));

        if (!post.getAuthorSqno().equals(userSqno)) {
            throw new IllegalArgumentException("수정 권한이 없습니다.");
        }

        if (request.getTitle() != null) {
            post.setTitle(request.getTitle());
        }
        if (request.getContent() != null) {
            post.setContent(request.getContent());
        }

        post.setModerationStatus(ContentModerationStatus.PENDING);
        post.setModeratedBy(null);
        post.setModeratedAt(null);
        post.setModerationNote(null);
        post.setModerationDueAt(LocalDateTime.now().plusHours(24));

        // 기존 이미지 중 유지할 이미지만 남기기
        if (request.getRetainedImages() != null) {
            post.getImages().removeIf(img ->
                    !request.getRetainedImages().contains(img.getStoredName()));
        }

        int retainedCount = post.getImages().size();
        long newValidCount = (newImages == null) ? 0 : newImages.stream().filter(f -> !f.isEmpty()).count();
        long totalCount = retainedCount + newValidCount;

        if (totalCount > MAX_IMAGES) {
            throw new IllegalArgumentException("이미지는 최대 " + MAX_IMAGES + "장까지 가능합니다.");
        }

        // 새 이미지 추가
        if (newImages != null && !newImages.isEmpty()) {
            int maxSort = post.getImages().stream()
                    .mapToInt(PostImage::getSortOrder)
                    .max().orElse(0);
            int failCount = 0;
            for (MultipartFile file : newImages) {
                if (file.isEmpty()) continue;
                try {
                    String publicUrl = storageService.upload(file, post.getPostId());
                    PostImage postImage = PostImage.builder()
                            .post(post)
                            .storageUrl(publicUrl)
                            .originalName(file.getOriginalFilename())
                            .storedName(storageService.getStoredName(publicUrl))
                            .mimeType(file.getContentType())
                            .fileSize(file.getSize())
                            .sortOrder(++maxSort)
                            .build();
                    post.getImages().add(postImage);
                } catch (IOException e) {
                    log.error("이미지 업로드 실패: {}", e.getMessage());
                    failCount++;
                }
            }
            if (failCount > 0 && post.getImages().size() <= retainedCount) {
                throw new RuntimeException("새 이미지 업로드에 모두 실패했습니다. 서버 설정을 확인해주세요.");
            }
        }

        return PostResponse.from(post);
    }

    @Transactional
    public void deletePost(Long postId, Long userSqno) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));

        if (!post.getAuthorSqno().equals(userSqno)) {
            throw new IllegalArgumentException("삭제 권한이 없습니다.");
        }

        post.setDelYn("Y");
    }
}
