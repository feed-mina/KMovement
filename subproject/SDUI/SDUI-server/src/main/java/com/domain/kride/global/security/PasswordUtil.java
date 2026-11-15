package com.domain.kride.global.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class PasswordUtil {
    private static final Logger log = LoggerFactory.getLogger(PasswordUtil.class);

    public static String sha256(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    public static String hasPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }


    public static void PasswordCheck(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        // 원래 비밀번호와 암호화된 비밀번호
        String rawPassword = "mypassword";
        String encryptedPassword = encoder.encode(rawPassword);

        // 사용자가 입력한 비밀번호
        String userInput = "mypassword";

        // 비밀번호가 맞는지 확인하기
        boolean isMatch = encoder.matches(userInput, encryptedPassword);

        if (isMatch) {
            log.debug("비밀번호가 일치합니다.");
        } else {
            log.debug("비밀번호가 일치하지 않습니다.");
        }
    }


    public static void PasswordEncryption(String[] args) {

        // 1. BCryptPasswordEncoder 생성하기
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        // 2. 암호화할 비밀번호
        String rawPassword = "mypassword";

        // 3. 비밀번호 암호화하기
        String encryptedPassword = encoder.encode(rawPassword);

        // 결과 출력 (민감정보 로깅 제거)
    }
}

