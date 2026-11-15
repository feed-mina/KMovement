package com.domain.kride.global.exception.custom;

import com.domain.kride.global.exception.BusinessException;
import org.springframework.http.HttpStatus;

/**
 * 전화번호 중복 예외
 */
public class DuplicatePhoneException extends BusinessException {

    public DuplicatePhoneException() {
        super("이미 사용 중인 전화번호입니다", HttpStatus.CONFLICT);
    }

    public DuplicatePhoneException(String phone) {
        super(String.format("이미 사용 중인 전화번호입니다: %s", phone), HttpStatus.CONFLICT);
    }
}
