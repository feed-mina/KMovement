package com.domain.demo_backend.domain.kridechat;

import com.domain.demo_backend.domain.aigate.AiUsageGate;
import com.domain.demo_backend.domain.aigate.GateResult;
import com.domain.demo_backend.domain.kridechat.controller.KrideChatController;
import com.domain.demo_backend.domain.kridechat.dto.ChatQueryRequest;
import com.domain.demo_backend.domain.kridechat.service.KrideChatService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class KrideChatAuthenticationTest {
    @Test void noSessionIs401BeforeQuotaOrProvider() {
        var gate = mock(AiUsageGate.class); var service = mock(KrideChatService.class);
        var controller = new KrideChatController(service, Runnable::run, gate);
        assertThatThrownBy(() -> controller.streamChat(new ChatQueryRequest(), null, null))
            .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(401));
        verifyNoInteractions(gate, service);
    }

    @Test void invalidKeyIs401AndQuotaIs429() {
        for (var result : new GateResult[]{GateResult.INVALID_KEY, GateResult.QUOTA_EXCEEDED}) {
            var gate = mock(AiUsageGate.class); var service = mock(KrideChatService.class);
            when(gate.check("fixture")).thenReturn(result);
            var controller = new KrideChatController(service, Runnable::run, gate);
            assertThatThrownBy(() -> controller.streamChat(new ChatQueryRequest(), mock(CustomUserDetails.class), "fixture"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value())
                    .isEqualTo(result == GateResult.INVALID_KEY ? 401 : 429));
            verifyNoInteractions(service);
        }
    }

    @Test void sessionIdentityOverridesBodyIdentity() {
        var gate = mock(AiUsageGate.class); var service = mock(KrideChatService.class);
        when(gate.check(null)).thenReturn(GateResult.ALLOWED);
        var user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(7L); when(user.getUserId()).thenReturn("verified");
        var request = new ChatQueryRequest(); request.setUserSqno(999L); request.setUserId("forged");
        new KrideChatController(service, Runnable::run, gate).streamChat(request, user, null);
        assertThat(request.getUserSqno()).isEqualTo(7L);
        assertThat(request.getUserId()).isEqualTo("verified");
    }
}
