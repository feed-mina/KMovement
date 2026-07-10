package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.client.TourApiClient;
import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 관광 POI 서비스 — TourAPI 조회 오케스트레이션.
 * Epic #74 · Dev-2(#76).
 *
 * <p>후속(Dev-4): tour_poi 테이블 upsert(큐레이션/성지 보강), Redis 캐시.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TourService {

    private final TourApiClient tourApiClient;

    /** 맛집(음식점, contentTypeId=39) 조회 편의 메서드. */
    public static final String CONTENT_TYPE_RESTAURANT = "39";

    public List<TourPoiDto> getPois(String areaCode, String contentTypeId, int numOfRows, int pageNo) {
        int rows = numOfRows <= 0 ? 20 : Math.min(numOfRows, 100);
        int page = pageNo <= 0 ? 1 : pageNo;
        log.info("[TourService] POI 조회 - area={}, type={}, rows={}, page={}", areaCode, contentTypeId, rows, page);
        return tourApiClient.areaBasedList(areaCode, contentTypeId, rows, page);
    }

    public List<TourPoiDto> getRestaurants(String areaCode, int numOfRows, int pageNo) {
        return getPois(areaCode, CONTENT_TYPE_RESTAURANT, numOfRows, pageNo);
    }
}
