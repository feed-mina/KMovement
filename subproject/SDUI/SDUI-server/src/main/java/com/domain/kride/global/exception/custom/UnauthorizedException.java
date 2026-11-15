package com.domain.kride.global.exception.custom;

import com.domain.kride.global.exception.BusinessException;
import org.springframework.http.HttpStatus;

/**
 * 인증 실패 예외
 */
public class UnauthorizedException extends BusinessException {

    public UnauthorizedException() {
        super("인증이 필요합니다", HttpStatus.UNAUTHORIZED);
    }

    public UnauthorizedException(String message) {
        super(message, HttpStatus.UNAUTHORIZED);
    }
}
