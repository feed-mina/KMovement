package com.domain.kride.global.exception.custom;

import com.domain.kride.global.exception.BusinessException;
import org.springframework.http.HttpStatus;

/**
 * 이메일 중복 예외
 */
public class DuplicateEmailException extends BusinessException {

    public DuplicateEmailException() {
        super("이미 사용 중인 이메일입니다", HttpStatus.CONFLICT);
    }

    public DuplicateEmailException(String email) {
        super(String.format("이미 사용 중인 이메일입니다: %s", email), HttpStatus.CONFLICT);
    }
}
