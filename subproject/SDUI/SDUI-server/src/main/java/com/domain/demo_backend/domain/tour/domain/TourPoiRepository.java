package com.domain.demo_backend.domain.tour.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * tour_poi 리포지토리 — 성지(비공공) POI 조회.
 * Epic #74 · Dev-4(#96-A).
 */
@Repository
public interface TourPoiRepository extends JpaRepository<TourPoi, Long> {

    /** 성지 목록: 공공(TOURAPI) 제외 + 승인분만. idx_tour_poi_holy 부분 인덱스 사용. */
    List<TourPoi> findBySourceNotAndReviewStatusOrderByPoiSqnoAsc(String excludedSource, String reviewStatus);

    /**
     * 시·군·구는 두 갈래로 매칭한다: 초기 서울 시드는 TourAPI sigungu_code 를,
     * 전국 시드(V90, kcisa_media_2023)는 코드가 없어 주소 문자열(:sigunguName)을 쓴다.
     * :contentSqno 가 오면 작품/아티스트 링크(V91)가 있는 성지만 남긴다.
     * :kind='FOOD' 는 식당·카페 촬영지(HOLY_FOOD, V92)만 — '성지 맛집' 칩.
     * 결과 상한은 Pageable 로 건다(전국 시드 이후 지역당 수천 행 가능).
     */
    @Query("""
            SELECT p FROM TourPoi p
            WHERE p.source <> :excludedSource
              AND p.reviewStatus = :reviewStatus
              AND (:areaCode IS NULL OR :areaCode = '' OR p.areaCode = :areaCode)
              AND (
                    ((:sigunguCode IS NULL OR :sigunguCode = '') AND (:sigunguName IS NULL OR :sigunguName = ''))
                 OR (:sigunguCode IS NOT NULL AND :sigunguCode <> '' AND p.sigunguCode = :sigunguCode)
                 OR (:sigunguName IS NOT NULL AND :sigunguName <> '' AND p.addr LIKE CONCAT('%', :sigunguName, '%'))
              )
              AND (:contentSqno IS NULL OR EXISTS (
                    SELECT 1 FROM HolyContentPoi l
                    WHERE l.poiSqno = p.poiSqno AND l.contentSqno = :contentSqno))
              AND (:kind IS NULL OR :kind = ''
                   OR (:kind = 'FOOD' AND p.contentTypeId = 'HOLY_FOOD'))
            ORDER BY p.poiSqno ASC
            """)
    List<TourPoi> findHolyPoisByRegion(
            @Param("excludedSource") String excludedSource,
            @Param("reviewStatus") String reviewStatus,
            @Param("areaCode") String areaCode,
            @Param("sigunguCode") String sigunguCode,
            @Param("sigunguName") String sigunguName,
            @Param("contentSqno") Long contentSqno,
            @Param("kind") String kind,
            Pageable pageable);

    Optional<TourPoi> findFirstBySourceUrlAndReviewStatus(String sourceUrl, String reviewStatus);

    /**
     * 사진 보강 대상: 승인된 성지 중 대표 이미지가 없고 좌표가 있는 행.
     * 좌표가 없으면 TourAPI 반경 검색을 걸 수 없으므로 애초에 제외한다.
     * 한 번에 다 돌리면 TourAPI 쿼터를 넘기므로 Pageable 로 나눠 처리한다.
     */
    @Query("""
            SELECT p FROM TourPoi p
            WHERE p.source <> :excludedSource
              AND p.reviewStatus = :reviewStatus
              AND (p.firstImage IS NULL OR TRIM(p.firstImage) = '')
              AND p.mapX IS NOT NULL
              AND p.mapY IS NOT NULL
            ORDER BY p.poiSqno ASC
            """)
    List<TourPoi> findHolyPoisMissingImage(
            @Param("excludedSource") String excludedSource,
            @Param("reviewStatus") String reviewStatus,
            Pageable pageable);
}
