package com.domain.demo_backend.global.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;

@Configuration
public class FirebaseConfig {
    
    private final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @PostConstruct
    public void init() {
        try {
            // firebase-adminsdk.json 경로 (src/main/resources 아래에 배치하거나 환경 변수 사용)
            // 배포 환경에서는 보통 환경 변수나 절대 경로로 주입받습니다.
            // 여기서는 기본 클래스패스나 특정 디렉토리로 예시 작성 (수정 가능)
            String path = "src/main/resources/firebase-adminsdk.json";
            
            try (FileInputStream serviceAccount = new FileInputStream(path)) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();

                if (FirebaseApp.getApps().isEmpty()) {
                    FirebaseApp.initializeApp(options);
                    log.info("Firebase application initialized successfully.");
                }
            }
        } catch (IOException e) {
            log.warn("Firebase credentials not found or invalid (path: src/main/resources/firebase-adminsdk.json). FCM will not work until this is configured.");
        }
    }
}
