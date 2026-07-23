package com.domain.demo_backend.domain.query.service;

import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.domain.query.repository.QueryMasterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import com.domain.demo_backend.global.exception.CodedResponseStatusException;
import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import org.springframework.http.HttpStatus;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;

@Service
public class QueryMasterService {
    private final QueryMasterRepository queryMasterRepository;
    private final StringRedisTemplate stringRedisTemplate;
    private final BackendOperationalTelemetry telemetry;

    @Autowired
    public QueryMasterService(
            QueryMasterRepository queryMasterRepository,
            StringRedisTemplate stringRedisTemplate,
            BackendOperationalTelemetry telemetry) {
        this.queryMasterRepository = queryMasterRepository;
        this.stringRedisTemplate = stringRedisTemplate;
        this.telemetry = telemetry;
    }

    public QueryMasterService(QueryMasterRepository queryMasterRepository, StringRedisTemplate stringRedisTemplate) {
        this(queryMasterRepository, stringRedisTemplate, BackendOperationalTelemetry.noop());
    }

    public QueryMaster getQueryInfo(String sqlKey) {
        // DB에서 해당 키의 전체 정보를 찾아서 반환한다.
        // 필요하다면 여기에서 Redis에 객체 자체를 저장하는 로직 추가 하기
        return queryMasterRepository.findBySqlKey(sqlKey).orElse(null);
    }

    public String getQuery(String sqlKey) {
        // 먼저 Redis에서 해당 키의 SQL이 있는지 확인
        String cacheKey = "SQL:" + sqlKey;
        try {
            String cachedQuery = stringRedisTemplate.opsForValue().get(cacheKey);
            if (cachedQuery != null) {
                telemetry.record("query_definition_cache", "hit", sqlKey, Set.of());
                return cachedQuery;
            }
        } catch (RuntimeException redisFailure) {
            telemetry.record("query_definition_cache", "read_fallback", sqlKey, Set.of());
        }

        // Redis에 없다면 DB에서 찾는다
        QueryMaster queryMaster = queryMasterRepository.findBySqlKey(sqlKey)
                .orElseThrow(() -> new CodedResponseStatusException(
                        HttpStatus.NOT_FOUND, "QUERY_NOT_FOUND", "The requested query is not registered."));


        // 찾은 쿼리를 다음에 빨리 쓰기 위해 Redis에 저장(캐싱)한다.
        try {
            int ttlSeconds = queryMaster.getRedisTtlSec() == null
                    ? 300 : Math.min(3600, Math.max(30, queryMaster.getRedisTtlSec()));
            stringRedisTemplate.opsForValue().set(
                    cacheKey, queryMaster.getQueryText(), Duration.ofSeconds(ttlSeconds));
            telemetry.record("query_definition_cache", "write", sqlKey, Set.of());
        } catch (RuntimeException redisFailure) {
            telemetry.record("query_definition_cache", "write_fallback", sqlKey, Set.of());
        }
        return queryMaster.getQueryText();


    }
}
