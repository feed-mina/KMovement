package com.domain.demo_backend.domain.theme.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// 2026-06-12 DB 기반 테마 시스템 (GitHub issue #4 Phase 3)
// token_key는 프론트 CSS 변수 --kride-{token_key}에 1:1 매핑된다
@Entity
@Table(name = "design_tokens")
@Getter
@NoArgsConstructor
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class DesignToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "token_id")
    private Long tokenId;

    @Column(name = "theme_id", nullable = false)
    private String themeId;

    @Column(name = "category", nullable = false)
    private String category; // color | spacing | radius | shadow | size

    @Column(name = "token_key", nullable = false)
    private String tokenKey;

    @Column(name = "token_value", nullable = false)
    private String tokenValue;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public void updateValue(String tokenValue) {
        this.tokenValue = tokenValue;
        this.updatedAt = LocalDateTime.now();
    }
}
