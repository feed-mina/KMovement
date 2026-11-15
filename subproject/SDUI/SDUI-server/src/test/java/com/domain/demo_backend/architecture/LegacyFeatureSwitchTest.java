package com.domain.demo_backend.architecture;

import com.domain.demo_backend.domain.leetcode.scheduler.DailyLeetcodeScheduler;
import com.domain.demo_backend.global.common.util.StompHandler;
import com.domain.demo_backend.global.common.util.WebSocketEventListener;
import com.domain.demo_backend.global.config.WebSocketConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/** 이전 프로젝트 스케줄러·WebSocket이 기본으로 꺼져 있고 설정값으로만 켜지는지 확인한다. */
class LegacyFeatureSwitchTest {

    @Test
    void scheduledRunDoesNothingWhileSwitchIsOff() {
        var repo = mock(com.domain.demo_backend.domain.leetcode.domain.LeetcodeProblemRepository.class);
        var slack = mock(com.domain.demo_backend.domain.kakao.service.SlackNotificationService.class);
        DailyLeetcodeScheduler scheduler = new DailyLeetcodeScheduler(repo, slack);

        scheduler.sendMorningProblem();
        scheduler.sendNoonProblem();
        scheduler.sendEveningProblem();

        verifyNoInteractions(repo, slack);
        assertThat(ReflectionTestUtils.getField(scheduler, "legacySchedulersEnabled")).isEqualTo(false);
    }

    @Test
    void webSocketBeansRequireExplicitOptIn() {
        for (Class<?> type : new Class<?>[]{WebSocketConfig.class, WebSocketEventListener.class, StompHandler.class,
                com.domain.demo_backend.domain.Location.controller.LocationController.class}) {
            ConditionalOnProperty condition = type.getAnnotation(ConditionalOnProperty.class);
            assertThat(condition).as(type.getSimpleName()).isNotNull();
            assertThat(condition.name()).containsExactly("kride.legacy.websocket.enabled");
            assertThat(condition.havingValue()).isEqualTo("true");
            assertThat(condition.matchIfMissing()).isFalse();
        }
    }
}
