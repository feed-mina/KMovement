package com.domain.kride.domain.user.service;

import com.domain.kride.global.security.CustomUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

public class UserInfoHelper {
    // 현재 로그인된 사용자의 정보를 가져온다. @return MemberInfo 현재 사용자의 정보를 가져오는 객체

    public static CustomUserDetails getMemberInfo() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "인증되지 않은 사용자입니다.");
        }

        if (!(authentication.getPrincipal() instanceof CustomUserDetails)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자 정보가 유효하지 않습니다.");
        }

        return (CustomUserDetails) authentication.getPrincipal();
    }

}