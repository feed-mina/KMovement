package com.domain.kride.domain.kpop.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;
import java.util.Map;

/** 아티스트 상세에 붙는 일정 한 건. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KpopArtistEventDto(
        Long id,
        Long artistId,
        String titleKo,
        String titleEn,
        String region,
        String venue,
        LocalDate date,
        String officialUrl
) {
    public static KpopArtistEventDto fromRow(Map<String, Object> row) {
        return new KpopArtistEventDto(
                KpopRowValues.longValue(row, "id"),
                KpopRowValues.longValue(row, "artistId"),
                KpopRowValues.text(row, "titleKo"),
                KpopRowValues.text(row, "titleEn"),
                KpopRowValues.text(row, "region"),
                KpopRowValues.text(row, "venue"),
                KpopRowValues.date(row, "date"),
                KpopRowValues.text(row, "officialUrl"));
    }
}
