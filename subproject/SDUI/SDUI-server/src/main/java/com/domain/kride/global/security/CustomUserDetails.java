package com.domain.kride.global.security;

import com.domain.kride.domain.user.domain.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

@Getter
public class CustomUserDetails implements UserDetails {

    private final User user; // [수정] final 필드는 생성자에서 반드시 초기화해야 함

    // [수정] 인자를 User 객체 하나만 받도록 일치시킴 
    public CustomUserDetails(User user) {
        this.user = user;
    }


    // 프론트엔드 응답을 위해 필요한 Getter들 
    public Long getUserSqno() { return user.getUserSqno(); }
    public String getUserId() { return user.getUserId(); }
    public String getSocialType() { return user.getSocialType(); }
    public String getUserEmail(){ return user.getEmail();}
    public String getRole() {return user.getRole();}

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // [수정] DB의 role 필드(예: ROLE_USER)를 권한으로 변환
        return Collections.singletonList(new SimpleGrantedAuthority(user.getRole()));
    }

    @Override
    public String getPassword() { return user.getHashedPassword(); }

    @Override
    public String getUsername() { return user.getEmail(); }

    // 계정 상태 체크 (기본값 true)
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return "N".equals(user.getDelYn()); }


}