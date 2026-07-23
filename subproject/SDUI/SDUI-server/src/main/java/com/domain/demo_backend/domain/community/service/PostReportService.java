package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.*;
import com.domain.demo_backend.domain.community.dto.ReportRequest;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PostReportService {

    private static final java.util.Set<String> REASON_CODES = java.util.Set.of(
            "SPAM", "HARASSMENT", "HATE_SPEECH", "MISINFORMATION",
            "COPYRIGHT", "PRIVACY", "OTHER");

    private final PostReportRepository reportRepository;
    private final CommunityPostRepository postRepository;
    private final UserRepository userRepository;

    @Transactional
    public void reportPost(Long postId, Long reporterSqno, ReportRequest request) {
        String reasonCode = request.getReasonCode().trim().toUpperCase(java.util.Locale.ROOT);
        if (!REASON_CODES.contains(reasonCode)) {
            throw new IllegalArgumentException("Unsupported report reason code.");
        }
        if (reportRepository.existsByPost_PostIdAndReporter_UserSqno(postId, reporterSqno)) {
            throw new IllegalArgumentException("이미 신고한 게시글입니다.");
        }

        CommunityPost post = postRepository.findApprovedByPostIdWithDetails(postId)
                .orElseThrow(() -> new IllegalArgumentException("Published post not found."));
        User reporter = userRepository.findById(reporterSqno)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        PostReport report = PostReport.builder()
                .post(post)
                .reporter(reporter)
                .reasonCode(reasonCode)
                .detailText(request.getDetailText())
                .build();

        reportRepository.save(report);
        post.setReportCount(post.getReportCount() + 1);
    }
}
