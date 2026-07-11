package com.domain.demo_backend.domain.tour.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * tour_poi 테이블 엔티티 — 공공(TOURAPI) + 성지 큐레이션(SEED/UGC/CRAWL) 통합 저장.
 * Epic #74 · Dev-4(#96-A). 스키마: V75 + V76(성지 확장 컬럼).
 *
 * <p>주의: raw_json(JSONB)은 1차 조회 경로에서 불필요하여 매핑하지 않는다.</p>
 */
@Entity
@Table(name = "tour_poi")
@Getter
@Setter
@NoArgsConstructor
public class TourPoi {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "poi_sqno", nullable = false)
    private Long poiSqno;

    @Column(name = "content_id", length = 50)
    private String contentId;

    @Column(name = "content_type_id", length = 10)
    private String contentTypeId;

    @Column(name = "source", nullable = false, length = 20)
    private String source; // TOURAPI | SEED | UGC | CRAWL

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "addr", length = 500)
    private String addr;

    @Column(name = "map_x")
    private Double mapX; // 경도(lng)

    @Column(name = "map_y")
    private Double mapY; // 위도(lat)

    @Column(name = "first_image")
    private String firstImage;

    @Column(name = "tel", length = 100)
    private String tel;

    @Column(name = "cat1", length = 20)
    private String cat1;

    @Column(name = "cat2", length = 20)
    private String cat2;

    @Column(name = "cat3", length = 20)
    private String cat3;

    @Column(name = "area_code", length = 10)
    private String areaCode;

    @Column(name = "sigungu_code", length = 10)
    private String sigunguCode;

    // ── 성지 확장 (V76) ──

    @Column(name = "artist", length = 120)
    private String artist;

    @Column(name = "fandom_info", length = 255)
    private String fandomInfo;

    @Column(name = "recommend_reason", length = 500)
    private String recommendReason;

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "review_status", nullable = false, length = 12)
    private String reviewStatus = "PENDING"; // PENDING | APPROVED | REJECTED

    @Column(name = "reviewed_by", length = 60)
    private String reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private LocalDateTime updatedAt;
}
