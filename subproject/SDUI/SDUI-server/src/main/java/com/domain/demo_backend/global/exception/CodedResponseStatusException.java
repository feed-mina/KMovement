package com.domain.demo_backend.global.exception;

import org.springframework.http.HttpStatusCode;
import org.springframework.web.server.ResponseStatusException;

public class CodedResponseStatusException extends ResponseStatusException {

    private final String code;

    public CodedResponseStatusException(HttpStatusCode status, String code, String reason) {
        super(status, reason);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
