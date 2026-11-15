package com.domain.kride.global.config;

import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor // 생성자 주입 자동화 
public class CustomUserDetailsService implements UserDetailsService { // [필수] 인터페이스 구현 추가 

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        // 1. DB에서 유저 엔티티를 찾는다 
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다: " + email));

        // 2. [핵심] 찾은 'user' 객체 자체를 생성자에 넘긴다 
        //Found 에러가 났던 4개의 인자(String, Long 등)를 모두 지우고 user 객체 하나만 전달하세요.
        return new CustomUserDetails(user);
    }
}