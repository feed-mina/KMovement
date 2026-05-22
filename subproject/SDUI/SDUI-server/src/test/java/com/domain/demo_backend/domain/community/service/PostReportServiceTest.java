package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.CommunityPost;
import com.domain.demo_backend.domain.community.domain.CommunityPostRepository;
import com.domain.demo_backend.domain.community.domain.PostReport;
import com.domain.demo_backend.domain.community.domain.PostReportRepository;
import com.domain.demo_backend.domain.community.dto.ReportRequest;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PostReportService community unit tests")
class PostReportServiceTest {

    @Mock
    private PostReportRepository reportRepository;

    @Mock
    private CommunityPostRepository postRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private PostReportService reportService;

    private CommunityPost post;
    private User reporter;

    @BeforeEach
    void setUp() {
        post = CommunityPost.builder()
                .postId(101L)
                .title("Seoul concert route")
                .reportCount(0L)
                .build();
        reporter = User.builder()
                .userSqno(7L)
                .userId("traveler")
                .role("ROLE_USER")
                .build();
    }

    @Test
    @DisplayName("reportPost saves a report and increments report count")
    void reportPost_savesReportAndIncrementsCount() {
        ReportRequest request = new ReportRequest();
        request.setReasonCode("SPAM");
        request.setDetailText("Repeated promotional content");

        when(reportRepository.existsByPost_PostIdAndReporter_UserSqno(101L, 7L))
                .thenReturn(false);
        when(postRepository.findById(101L)).thenReturn(Optional.of(post));
        when(userRepository.findById(7L)).thenReturn(Optional.of(reporter));

        reportService.reportPost(101L, 7L, request);

        ArgumentCaptor<PostReport> reportCaptor = ArgumentCaptor.forClass(PostReport.class);
        verify(reportRepository).save(reportCaptor.capture());

        PostReport savedReport = reportCaptor.getValue();
        assertThat(savedReport.getPost()).isEqualTo(post);
        assertThat(savedReport.getReporter()).isEqualTo(reporter);
        assertThat(savedReport.getReasonCode()).isEqualTo("SPAM");
        assertThat(savedReport.getDetailText()).isEqualTo("Repeated promotional content");
        assertThat(post.getReportCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("reportPost rejects duplicate reports from the same user")
    void reportPost_duplicateReportThrowsException() {
        ReportRequest request = new ReportRequest();
        request.setReasonCode("SPAM");

        when(reportRepository.existsByPost_PostIdAndReporter_UserSqno(101L, 7L))
                .thenReturn(true);

        assertThatThrownBy(() -> reportService.reportPost(101L, 7L, request))
                .isInstanceOf(IllegalArgumentException.class);

        verify(reportRepository, never()).save(org.mockito.ArgumentMatchers.any(PostReport.class));
        assertThat(post.getReportCount()).isEqualTo(0L);
    }
}
