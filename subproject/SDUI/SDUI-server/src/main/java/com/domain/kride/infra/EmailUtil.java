package com.domain.kride.infra;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class EmailUtil {
    private final Map<String, String> verificationCodes = new HashMap<>();

    public void sendVerificationCode(String email) {
        String code = generateCode();
        verificationCodes.put(email, code);
    }

    public boolean validationVerificationCode(String email, String code) {
        return verificationCodes.containsKey(email) && verificationCodes.get(email).equals(code);
    }

    private String generateCode() {
        return String.valueOf((int) (Math.random() * 9000 + 1000));
    }
}
