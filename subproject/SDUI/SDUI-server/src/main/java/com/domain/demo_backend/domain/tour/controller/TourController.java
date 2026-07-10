package com.domain.demo_backend.domain.tour.controller;

import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import com.domain.demo_backend.domain.tour.service.TourService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 관광 POI API — TourAPI 지역기반 관광정보/맛집 조회.
 * Epic #74 · Dev-2(#76).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour")
@RequiredArgsConstructor
public class TourController {

    private final TourService tourService;

    /**
     * GET /api/v1/tour/poi?areaCode=1&contentTypeId=39&numOfRows=20&pageNo=1
     * areaCode/contentTypeId 미지정 시 전체.
     */
    @GetMapping("/poi")
    public ApiResponse<List<TourPoiDto>> getPois(
            @RequestParam(required = false) String areaCode,
            @RequestParam(required = false) String sigunguCode,
            @RequestParam(required = false) String contentTypeId,
            @RequestParam(required = false) String arrange,
            @RequestParam(defaultValue = "20") int numOfRows,
            @RequestParam(defaultValue = "1") int pageNo) {
        return ApiResponse.success(tourService.getPois(areaCode, sigunguCode, contentTypeId, arrange, numOfRows, pageNo));
    }

    /** GET /api/v1/tour/restaurants?areaCode=1 — 맛집(음식점) 조회 편의 엔드포인트. */
    @GetMapping("/restaurants")
    public ApiResponse<List<TourPoiDto>> getRestaurants(
            @RequestParam(required = false) String areaCode,
            @RequestParam(defaultValue = "20") int numOfRows,
            @RequestParam(defaultValue = "1") int pageNo) {
        return ApiResponse.success(tourService.getRestaurants(areaCode, numOfRows, pageNo));
    }
}
