package com.domain.demo_backend.domain.tour.domain;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 작품/아티스트 카탈로그 조회 — 탐색 화면 성지 필터의 자동완성 소스.
 */
@Repository
public interface HolyContentRepository extends JpaRepository<HolyContent, Long> {

    /** 검색 결과 한 줄(성지 수 포함) 프로젝션. */
    interface HolyContentOption {
        Long getContentSqno();
        String getName();
        String getNameEn();
        String getCategory();
        Long getPoiCount();
    }

    /**
     * 이름/영문명 부분 일치 + 카테고리 필터. 성지 수가 많은 순으로 돌려주어
     * 빈 입력에서도 인기 작품이 먼저 보이게 한다.
     */
    @Query("""
            SELECT c.contentSqno AS contentSqno, c.name AS name, c.nameEn AS nameEn,
                   c.category AS category, COUNT(l.linkId) AS poiCount
            FROM HolyContent c
            JOIN HolyContentPoi l ON l.contentSqno = c.contentSqno
            WHERE (:q = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(c.nameEn, '')) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:category = '' OR c.category = :category)
            GROUP BY c.contentSqno, c.name, c.nameEn, c.category
            ORDER BY COUNT(l.linkId) DESC, c.name ASC
            """)
    List<HolyContentOption> searchOptions(
            @Param("q") String q,
            @Param("category") String category,
            Pageable pageable);
}
