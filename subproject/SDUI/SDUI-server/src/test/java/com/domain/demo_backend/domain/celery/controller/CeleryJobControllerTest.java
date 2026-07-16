package com.domain.demo_backend.domain.celery.controller;

import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.service.CeleryJobService;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CeleryJobControllerTest {

    private static final String TASK_ID = "85a9f8bb-e57b-4b8d-a1ca-5a1f34cb764a";

    @Test
    void submitWithoutPrincipalReturnsUnauthorized() {
        CeleryJobService service = mock(CeleryJobService.class);
        CeleryJobController controller = new CeleryJobController(service);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> controller.submitJob("video", Map.of("input", "value"), null)
        );

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        verify(service, never()).submitJob(any(), any(), anyLong());
    }

    @Test
    void ownershipCheckUsesDatabaseLookupWithoutRefreshingGateway() {
        CeleryJobService service = mock(CeleryJobService.class);
        CeleryJob ownedJob = CeleryJob.builder()
                .celeryTaskId(TASK_ID)
                .taskType("video")
                .status("UPLOADING")
                .requestedBy(7L)
                .build();
        when(service.getOwnedJobStatus(TASK_ID, 7L)).thenReturn(ownedJob);
        CeleryJobController controller = new CeleryJobController(service);
        CustomUserDetails principal = new CustomUserDetails(
                User.builder().userSqno(7L).role("ROLE_USER").build()
        );

        ResponseEntity<Void> response = controller.checkJobOwnership(TASK_ID, principal);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(service).getOwnedJobStatus(TASK_ID, 7L);
        verify(service, never()).refreshJob(any(CeleryJob.class));
    }
}
