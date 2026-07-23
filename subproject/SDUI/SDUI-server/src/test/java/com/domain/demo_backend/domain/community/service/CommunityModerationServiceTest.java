package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.*;
import com.domain.demo_backend.domain.community.dto.ModerationTransitionRequest;
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
class CommunityModerationServiceTest {

    @Mock CommunityPostRepository postRepository;
    @Mock PostCommentRepository commentRepository;
    @Mock PostReportRepository reportRepository;
    @Mock CommunityModerationAuditRepository auditRepository;
    @Mock UserRepository userRepository;
    @InjectMocks CommunityModerationService service;

    private User author;
    private User admin;
    private CommunityPost post;

    @BeforeEach
    void setUp() {
        author = User.builder().userSqno(7L).userId("fan").nickname("Fan").role("ROLE_USER").build();
        admin = User.builder().userSqno(99L).userId("admin").role("ROLE_ADMIN").build();
        post = CommunityPost.builder()
                .postId(11L)
                .author(author)
                .title("Route")
                .content("Content")
                .moderationStatus(ContentModerationStatus.PENDING)
                .moderationDueAt(LocalDateTime.now().plusHours(24))
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void approvePost_recordsActorAndAudit() {
        when(postRepository.findByIdForModeration(11L)).thenReturn(Optional.of(post));
        when(userRepository.findById(99L)).thenReturn(Optional.of(admin));

        service.moderatePost(11L, 99L, transition("APPROVED", "Evidence checked"));

        assertThat(post.getModerationStatus()).isEqualTo(ContentModerationStatus.APPROVED);
        assertThat(post.getModeratedBy()).isEqualTo(admin);
        ArgumentCaptor<CommunityModerationAudit> captor =
                ArgumentCaptor.forClass(CommunityModerationAudit.class);
        verify(auditRepository).save(captor.capture());
        assertThat(captor.getValue().getTargetType()).isEqualTo("COMMUNITY_POST");
        assertThat(captor.getValue().getFromStatus()).isEqualTo("PENDING");
        assertThat(captor.getValue().getToStatus()).isEqualTo("APPROVED");
        assertThat(captor.getValue().getAdminActor()).isEqualTo(admin);
        assertThat(captor.getValue().getNote()).isEqualTo("Evidence checked");
    }

    @Test
    void rejectPost_requiresNote() {
        when(postRepository.findByIdForModeration(11L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> service.moderatePost(11L, 99L, transition("REJECTED", null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("note");
        verifyNoInteractions(userRepository, auditRepository);
    }

    @Test
    void approvedPost_cannotReturnToPending() {
        post.setModerationStatus(ContentModerationStatus.APPROVED);
        when(postRepository.findByIdForModeration(11L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> service.moderatePost(11L, 99L, transition("PENDING", null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PENDING");
    }

    @Test
    void report_transitionsOpenReviewingResolved_withAudit() {
        PostReport report = report(PostReportStatus.OPEN);
        when(reportRepository.findByIdForModeration(31L)).thenReturn(Optional.of(report));
        when(userRepository.findById(99L)).thenReturn(Optional.of(admin));

        service.transitionReport(31L, 99L, transition("REVIEWING", "Assigned"));
        assertThat(report.getStatus()).isEqualTo(PostReportStatus.REVIEWING);
        assertThat(report.getAssignedAdmin()).isEqualTo(admin);

        service.transitionReport(31L, 99L, transition("RESOLVED", "Removed violating content"));
        assertThat(report.getStatus()).isEqualTo(PostReportStatus.RESOLVED);
        assertThat(report.getResolvedAt()).isNotNull();
        assertThat(report.getResolutionNote()).isEqualTo("Removed violating content");
        verify(auditRepository, times(2)).save(any());
    }

    @Test
    void report_cannotSkipReviewing() {
        PostReport report = report(PostReportStatus.OPEN);
        when(reportRepository.findByIdForModeration(31L)).thenReturn(Optional.of(report));

        assertThatThrownBy(() -> service.transitionReport(
                31L, 99L, transition("RESOLVED", "Done")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("OPEN -> REVIEWING");
        verifyNoInteractions(userRepository, auditRepository);
    }

    @Test
    void nonAdminActor_isRejectedEvenIfSecurityLayerIsBypassed() {
        when(postRepository.findByIdForModeration(11L)).thenReturn(Optional.of(post));
        when(userRepository.findById(7L)).thenReturn(Optional.of(author));

        assertThatThrownBy(() -> service.moderatePost(
                11L, 7L, transition("APPROVED", null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ROLE_ADMIN");
        verifyNoInteractions(auditRepository);
    }

    private PostReport report(PostReportStatus status) {
        return PostReport.builder()
                .postReportId(31L)
                .post(post)
                .reporter(author)
                .reasonCode("SPAM")
                .status(status)
                .reviewDueAt(LocalDateTime.now().plusHours(24))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private ModerationTransitionRequest transition(String status, String note) {
        ModerationTransitionRequest request = new ModerationTransitionRequest();
        request.setStatus(status);
        request.setNote(note);
        return request;
    }
}
