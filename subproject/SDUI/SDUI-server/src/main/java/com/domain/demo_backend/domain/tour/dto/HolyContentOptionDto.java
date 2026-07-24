package com.domain.demo_backend.domain.tour.dto;

import com.domain.demo_backend.domain.tour.domain.HolyContentRepository.HolyContentOption;

/** 작품/아티스트 필터 선택지 — 탐색 화면 자동완성 응답 한 줄. */
public record HolyContentOptionDto(
        Long contentSqno,
        String name,
        String nameEn,
        String category,
        Long poiCount
) {
    public static HolyContentOptionDto from(HolyContentOption option) {
        return new HolyContentOptionDto(
                option.getContentSqno(),
                option.getName(),
                option.getNameEn(),
                option.getCategory(),
                option.getPoiCount());
    }
}
