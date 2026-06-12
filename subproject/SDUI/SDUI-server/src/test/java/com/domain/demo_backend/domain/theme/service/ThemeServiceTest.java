package com.domain.demo_backend.domain.theme.service;

import com.domain.demo_backend.domain.theme.domain.DesignToken;
import com.domain.demo_backend.domain.theme.domain.DesignTokenRepository;
import com.domain.demo_backend.domain.theme.dto.ThemeResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ThemeService 단위 테스트 — DB 기반 디자인 토큰 (issue #4 Phase 3)")
class ThemeServiceTest {

    private static final String THEME_ID = "KRIDE_DEFAULT";
    private static final String CACHE_KEY = "THEME:" + THEME_ID;

    @Mock
    private DesignTokenRepository designTokenRepository;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private ThemeService themeService;

    private DesignToken primaryToken;
    private DesignToken bgCreamToken;

    @BeforeEach
    void setUp() {
        themeService = new ThemeService(designTokenRepository, stringRedisTemplate, new ObjectMapper());
        primaryToken = DesignToken.builder()
                .tokenId(1L).themeId(THEME_ID)
                .category("color").tokenKey("primary").tokenValue("#E50914")
                .build();
        bgCreamToken = DesignToken.builder()
                .tokenId(2L).themeId(THEME_ID)
                .category("color").tokenKey("bg-cream").tokenValue("#FDFBF7")
                .build();
    }

    @Test
    @DisplayName("getTheme — 캐시 미스 시 DB 조회 후 Redis에 1시간 TTL로 캐싱")
    void getTheme_cacheMiss_loadsFromDbAndCaches() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(CACHE_KEY)).thenReturn(null);
        when(designTokenRepository.findByThemeIdOrderByTokenIdAsc(THEME_ID))
                .thenReturn(List.of(primaryToken, bgCreamToken));

        ThemeResponseDto result = themeService.getTheme(THEME_ID);

        assertThat(result.getThemeId()).isEqualTo(THEME_ID);
        assertThat(result.getTokens()).hasSize(2);
        assertThat(result.getTokens().get(0).getKey()).isEqualTo("primary");
        assertThat(result.getTokens().get(0).getValue()).isEqualTo("#E50914");
        verify(valueOperations).set(eq(CACHE_KEY), anyString(), eq(Duration.ofHours(1)));
    }

    @Test
    @DisplayName("getTheme — 캐시 히트 시 DB를 조회하지 않음")
    void getTheme_cacheHit_skipsDb() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(CACHE_KEY)).thenReturn(
                "{\"themeId\":\"KRIDE_DEFAULT\",\"tokens\":[{\"category\":\"color\",\"key\":\"primary\",\"value\":\"#E50914\"}]}");

        ThemeResponseDto result = themeService.getTheme(THEME_ID);

        assertThat(result.getTokens()).hasSize(1);
        assertThat(result.getTokens().get(0).getValue()).isEqualTo("#E50914");
        verify(designTokenRepository, never()).findByThemeIdOrderByTokenIdAsc(anyString());
    }

    @Test
    @DisplayName("getTheme — 등록되지 않은 themeId면 IllegalArgumentException")
    void getTheme_unknownThemeId_throws() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("THEME:NOPE")).thenReturn(null);
        when(designTokenRepository.findByThemeIdOrderByTokenIdAsc("NOPE")).thenReturn(List.of());

        assertThatThrownBy(() -> themeService.getTheme("NOPE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("NOPE");
    }

    @Test
    @DisplayName("updateTokens — 값 수정 후 캐시 무효화")
    void updateTokens_updatesValueAndEvictsCache() {
        when(designTokenRepository.findByThemeIdOrderByTokenIdAsc(THEME_ID))
                .thenReturn(List.of(primaryToken, bgCreamToken));

        ThemeResponseDto result = themeService.updateTokens(THEME_ID, Map.of("primary", "#FF0000"));

        assertThat(primaryToken.getTokenValue()).isEqualTo("#FF0000");
        assertThat(primaryToken.getUpdatedAt()).isNotNull();
        assertThat(bgCreamToken.getTokenValue()).isEqualTo("#FDFBF7"); // 미수정 토큰은 유지
        assertThat(result.getTokens()).extracting(ThemeResponseDto.TokenDto::getValue)
                .containsExactly("#FF0000", "#FDFBF7");
        verify(stringRedisTemplate).delete(CACHE_KEY);
    }

    @Test
    @DisplayName("updateTokens — 등록되지 않은 token_key면 IllegalArgumentException")
    void updateTokens_unknownKey_throws() {
        when(designTokenRepository.findByThemeIdOrderByTokenIdAsc(THEME_ID))
                .thenReturn(List.of(primaryToken));

        assertThatThrownBy(() -> themeService.updateTokens(THEME_ID, Map.of("no-such-key", "#000")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no-such-key");
    }
}
