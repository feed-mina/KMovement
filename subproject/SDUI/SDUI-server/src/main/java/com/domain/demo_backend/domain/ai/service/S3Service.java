package com.domain.demo_backend.domain.ai.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    private static final Set<String> ALLOWED_RESUME_TYPES = Set.of(
            "application/pdf", "image/jpeg", "image/png", "image/webp"
    );
    private static final long MAX_RESUME_SIZE = 50 * 1024 * 1024; // 50MB
    private static final Set<String> ALLOWED_KPOP_ANALYSIS_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );
    private static final long MAX_KPOP_ANALYSIS_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Duration KPOP_UPLOAD_URL_TTL = Duration.ofMinutes(10);

    public record KpopAnalysisUpload(
            String key,
            String url,
            Map<String, String> headers,
            Instant expiresAt
    ) {
    }

    /**
     * 이력서 파일 업로드 → S3 key 반환
     * key: resume/{userId}/{uuid}.{ext}
     * SSE-S3 서버 측 암호화 적용
     */
    public String uploadResumeFile(MultipartFile file, Long userId) throws IOException {
        if (file.getSize() > MAX_RESUME_SIZE) {
            throw new IllegalArgumentException("파일 크기는 50MB를 초과할 수 없습니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_RESUME_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("허용되지 않는 파일 형식입니다. (PDF, JPEG, PNG, WebP만 가능)");
        }
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase()
                : "bin";
        String key = "resume/" + userId + "/" + UUID.randomUUID() + "." + ext;

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(file.getContentType())
                        .serverSideEncryption(ServerSideEncryption.AES256)
                        .build(),
                RequestBody.fromBytes(file.getBytes())
        );

        log.info("S3 이력서 업로드 완료: userId={}, key={}, size={}B", userId, key, file.getSize());
        return key;
    }

    /**
     * Creates a short-lived PUT URL for one K-POP analysis source image.
     * The key is scoped to the authenticated user and the signed request pins
     * the content type, byte length, and SSE-S3 encryption mode.
     */
    public KpopAnalysisUpload createKpopAnalysisUpload(
            Long userSqno,
            String contentType,
            long fileSize
    ) {
        requireValidUserSqno(userSqno);
        String normalizedContentType = normalizeKpopContentType(contentType);
        requireValidKpopFileSize(fileSize);

        String key = kpopOwnerPrefix(userSqno)
                + UUID.randomUUID()
                + extensionFor(normalizedContentType);
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(normalizedContentType)
                .contentLength(fileSize)
                .serverSideEncryption(ServerSideEncryption.AES256)
                .build();
        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(KPOP_UPLOAD_URL_TTL)
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);
        Map<String, String> headers = Map.of(
                "Content-Type", normalizedContentType,
                "x-amz-server-side-encryption", ServerSideEncryption.AES256.toString()
        );

        log.info("Created K-POP analysis upload URL: userSqno={}, key={}, size={}B",
                userSqno, key, fileSize);
        return new KpopAnalysisUpload(
                key,
                presigned.url().toString(),
                headers,
                presigned.expiration()
        );
    }

    /**
     * Verifies that a previously uploaded object still belongs to the caller
     * and matches the constraints signed into the upload request.
     */
    public void validateKpopAnalysisObject(
            String key,
            Long userSqno,
            String expectedContentType
    ) {
        assertOwnedKpopKey(key, userSqno);
        String normalizedExpectedType = normalizeKpopContentType(expectedContentType);

        HeadObjectResponse response = s3Client.headObject(HeadObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build());
        String actualContentType;
        try {
            actualContentType = normalizeKpopContentType(response.contentType());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Uploaded object has an unsupported content type.", ex);
        }
        if (!normalizedExpectedType.equals(actualContentType)) {
            throw new IllegalArgumentException("Uploaded object content type does not match the request.");
        }
        Long contentLength = response.contentLength();
        if (contentLength == null || contentLength <= 0 || contentLength > MAX_KPOP_ANALYSIS_SIZE) {
            throw new IllegalArgumentException("Uploaded object must be between 1 byte and 10MB.");
        }
        if (response.serverSideEncryption() != ServerSideEncryption.AES256) {
            throw new IllegalArgumentException("Uploaded object must use AES256 server-side encryption.");
        }
    }

    /** Deletes only an object from the authenticated user's K-POP prefix. */
    public void deleteKpopAnalysisObject(String key, Long userSqno) {
        assertOwnedKpopKey(key, userSqno);
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build());
        log.info("Deleted K-POP analysis source: userSqno={}, key={}", userSqno, key);
    }

    /**
     * 이미지용 Presigned URL 생성 (GPT-4o Vision API에 직접 전달)
     * 기본 만료: 15분
     */
    public String generatePresignedUrl(String key, int expiryMinutes) {
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(expiryMinutes))
                .getObjectRequest(r -> r.bucket(bucket).key(key))
                .build();

        PresignedGetObjectRequest presigned = s3Presigner.presignGetObject(presignRequest);
        String url = presigned.url().toString();
        log.info("S3 Presigned URL 생성: key={}, expiryMin={}", key, expiryMinutes);
        return url;
    }

    /**
     * PDF 다운로드 → 바이트 배열 (Google Document AI에 전달)
     */
    public byte[] downloadBytes(String key) throws IOException {
        try (ResponseInputStream<GetObjectResponse> stream = s3Client.getObject(
                GetObjectRequest.builder().bucket(bucket).key(key).build())) {
            byte[] bytes = stream.readAllBytes();
            log.info("S3 파일 다운로드: key={}, size={}B", key, bytes.length);
            return bytes;
        }
    }

    /**
     * S3 파일 삭제
     */
    public void deleteFile(String key) {
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket).key(key).build());
        log.info("S3 파일 삭제: key={}", key);
    }

    /**
     * S3 key 확장자 기반 파일 유형 판별
     */
    public String detectFileType(String key) {
        if (key == null) return "unknown";
        String lower = key.toLowerCase();
        if (lower.endsWith(".pdf")) return "pdf";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")
                || lower.endsWith(".png") || lower.endsWith(".webp")) return "image";
        return "unknown";
    }

    private String normalizeKpopContentType(String contentType) {
        if (contentType == null) {
            throw new IllegalArgumentException("A content type is required.");
        }
        String normalized = contentType.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_KPOP_ANALYSIS_TYPES.contains(normalized)) {
            throw new IllegalArgumentException("Only JPEG, PNG, and WebP images are supported.");
        }
        return normalized;
    }

    private void requireValidKpopFileSize(long fileSize) {
        if (fileSize <= 0 || fileSize > MAX_KPOP_ANALYSIS_SIZE) {
            throw new IllegalArgumentException("Image size must be between 1 byte and 10MB.");
        }
    }

    private void assertOwnedKpopKey(String key, Long userSqno) {
        requireValidUserSqno(userSqno);
        String prefix = kpopOwnerPrefix(userSqno);
        if (key == null || !key.startsWith(prefix) || key.length() <= prefix.length()) {
            throw new IllegalArgumentException("The source object does not belong to this user.");
        }
        String objectName = key.substring(prefix.length());
        if (objectName.contains("/") || objectName.contains("\\")) {
            throw new IllegalArgumentException("The source object key is invalid.");
        }
    }

    private void requireValidUserSqno(Long userSqno) {
        if (userSqno == null || userSqno <= 0) {
            throw new IllegalArgumentException("A valid user is required.");
        }
    }

    private String kpopOwnerPrefix(Long userSqno) {
        return "kpop-analysis/" + userSqno + "/";
    }

    private String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> throw new IllegalArgumentException("Unsupported content type.");
        };
    }
}
