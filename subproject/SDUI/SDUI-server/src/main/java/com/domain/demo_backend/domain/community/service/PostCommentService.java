package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.CommunityPost;
import com.domain.demo_backend.domain.community.domain.CommunityPostRepository;
import com.domain.demo_backend.domain.community.domain.ContentModerationStatus;
import com.domain.demo_backend.domain.community.domain.PostComment;
import com.domain.demo_backend.domain.community.domain.PostCommentRepository;
import com.domain.demo_backend.domain.community.dto.CommentRequest;
import com.domain.demo_backend.domain.community.dto.CommentResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class PostCommentService {

    private final PostCommentRepository commentRepository;
    private final CommunityPostRepository postRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<CommentResponse> getApprovedComments(Long postId, int page, int size) {
        requireApprovedPost(postId);
        return commentRepository
                .findByPost_PostIdAndModerationStatusAndDelYnOrderByCreatedAtAsc(
                        postId,
                        ContentModerationStatus.APPROVED,
                        "N",
                        PageRequest.of(Math.max(0, page), normalizeSize(size)))
                .map(CommentResponse::from);
    }

    @Transactional
    public CommentResponse createComment(Long postId, Long authorSqno, CommentRequest request) {
        CommunityPost post = requireApprovedPost(postId);
        User author = userRepository.findById(authorSqno)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));
        LocalDateTime now = LocalDateTime.now();
        PostComment comment = PostComment.builder()
                .post(post)
                .author(author)
                .content(request.getContent().trim())
                .moderationStatus(ContentModerationStatus.PENDING)
                .moderationDueAt(now.plusHours(24))
                .createdAt(now)
                .updatedAt(now)
                .build();
        return CommentResponse.from(commentRepository.save(comment));
    }

    @Transactional
    public CommentResponse updateComment(
            Long postId, Long commentId, Long authorSqno, CommentRequest request) {
        PostComment comment = requireOwnedComment(postId, commentId, authorSqno);
        comment.setContent(request.getContent().trim());
        comment.setModerationStatus(ContentModerationStatus.PENDING);
        comment.setModeratedBy(null);
        comment.setModeratedAt(null);
        comment.setModerationNote(null);
        comment.setModerationDueAt(LocalDateTime.now().plusHours(24));
        return CommentResponse.from(comment);
    }

    @Transactional
    public void deleteComment(Long postId, Long commentId, Long authorSqno) {
        PostComment comment = requireOwnedComment(postId, commentId, authorSqno);
        comment.setDelYn("Y");
    }

    private CommunityPost requireApprovedPost(Long postId) {
        return postRepository.findApprovedByPostIdWithDetails(postId)
                .orElseThrow(() -> new IllegalArgumentException("Published post not found."));
    }

    private PostComment requireOwnedComment(Long postId, Long commentId, Long authorSqno) {
        PostComment comment = commentRepository.findVisibleByIdWithDetails(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found."));
        if (!comment.getPost().getPostId().equals(postId)) {
            throw new IllegalArgumentException("Comment does not belong to this post.");
        }
        if (!comment.getAuthor().getUserSqno().equals(authorSqno)) {
            throw new IllegalArgumentException("Only the comment author can modify it.");
        }
        return comment;
    }

    private int normalizeSize(int size) {
        return Math.min(100, Math.max(1, size));
    }
}
