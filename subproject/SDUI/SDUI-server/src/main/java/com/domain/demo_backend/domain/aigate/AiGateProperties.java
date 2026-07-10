package com.domain.demo_backend.domain.aigate;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * SDUI 제품화(오픈코어) — AI 서버검증 게이트 설정.
 * 기본값 enabled=false 이므로 기존 라이브 앱(K-RIDE) 동작에 전혀 영향을 주지 않는다.
 * SaaS 공개 API 도입 시 app.ai-gate.enabled=true 로 활성화한다.
 *
 * 예)
 * app:
 *   ai-gate:
 *     enabled: false
 *     daily-quota: 100        # 0 이하면 쿼터 무제한
 *     keys: [ "dev-key-1" ]   # 임시 허용 키(추후 발급 테이블로 대체 — 스키마 결정 필요)
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.ai-gate")
public class AiGateProperties {

    /** 게이트 활성화 여부. false면 항상 통과(비파괴 기본값). */
    private boolean enabled = false;

    /** 키당 1일 허용 호출 수. 0 이하면 무제한. */
    private long dailyQuota = 0;

    /** 허용 API 키 목록(임시). 추후 키 발급/플랜 저장소로 대체. */
    private List<String> keys = new ArrayList<>();
}
