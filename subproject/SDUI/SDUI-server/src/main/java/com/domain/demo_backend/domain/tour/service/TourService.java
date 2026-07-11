package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.client.TourApiClient;
import com.domain.demo_backend.domain.tour.domain.TourPoiRepository;
import com.domain.demo_backend.domain.tour.dto.HolyPoiDto;
import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 관광 POI 서비스 — TourAPI 조회 오케스트레이션 + 성지(tour_poi) 조회.
 * Epic #74 · Dev-2(#76) · Dev-4(#96-A).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TourService {

    private final TourApiClient tourApiClient;
    private final TourPoiRepository tourPoiRepository;

    /** 맛집(음식점, contentTypeId=39) 조회 편의 메서드. */
    public static final String CONTENT_TYPE_RESTAURANT = "39";

    /** 성지 목록에서 제외할 공공 데이터 소스. */
    public static final String SOURCE_TOURAPI = "TOURAPI";

    /** 검수 통과 상태. */
    public static final String REVIEW_APPROVED = "APPROVED";

    public List<TourPoiDto> getPois(String areaCode, String sigunguCode, String contentTypeId,
                                    String arrange, int numOfRows, int pageNo) {
        int rows = numOfRows <= 0 ? 20 : Math.min(numOfRows, 100);
        int page = pageNo <= 0 ? 1 : pageNo;
        log.info("[TourService] POI 조회 - area={}, sigungu={}, type={}, arrange={}, rows={}, page={}",
                areaCode, sigunguCode, contentTypeId, arrange, rows, page);
        return tourApiClient.areaBasedList(areaCode, sigunguCode, contentTypeId, arrange, rows, page);
    }

    public List<TourPoiDto> getRestaurants(String areaCode, int numOfRows, int pageNo) {
        return getPois(areaCode, null, CONTENT_TYPE_RESTAURANT, null, numOfRows, pageNo);
    }

    /**
     * 성지(HOLY) POI 목록 — tour_poi에서 공공(TOURAPI) 제외 + 검수 승인(APPROVED)분만.
     * 데이터 파이프라인 1차: 시드(V76) 서빙. 후속: LLM 정제 투입분(PENDING)은 검수 후 노출.
     */
    public List<HolyPoiDto> getHolyPois() {
        List<HolyPoiDto> pois = tourPoiRepository
                .findBySourceNotAndReviewStatusOrderByPoiSqnoAsc(SOURCE_TOURAPI, REVIEW_APPROVED)
                .stream()
                .map(HolyPoiDto::from)
                .toList();
        log.info("[TourService] 성지 POI 조회 - {}건", pois.size());
        return pois;
    }
}
