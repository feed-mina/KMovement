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

import java.time.LocalDateTime;

/**
 * 성지 필터용 작품/아티스트 카탈로그 (V91, kcisa_media_2023).
 * category: kpop | drama | movie | show.
 */
@Entity
@Table(name = "holy_content")
@Getter
@Setter
@NoArgsConstructor
public class HolyContent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "content_sqno")
    private Long contentSqno;

    /** 시드 재실행 안전용 원본 참조: 'kride-artist-{tmp_artist_id}'. */
    @Column(name = "source_ref", length = 40, nullable = false, unique = true)
    private String sourceRef;

    @Column(name = "name", length = 200, nullable = false)
    private String name;

    @Column(name = "name_en", length = 200)
    private String nameEn;

    @Column(name = "category", length = 20, nullable = false)
    private String category;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
