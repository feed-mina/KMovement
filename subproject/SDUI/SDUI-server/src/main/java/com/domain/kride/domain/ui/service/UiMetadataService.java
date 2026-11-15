package com.domain.kride.domain.ui.service;

import com.domain.kride.domain.ui.domain.UiMetadata;
import com.domain.kride.domain.ui.domain.UiMetadataRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.List;

//2026.01.14 동적하면 로직
public class UiMetadataService {
    private final UiMetadataRepository uiMetadataRepository;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public UiMetadataService(UiMetadataRepository uiMetadataRepository, StringRedisTemplate stringRedisTemplate, ObjectMapper objectMapper) {
        this.uiMetadataRepository = uiMetadataRepository;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
    }

    public List<UiMetadata> getMetadataWithCache(String screenId) {
        String cacheKey = "ui:metadata:" + screenId;
        try {
            // 1. 레디스에서 먼저 찾아본다
            String cacheData = stringRedisTemplate.opsForValue().get(cacheKey);
            if (cacheData != null) {
                // 역 직렬화 : JSON 문자열 => List<UiMetadata>
                return objectMapper.readValue(cacheData, new TypeReference<List<UiMetadata>>() {
                });
            }

            // 2. 레디스에 없으면 DB에서 가져온다.
            List<UiMetadata> metadataList = uiMetadataRepository.findByScreenIdOrderBySortOrderAsc(screenId);

            // 3. 다음에 또 쓸 수있게 레디으에 저장한다. (캐싱)
            // 직렬화 List<UiMetadata> -> JSON 문자열
            String jsonMetadata = objectMapper.writeValueAsString(metadataList);
            stringRedisTemplate.opsForValue().set(cacheKey, jsonMetadata, Duration.ofHours(1)); // 1시간동안 유지

            return metadataList;
        } catch (Exception e) {
            // 에러 발생시 안전하게 DB에서 직접 가져온다.
            return uiMetadataRepository.findByScreenIdOrderBySortOrderAsc(screenId);

        }
    }

    ;

}
