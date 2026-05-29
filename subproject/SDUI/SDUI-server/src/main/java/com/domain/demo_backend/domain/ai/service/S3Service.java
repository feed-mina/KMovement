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

import java.io.IOException;
import java.time.Duration;
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
}
