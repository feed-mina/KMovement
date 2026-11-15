package com.domain.kride.domain.study.service;

import com.domain.kride.domain.study.domain.StudyMaterial;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.File;
import java.util.List;
import java.util.Map;

/**
 * Slack Files API v2를 사용해 PDF 파일을 채널에 업로드한다.
 *
 * 업로드 3단계:
 * 1. files.getUploadURLExternal — 업로드 URL + file_id 획득
 * 2. PUT {upload_url}           — 파일 바이너리 전송
 * 3. files.completeUploadExternal — 채널에 파일 공유
 */
@Service
public class SlackFileService {

    private static final Logger log = LoggerFactory.getLogger(SlackFileService.class);
    private static final String SLACK_API = "https://slack.com/api";
    private static final String STUDY_DIR = "/app/assets/study/";

    private final WebClient webClient;

    @Value("${slack.bot-token:}")
    private String botToken;

    @Value("${slack.channel-id:}")
    private String channelId;

    public SlackFileService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public void uploadAndShare(StudyMaterial material) {
        if (botToken == null || botToken.isBlank()) {
            log.debug("Slack bot-token 미설정, 학습자료 발송 skip");
            return;
        }
        if (channelId == null || channelId.isBlank()) {
            log.debug("Slack channel-id 미설정, 학습자료 발송 skip");
            return;
        }

        File file = new File(STUDY_DIR + material.getFilename());
        if (!file.exists()) {
            log.warn("학습자료 파일 없음: {}", file.getAbsolutePath());
            return;
        }

        try {
            // 1단계: 업로드 URL 획득
            Map<?, ?> urlRes = webClient.get()
                    .uri(SLACK_API + "/files.getUploadURLExternal?filename={fn}&length={len}",
                            material.getFilename(), file.length())
                    .header("Authorization", "Bearer " + botToken)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (urlRes == null || !Boolean.TRUE.equals(urlRes.get("ok"))) {
                log.error("Slack 업로드 URL 획득 실패: {}", urlRes);
                return;
            }

            String uploadUrl = (String) urlRes.get("upload_url");
            String fileId    = (String) urlRes.get("file_id");

            // 2단계: 파일 바이너리 전송
            webClient.post()
                    .uri(uploadUrl)
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .bodyValue(new FileSystemResource(file))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            // 3단계: 채널에 파일 공유
            Map<?, ?> completeRes = webClient.post()
                    .uri(SLACK_API + "/files.completeUploadExternal")
                    .header("Authorization", "Bearer " + botToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of(
                            "files", List.of(Map.of("id", fileId, "title", material.getDisplayName())),
                            "channel_id", channelId,
                            "initial_comment", "📚 오늘의 정보처리기사 학습 자료: *" + material.getDisplayName() + "*"
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (completeRes != null && Boolean.TRUE.equals(completeRes.get("ok"))) {
                log.info("학습자료 Slack 발송 완료. filename={}", material.getFilename());
            } else {
                log.error("Slack 파일 공유 실패: {}", completeRes);
            }

        } catch (Exception e) {
            log.error("학습자료 Slack 발송 실패. filename={}", material.getFilename(), e);
        }
    }
}
