package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.*;
import com.domain.demo_backend.domain.community.dto.*;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CommunityModerationService {

    private static final Set<ContentModerationStatus> CONTENT_DECISIONS =
            Set.of(ContentModerationStatus.APPROVED, ContentModerationStatus.REJECTED);

    private final CommunityPostRepository postRepository;
    private final PostCommentRepository commentRepository;
    private final PostReportRepository reportRepository;
    private final CommunityModerationAuditRepository auditRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<AdminCommunityPostResponse> getPosts(String status, int page, int size) {
        LocalDateTime now = LocalDateTime.now();
        return postRepository.findByModerationStatusAndDelYnOrderByModerationDueAtAscPostIdAsc(
                        parseContentStatus(status), "N", pageRequest(page, size))
                .map(post -> AdminCommunityPostResponse.from(post, now));
    }

    @Transactional(readOnly = true)
    public Page<AdminCommunityCommentResponse> getComments(String status, int page, int size) {
        LocalDateTime now = LocalDateTime.now();
        return commentRepository.findByModerationStatusAndDelYnOrderByModerationDueAtAscCommentIdAsc(
                        parseContentStatus(status), "N", pageRequest(page, size))
                .map(comment -> AdminCommunityCommentResponse.from(comment, now));
    }

    @Transactional(readOnly = true)
    public Page<AdminCommunityReportResponse> getReports(String status, int page, int size) {
        LocalDateTime now = LocalDateTime.now();
        return reportRepository.findByStatusOrderByReviewDueAtAscPostReportIdAsc(
                        parseReportStatus(status), pageRequest(page, size))
                .map(report -> AdminCommunityReportResponse.from(report, now));
    }

    @Transactional(readOnly = true)
    public Page<CommunityModerationAuditResponse> getAudit(int page, int size) {
        return auditRepository.findByTargetTypeStartingWithOrderByCreatedAtDescAuditIdDesc(
                        "COMMUNITY_", pageRequest(page, size))
                .map(CommunityModerationAuditResponse::from);
    }

    @Transactional
    public AdminCommunityPostResponse moderatePost(
            Long postId, Long adminSqno, ModerationTransitionRequest request) {
        CommunityPost post = postRepository.findByIdForModeration(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found."));
        ContentModerationStatus target = parseContentStatus(request.getStatus());
        validateContentTransition(post.getModerationStatus(), target, request.getNote());
        if (post.getModerationStatus() == target) {
            return AdminCommunityPostResponse.from(post, LocalDateTime.now());
        }
        User actor = requireAdmin(adminSqno);
        String from = post.getModerationStatus().name();
        LocalDateTime now = LocalDateTime.now();
        post.setModerationStatus(target);
        post.setModeratedBy(actor);
        post.setModeratedAt(now);
        post.setModerationNote(trimToNull(request.getNote()));
        audit("COMMUNITY_POST", postId, from, target.name(), actor, request.getNote());
        return AdminCommunityPostResponse.from(post, now);
    }

    @Transactional
    public AdminCommunityCommentResponse moderateComment(
            Long commentId, Long adminSqno, ModerationTransitionRequest request) {
        PostComment comment = commentRepository.findByIdForModeration(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found."));
        ContentModerationStatus target = parseContentStatus(request.getStatus());
        validateContentTransition(comment.getModerationStatus(), target, request.getNote());
        if (comment.getModerationStatus() == target) {
            return AdminCommunityCommentResponse.from(comment, LocalDateTime.now());
        }
        User actor = requireAdmin(adminSqno);
        String from = comment.getModerationStatus().name();
        LocalDateTime now = LocalDateTime.now();
        comment.setModerationStatus(target);
        comment.setModeratedBy(actor);
        comment.setModeratedAt(now);
        comment.setModerationNote(trimToNull(request.getNote()));
        audit("COMMUNITY_COMMENT", commentId, from, target.name(), actor, request.getNote());
        return AdminCommunityCommentResponse.from(comment, now);
    }

    @Transactional
    public AdminCommunityReportResponse transitionReport(
            Long reportId, Long adminSqno, ModerationTransitionRequest request) {
        PostReport report = reportRepository.findByIdForModeration(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Report not found."));
        PostReportStatus target = parseReportStatus(request.getStatus());
        validateReportTransition(report.getStatus(), target, request.getNote());
        if (report.getStatus() == target) {
            return AdminCommunityReportResponse.from(report, LocalDateTime.now());
        }
        User actor = requireAdmin(adminSqno);
        String from = report.getStatus().name();
        LocalDateTime now = LocalDateTime.now();
        report.setStatus(target);
        report.setAssignedAdmin(actor);
        report.setResolutionNote(trimToNull(request.getNote()));
        report.setResolvedAt(Set.of(PostReportStatus.RESOLVED, PostReportStatus.DISMISSED).contains(target)
                ? now : null);
        audit("COMMUNITY_REPORT", reportId, from, target.name(), actor, request.getNote());
        return AdminCommunityReportResponse.from(report, now);
    }

    private void validateContentTransition(
            ContentModerationStatus current, ContentModerationStatus target, String note) {
        if (current == target) return;
        if (current != ContentModerationStatus.PENDING || !CONTENT_DECISIONS.contains(target)) {
            throw new IllegalArgumentException(
                    "Content can only transition from PENDING to APPROVED or REJECTED.");
        }
        if (target == ContentModerationStatus.REJECTED && !StringUtils.hasText(note)) {
            throw new IllegalArgumentException("A rejection note is required.");
        }
    }

    private void validateReportTransition(PostReportStatus current, PostReportStatus target, String note) {
        if (current == target) return;
        boolean valid = (current == PostReportStatus.OPEN && target == PostReportStatus.REVIEWING)
                || (current == PostReportStatus.REVIEWING
                    && Set.of(PostReportStatus.RESOLVED, PostReportStatus.DISMISSED).contains(target));
        if (!valid) {
            throw new IllegalArgumentException(
                    "Reports must transition OPEN -> REVIEWING -> RESOLVED or DISMISSED.");
        }
        if (Set.of(PostReportStatus.RESOLVED, PostReportStatus.DISMISSED).contains(target)
                && !StringUtils.hasText(note)) {
            throw new IllegalArgumentException("A resolution note is required.");
        }
    }

    private void audit(String targetType, Long targetId, String from, String to, User actor, String note) {
        auditRepository.save(CommunityModerationAudit.builder()
                .targetType(targetType)
                .targetId(targetId)
                .fromStatus(from)
                .toStatus(to)
                .adminActor(actor)
                .note(trimToNull(note))
                .build());
    }

    private User requireAdmin(Long userSqno) {
        User actor = userRepository.findById(userSqno)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found."));
        if (!"ROLE_ADMIN".equals(actor.getRole())) {
            throw new IllegalArgumentException("The moderation actor must have ROLE_ADMIN.");
        }
        return actor;
    }

    private ContentModerationStatus parseContentStatus(String status) {
        try {
            return ContentModerationStatus.valueOf(normalizeStatus(status));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Unsupported content moderation status: " + status);
        }
    }

    private PostReportStatus parseReportStatus(String status) {
        try {
            return PostReportStatus.valueOf(normalizeStatus(status));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Unsupported report status: " + status);
        }
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) throw new IllegalArgumentException("Status is required.");
        return status.trim().toUpperCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private PageRequest pageRequest(int page, int size) {
        return PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)));
    }
}
