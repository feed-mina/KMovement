package com.domain.demo_backend.domain.community.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class SupabaseStorageService {

    @Value("${kride.supabase.url:}")
    private String supabaseUrl;

    @Value("${kride.supabase.key:}")
    private String supabaseKey;

    @Value("${kride.supabase.bucket:kride-community}")
    private String bucket;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"
    );

    public String upload(MultipartFile file, Long postId) throws IOException {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("파일 크기는 10MB를 초과할 수 없습니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("허용되지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 가능)");
        }
        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf("."));
        }
        String storedName = UUID.randomUUID() + ext;
        String objectPath = "community/" + postId + "/" + storedName;

        String uploadUrl = supabaseUrl + "/storage/v1/object/" + bucket + "/" + objectPath;

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + supabaseKey);
        headers.set("apikey", supabaseKey);
        headers.setContentType(MediaType.parseMediaType(
                file.getContentType() != null ? file.getContentType() : "application/octet-stream"));

        HttpEntity<byte[]> entity = new HttpEntity<>(file.getBytes(), headers);

        try {
            restTemplate.exchange(uploadUrl, HttpMethod.POST, entity, String.class);
        } catch (Exception e) {
            log.error("Supabase Storage 업로드 실패: {}", e.getMessage());
            throw new IOException("이미지 업로드에 실패했습니다.", e);
        }

        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + objectPath;
    }

    public String getStoredName(String publicUrl) {
        if (publicUrl == null) return null;
        int lastSlash = publicUrl.lastIndexOf("/");
        return lastSlash >= 0 ? publicUrl.substring(lastSlash + 1) : publicUrl;
    }
}
