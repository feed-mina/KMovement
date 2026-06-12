package com.domain.demo_backend.domain.theme.service;

import com.domain.demo_backend.domain.theme.domain.DesignToken;
import com.domain.demo_backend.domain.theme.domain.DesignTokenRepository;
import com.domain.demo_backend.domain.theme.dto.ThemeResponseDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// 2026-06-12 DB 기반 테마 시스템 (GitHub issue #4 Phase 3)
// query_master(SQL:{sqlKey})와 동일한 "DB + Redis 캐시" 패턴: THEME:{themeId}
@Service
public class ThemeService {
    private static final Logger log = LoggerFactory.getLogger(ThemeService.class);
    private static final String CACHE_PREFIX = "THEME:";
    private static final Duration CACHE_TTL = Duration.ofHours(1);

    private final DesignTokenRepository designTokenRepository;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public ThemeService(DesignTokenRepository designTokenRepository,
                        StringRedisTemplate stringRedisTemplate,
                        ObjectMapper objectMapper) {
        this.designTokenRepository = designTokenRepository;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public ThemeResponseDto getTheme(String themeId) {
        // 1. Redis 캐시 확인
        String cached = null;
        try {
            cached = stringRedisTemplate.opsForValue().get(CACHE_PREFIX + themeId);
        } catch (Exception e) {
            // Redis 장애 시에도 DB 조회로 계속 진행
            log.error("테마 캐시 조회 실패 (DB로 폴백): themeId={}", themeId, e);
        }
        if (cached != null) {
            try {
                return objectMapper.readValue(cached, ThemeResponseDto.class);
            } catch (JsonProcessingException e) {
                log.error("테마 캐시 역직렬화 실패, DB에서 재조회: themeId={}", themeId, e);
            }
        }

        // 2. DB 조회
        List<DesignToken> entities = designTokenRepository.findByThemeIdOrderByTokenIdAsc(themeId);
        if (entities.isEmpty()) {
            throw new IllegalArgumentException("등록되지 않은 themeId입니다: " + themeId);
        }
        ThemeResponseDto dto = new ThemeResponseDto(
                themeId,
                entities.stream().map(ThemeResponseDto.TokenDto::from).collect(Collectors.toList())
        );

        // 3. 캐싱 (TTL 1시간 — ui_metadata 캐시 정책과 동일)
        try {
            stringRedisTemplate.opsForValue()
                    .set(CACHE_PREFIX + themeId, objectMapper.writeValueAsString(dto), CACHE_TTL);
        } catch (Exception e) {
            log.error("테마 캐시 저장 실패 (응답은 정상 반환): themeId={}", themeId, e);
        }
        return dto;
    }

    // 토큰 값 일괄 수정 (관리자 전용) — 저장 후 캐시 즉시 무효화로 전 클라이언트 반영
    @Transactional
    public ThemeResponseDto updateTokens(String themeId, Map<String, String> tokenUpdates) {
        List<DesignToken> entities = designTokenRepository.findByThemeIdOrderByTokenIdAsc(themeId);
        if (entities.isEmpty()) {
            throw new IllegalArgumentException("등록되지 않은 themeId입니다: " + themeId);
        }

        Map<String, DesignToken> byKey = entities.stream()
                .collect(Collectors.toMap(DesignToken::getTokenKey, token -> token));

        for (Map.Entry<String, String> entry : tokenUpdates.entrySet()) {
            DesignToken token = byKey.get(entry.getKey());
            if (token == null) {
                throw new IllegalArgumentException("등록되지 않은 token_key입니다: " + entry.getKey());
            }
            token.updateValue(entry.getValue());
        }

        // 캐시 무효화 — 다음 GET에서 새 값으로 재캐싱됨
        try {
            stringRedisTemplate.delete(CACHE_PREFIX + themeId);
        } catch (Exception e) {
            log.error("테마 캐시 무효화 실패 (TTL 만료 시 자동 갱신됨): themeId={}", themeId, e);
        }

        return new ThemeResponseDto(
                themeId,
                entities.stream().map(ThemeResponseDto.TokenDto::from).collect(Collectors.toList())
        );
    }
}
