package com.domain.demo_backend.domain.tour.dto;

import com.domain.demo_backend.domain.tour.domain.TourPoi;

import java.time.LocalDateTime;

/**
 * 성지 검수 큐 항목 DTO — 어드민 검수 화면용(poiSqno·상태·출처 포함).
 * Epic #74 · Dev-4(#96-A) 2차.
 */
public record HolyReviewItemDto(
        Long poiSqno,
        String contentId,
        String title,
        String addr,
        Double mapX,
        Double mapY,
        String source,
        String artist,
        String fandomInfo,
        String recommendReason,
        String sourceUrl,
        String reviewStatus,
        String reviewedBy,
        LocalDateTime reviewedAt,
        LocalDateTime createdAt
) {
    public static HolyReviewItemDto from(TourPoi p) {
        return new HolyReviewItemDto(
                p.getPoiSqno(),
                p.getContentId(),
                p.getTitle(),
                p.getAddr(),
                p.getMapX(),
                p.getMapY(),
                p.getSource(),
                p.getArtist(),
                p.getFandomInfo(),
                p.getRecommendReason(),
                p.getSourceUrl(),
                p.getReviewStatus(),
                p.getReviewedBy(),
                p.getReviewedAt(),
                p.getCreatedAt()
        );
    }
}
