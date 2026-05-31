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
            // 배포 환경(Docker)에서는 /app/firebase-adminsdk.json 에 마운트됩니다.
            // 로컬 개발 환경에서는 src/main/resources/firebase-adminsdk.json 을 찾습니다.
            String path = "/app/firebase-adminsdk.json";
            java.io.File file = new java.io.File(path);
            if (!file.exists()) {
                path = "src/main/resources/firebase-adminsdk.json";
            }
            
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
            log.warn("Firebase credentials not found or invalid. FCM will not work until this is configured.");
        }
    }
}
