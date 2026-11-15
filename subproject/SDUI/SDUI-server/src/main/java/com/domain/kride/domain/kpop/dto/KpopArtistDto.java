package com.domain.kride.domain.kpop.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.Map;

/** 공개 아티스트 카드. GET /api/v1/kpop/artists 의 한 줄. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KpopArtistDto(
        Long id,
        String slug,
        String nameKo,
        String nameEn,
        String profile,
        String imageUrl,
        String officialUrl,
        String instagramUrl,
        String youtubeUrl,
        String xUrl
) {
    public static KpopArtistDto fromRow(Map<String, Object> row) {
        return new KpopArtistDto(
                KpopRowValues.longValue(row, "id"),
                KpopRowValues.text(row, "slug"),
                KpopRowValues.text(row, "nameKo"),
                KpopRowValues.text(row, "nameEn"),
                KpopRowValues.text(row, "profile"),
                KpopRowValues.text(row, "imageUrl"),
                KpopRowValues.text(row, "officialUrl"),
                KpopRowValues.text(row, "instagramUrl"),
                KpopRowValues.text(row, "youtubeUrl"),
                KpopRowValues.text(row, "xUrl"));
    }
}
