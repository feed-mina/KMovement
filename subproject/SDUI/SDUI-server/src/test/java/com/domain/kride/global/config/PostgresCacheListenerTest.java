package com.domain.kride.global.config;

import com.domain.kride.domain.kpop.service.KpopCacheService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class PostgresCacheListenerTest {

    private final KpopCacheService kpopCacheService = mock(KpopCacheService.class);
    private final PostgresCacheListener listener =
            new PostgresCacheListener(mock(DataSource.class), new ObjectMapper(), kpopCacheService);

    @Test
    void kpopCatalogNotificationInvalidatesCatalog() {
        listener.processNotification("{\"table\":\"kpop_catalog\",\"key\":\"artist\"}");
        verify(kpopCacheService, times(1)).invalidateCatalog();
    }

    @Test
    void otherOrBrokenNotificationsAreIgnored() {
        listener.processNotification("{\"table\":\"ui_metadata\",\"key\":\"HOME\"}");
        listener.processNotification("{\"key\":\"x\"}");
        listener.processNotification("not json");
        verify(kpopCacheService, never()).invalidateCatalog();
    }

    @Test
    void backoffDoublesUpToCap() {
        assertThat(PostgresCacheListener.nextBackoff(1_000L)).isEqualTo(2_000L);
        assertThat(PostgresCacheListener.nextBackoff(16_000L)).isEqualTo(30_000L);
        assertThat(PostgresCacheListener.nextBackoff(30_000L)).isEqualTo(30_000L);
    }
}
