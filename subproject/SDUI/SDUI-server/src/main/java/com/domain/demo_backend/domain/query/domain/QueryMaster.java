package com.domain.demo_backend.domain.query.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// 2026.01.14 메타데이터 기반의 동적 쿼리 실행 , 쿼리 마스터 테이블 생성 > JPA 로 변환
@Entity
@Table(name = "query_master")
@Getter
@NoArgsConstructor
public class QueryMaster {

    @Id
    @Column(name = "sql_key")
    private String sqlKey; // 쿼리 식별자

    @Column(name = "query_text", nullable = false)
    private String queryText; // 실제 실행할 SQL 문장

    @Column(name = "return_type")
    private String returnType; // SINGLE, MULTI 등

    private String description;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "required_role")
    private String requiredRole; // NULL=공개, ROLE_USER=로그인 필요, ROLE_ADMIN=관리자 전용
    @Column(name = "required_params", columnDefinition = "TEXT")
    private String requiredParams;

    @Column(name = "param_mapping", columnDefinition = "TEXT")
    private String paramMapping;

    @Column(name = "use_redis_yn", length = 1)
    private String useRedisYn;

    @Column(name = "redis_ttl_sec")
    private Integer redisTtlSec;
}
