package com.domain.kride.domain.ai.client;

import com.google.api.gax.core.FixedCredentialsProvider;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.documentai.v1.*;
import com.google.protobuf.ByteString;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.FileInputStream;
import java.io.IOException;

/**
 * Google Document AI — PDF OCR 클라이언트
 * PDF 바이트 배열을 받아 텍스트를 추출합니다.
 * 프로세서: Document OCR (processor-id: 6ed87cfefab39a91, region: us)
 */
@Slf4j
@Component
public class GoogleDocumentAiClient {

    @Value("${cloud.gcp.document-ai.project-id}")
    private String projectId;

    @Value("${cloud.gcp.document-ai.location}")
    private String location;

    @Value("${cloud.gcp.document-ai.processor-id}")
    private String processorId;

    @Value("${cloud.gcp.document-ai.credentials-path}")
    private String credentialsPath;

    /**
     * PDF 바이트 → OCR 텍스트 추출
     * S3에서 다운로드한 PDF 바이트를 받아 Document AI에 전달합니다.
     */
    public String extractTextFromPdf(byte[] pdfBytes) throws IOException {
        String processorName = String.format(
                "projects/%s/locations/%s/processors/%s",
                projectId, location, processorId);

        GoogleCredentials credentials = GoogleCredentials
                .fromStream(new FileInputStream(credentialsPath))
                .createScoped("https://www.googleapis.com/auth/cloud-platform");

        DocumentProcessorServiceSettings settings = DocumentProcessorServiceSettings.newBuilder()
                .setEndpoint(location + "-documentai.googleapis.com:443")
                .setCredentialsProvider(FixedCredentialsProvider.create(credentials))
                .build();

        try (DocumentProcessorServiceClient client = DocumentProcessorServiceClient.create(settings)) {
            RawDocument rawDocument = RawDocument.newBuilder()
                    .setContent(ByteString.copyFrom(pdfBytes))
                    .setMimeType("application/pdf")
                    .build();

            ProcessRequest request = ProcessRequest.newBuilder()
                    .setName(processorName)
                    .setRawDocument(rawDocument)
                    .build();

            ProcessResponse response = client.processDocument(request);
            String text = response.getDocument().getText();
            log.info("[DocumentAI] OCR 완료: 추출 {}자", text.length());
            return text;
        }
    }
}
