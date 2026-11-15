package com.domain.kride.domain.query.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Repository
public class DynamicExecutor {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    // 스프링이 자동으로 DB연결 도구(jdbcTemplate)를 주입
    public DynamicExecutor(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> executeList(String sql, Map<String, Object> params) {
        // 1. 파라미터 를 만들고 Map에 있는 모든 값을 넣는다
        // 이때 값이 없는 것은 NULL로 들어간다
        MapSqlParameterSource paramSource = new MapSqlParameterSource();
        if (params != null) {
            params.forEach(paramSource::addValue);
        }
        // 2. 쿼리를 실행하여 결과를 리스트로 받는다.
        return jdbcTemplate.queryForList(sql, paramSource);
    }

    // INSERT, UPDATE, DELETE 처리가 필요할때 사용할 메서드
    public int executeUpdate(String sql, Map<String, Object> params) {
        MapSqlParameterSource paramSource = new MapSqlParameterSource();

        // 1. 전달받은 파라미터를 먼저 담는다 (JSON 변환 로직 )
        if (params != null) {
            params.forEach((key, value) -> {
                // List나 Map 타입인 경우 JSON 문자열로 변환
                if (value instanceof List || value instanceof Map) {
                    try {
                        paramSource.addValue(key, objectMapper.writeValueAsString(value));
                    } catch (JsonProcessingException e) {
                        // 직렬화 실패 시 로그를 남기고 원본값을 넣거나 예외를 던짐
                        paramSource.addValue(key, value);
                    }
                } else {
                    paramSource.addValue(key, value);
                }
            });
        }
        // 2. SQL에서 파라미터(:param) 추출하여 누락된 키에 null 채우기
        // (?<!:) 는 앞에 콜론이 또 있지 않은 경우만 찾음 (PostgreSQL :: 캐스팅 방지)
        Pattern pattern = Pattern.compile("(?<!:):([a-zA-Z0-9_]+)");
        Matcher matcher = pattern.matcher(sql);

        while (matcher.find()) {
            String paramName = matcher.group(1);
            if (!paramSource.hasValue(paramName)) {
                paramSource.addValue(paramName, null); // 없는 키는 null로 세팅!
            }
        }
        // 2. 쿼리를 실행하여 결과를 리스트로 받는다..
        return jdbcTemplate.update(sql, paramSource);
    }
}
