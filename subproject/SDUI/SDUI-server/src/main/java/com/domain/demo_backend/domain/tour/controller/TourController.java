package com.domain.demo_backend.domain.tour.controller;

import com.domain.demo_backend.domain.tour.dto.HolyContentOptionDto;
import com.domain.demo_backend.domain.tour.dto.HolyPoiDto;
import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import com.domain.demo_backend.domain.tour.dto.TourRegionDto;
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

    /**
     * GET /api/v1/tour/holy — 성지(K-컬처) POI 목록. 검수 승인분만 노출. Dev-4(#96-A).
     * sigunguName: 전국 시드(V90)는 TourAPI 시·군·구 코드가 없어 주소 문자열로 거른다.
     * contentSqno: 작품/아티스트 링크(V91)로 필터.
     */
    @GetMapping("/holy")
    public ApiResponse<List<HolyPoiDto>> getHolyPois(
            @RequestParam(required = false) String areaCode,
            @RequestParam(required = false) String sigunguCode,
            @RequestParam(required = false) String sigunguName,
            @RequestParam(required = false) Long contentSqno,
            @RequestParam(required = false) String kind) {
        return ApiResponse.success(tourService.getHolyPois(areaCode, sigunguCode, sigunguName, contentSqno, kind));
    }

    /**
     * GET /api/v1/tour/holy/contents?q=김비서&category=drama&limit=20
     * 작품/아티스트 필터 선택지(자동완성) — 성지 수 내림차순.
     */
    @GetMapping("/holy/contents")
    public ApiResponse<List<HolyContentOptionDto>> getHolyContents(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.success(tourService.searchHolyContents(q, category, limit));
    }

    /**
     * GET /api/v1/tour/areas returns provinces.
     * GET /api/v1/tour/areas?areaCode=1 returns districts in Seoul.
     */
    @GetMapping("/areas")
    public ApiResponse<List<TourRegionDto>> getAreas(
            @RequestParam(required = false) String areaCode) {
        return ApiResponse.success(tourService.getAreas(areaCode));
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
