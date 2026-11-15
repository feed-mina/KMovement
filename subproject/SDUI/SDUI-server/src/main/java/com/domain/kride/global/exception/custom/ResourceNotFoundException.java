package com.domain.kride.global.exception.custom;

import com.domain.kride.global.exception.BusinessException;
import org.springframework.http.HttpStatus;

/**
 * 리소스를 찾을 수 없음 예외
 */
public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String resourceName) {
        super(String.format("%s을(를) 찾을 수 없습니다", resourceName), HttpStatus.NOT_FOUND);
    }

    public ResourceNotFoundException(String resourceName, Object id) {
        super(String.format("%s을(를) 찾을 수 없습니다 (ID: %s)", resourceName, id), HttpStatus.NOT_FOUND);
    }
}
