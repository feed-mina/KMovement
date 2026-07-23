package com.domain.demo_backend.domain.ai.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URI;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class S3ServiceKpopAnalysisTest {

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    @Mock
    private PresignedPutObjectRequest presignedPutObjectRequest;

    private S3Service s3Service;

    @BeforeEach
    void setUp() {
        s3Service = new S3Service(s3Client, s3Presigner);
        ReflectionTestUtils.setField(s3Service, "bucket", "test-bucket");
    }

    @Test
    void createsUserOwnedEncryptedPresignedUpload() throws Exception {
        when(presignedPutObjectRequest.url()).thenReturn(
                URI.create("https://test-bucket.s3.example/upload").toURL()
        );
        when(presignedPutObjectRequest.expiration()).thenReturn(
                Instant.parse("2026-07-23T12:10:00Z")
        );
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class)))
                .thenReturn(presignedPutObjectRequest);

        S3Service.KpopAnalysisUpload upload = s3Service.createKpopAnalysisUpload(
                42L,
                "IMAGE/JPEG",
                2048L
        );

        assertTrue(upload.key().matches("kpop-analysis/42/[0-9a-f-]{36}\\.jpg"));
        assertEquals("https://test-bucket.s3.example/upload", upload.url());
        assertEquals("image/jpeg", upload.headers().get("Content-Type"));
        assertEquals("AES256", upload.headers().get("x-amz-server-side-encryption"));
        assertEquals(Instant.parse("2026-07-23T12:10:00Z"), upload.expiresAt());

        ArgumentCaptor<PutObjectPresignRequest> captor =
                ArgumentCaptor.forClass(PutObjectPresignRequest.class);
        verify(s3Presigner).presignPutObject(captor.capture());
        PutObjectPresignRequest request = captor.getValue();
        assertEquals("test-bucket", request.putObjectRequest().bucket());
        assertEquals(upload.key(), request.putObjectRequest().key());
        assertEquals("image/jpeg", request.putObjectRequest().contentType());
        assertEquals(2048L, request.putObjectRequest().contentLength());
        assertEquals(ServerSideEncryption.AES256,
                request.putObjectRequest().serverSideEncryption());
        assertEquals(600L, request.signatureDuration().toSeconds());
    }

    @Test
    void rejectsUnsupportedTypeAndInvalidSizeBeforePresigning() {
        assertThrows(IllegalArgumentException.class,
                () -> s3Service.createKpopAnalysisUpload(42L, "image/gif", 100L));
        assertThrows(IllegalArgumentException.class,
                () -> s3Service.createKpopAnalysisUpload(42L, "image/png", 0L));
        assertThrows(IllegalArgumentException.class,
                () -> s3Service.createKpopAnalysisUpload(
                        42L,
                        "image/webp",
                        10L * 1024 * 1024 + 1
                ));

        verifyNoInteractions(s3Presigner);
    }

    @Test
    void validatesUploadedObjectMetadataAndOwnership() {
        String key = "kpop-analysis/42/04bfcf59-7ccb-4aa7-b52e-5da19aef72fa.webp";
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(
                HeadObjectResponse.builder()
                        .contentType("image/webp")
                        .contentLength(4096L)
                        .serverSideEncryption(ServerSideEncryption.AES256)
                        .build()
        );

        s3Service.validateKpopAnalysisObject(key, 42L, "image/webp");

        ArgumentCaptor<HeadObjectRequest> captor = ArgumentCaptor.forClass(HeadObjectRequest.class);
        verify(s3Client).headObject(captor.capture());
        assertEquals("test-bucket", captor.getValue().bucket());
        assertEquals(key, captor.getValue().key());
    }

    @Test
    void rejectsForeignObjectBeforeHeadOrDelete() {
        String foreignKey = "kpop-analysis/7/04bfcf59-7ccb-4aa7-b52e-5da19aef72fa.png";

        assertThrows(IllegalArgumentException.class,
                () -> s3Service.validateKpopAnalysisObject(foreignKey, 42L, "image/png"));
        assertThrows(IllegalArgumentException.class,
                () -> s3Service.deleteKpopAnalysisObject(foreignKey, 42L));

        verifyNoInteractions(s3Client);
    }

    @Test
    void rejectsMismatchedOversizedOrUnencryptedObject() {
        String key = "kpop-analysis/42/04bfcf59-7ccb-4aa7-b52e-5da19aef72fa.png";
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(validHead("image/jpeg", 100L, ServerSideEncryption.AES256))
                .thenReturn(validHead("image/png", 10L * 1024 * 1024 + 1,
                        ServerSideEncryption.AES256))
                .thenReturn(validHead("image/png", 100L, null));

        assertThrows(IllegalArgumentException.class,
                () -> s3Service.validateKpopAnalysisObject(key, 42L, "image/png"));
        assertThrows(IllegalArgumentException.class,
                () -> s3Service.validateKpopAnalysisObject(key, 42L, "image/png"));
        assertThrows(IllegalArgumentException.class,
                () -> s3Service.validateKpopAnalysisObject(key, 42L, "image/png"));
    }

    @Test
    void deletesOwnedSourceObject() {
        String key = "kpop-analysis/42/04bfcf59-7ccb-4aa7-b52e-5da19aef72fa.jpg";

        s3Service.deleteKpopAnalysisObject(key, 42L);

        ArgumentCaptor<DeleteObjectRequest> captor =
                ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(captor.capture());
        assertEquals("test-bucket", captor.getValue().bucket());
        assertEquals(key, captor.getValue().key());
        verify(s3Client, never()).headObject(any(HeadObjectRequest.class));
    }

    private HeadObjectResponse validHead(
            String contentType,
            long contentLength,
            ServerSideEncryption encryption
    ) {
        return HeadObjectResponse.builder()
                .contentType(contentType)
                .contentLength(contentLength)
                .serverSideEncryption(encryption)
                .build();
    }
}
