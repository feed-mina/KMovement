package com.domain.demo_backend.domain.tour.dto;

import com.domain.demo_backend.domain.tour.domain.TourPoi;

/**
 * 성지(HOLY) POI 응답 DTO — 프론트 TourPoi 인터페이스(services/tourApi.ts)와 필드 정합.
 * Epic #74 · Dev-4(#96-A).
 */
public record HolyPoiDto(
        String contentId,
        String contentTypeId,
        String title,
        String addr,
        Double mapX,
        Double mapY,
        String firstImage,
        String imageSourceUrl,
        String imageCredit,
        String tel,
        String areaCode,
        String sigunguCode,
        String artist,
        String fandomInfo,
        String recommendReason,
        String sourceUrl
) {
    public static HolyPoiDto from(TourPoi p) {
        return new HolyPoiDto(
                p.getContentId(),
                p.getContentTypeId(),
                p.getTitle(),
                p.getAddr(),
                p.getMapX(),
                p.getMapY(),
                p.getFirstImage(),
                p.getImageSourceUrl(),
                p.getImageCredit(),
                p.getTel(),
                p.getAreaCode(),
                p.getSigunguCode(),
                p.getArtist(),
                p.getFandomInfo(),
                p.getRecommendReason(),
                p.getSourceUrl()
        );
    }
}
