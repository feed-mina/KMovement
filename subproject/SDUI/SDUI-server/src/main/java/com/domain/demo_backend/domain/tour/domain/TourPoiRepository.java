package com.domain.demo_backend.domain.tour.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * tour_poi 리포지토리 — 성지(비공공) POI 조회.
 * Epic #74 · Dev-4(#96-A).
 */
@Repository
public interface TourPoiRepository extends JpaRepository<TourPoi, Long> {

    /** 성지 목록: 공공(TOURAPI) 제외 + 승인분만. idx_tour_poi_holy 부분 인덱스 사용. */
    List<TourPoi> findBySourceNotAndReviewStatusOrderByPoiSqnoAsc(String excludedSource, String reviewStatus);
}
