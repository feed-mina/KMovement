package com.domain.demo_backend.domain.theme.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DesignTokenRepository extends JpaRepository<DesignToken, Long> {
    List<DesignToken> findByThemeIdOrderByTokenIdAsc(String themeId);

    List<DesignToken> findAllByOrderByThemeIdAscCategoryAscTokenKeyAsc();
}
