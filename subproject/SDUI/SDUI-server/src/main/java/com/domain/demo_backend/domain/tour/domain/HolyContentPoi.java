package com.domain.demo_backend.domain.tour.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 작품/아티스트 ↔ 성지(tour_poi) N:M 링크 (V91).
 * 프로젝트 관례(TourPoi)와 같게 연관관계 없이 FK 값을 플랫하게 둔다.
 */
@Entity
@Table(name = "holy_content_poi")
@Getter
@Setter
@NoArgsConstructor
public class HolyContentPoi {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "link_id")
    private Long linkId;

    @Column(name = "content_sqno", nullable = false)
    private Long contentSqno;

    @Column(name = "poi_sqno", nullable = false)
    private Long poiSqno;

    /** 원본 관계 유형 (예: FILMING_AT). */
    @Column(name = "relationship", length = 40)
    private String relationship;
}
