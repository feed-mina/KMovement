package com.domain.kride.domain.token.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;
@Getter
@NoArgsConstructor(access = lombok.AccessLevel.PROTECTED)
@RedisHash(value = "refreshToken") // 시간을 여기서 정하지 말고 필드로 관리하자
public class RefreshToken {

    @Id
    private Long userSqno; // Redis의 Key가 됨 (예: refreshToken:1)

    private String email;
    private String refreshToken;

    @TimeToLive
    private Long expiration; // 초(second) 단위로 저장하면 Redis가 자동으로 관리해줘

    public RefreshToken(Long userSqno, String email, String refreshToken, Long expiration) {
        this.userSqno = userSqno;
        this.email = email;
        this.refreshToken = refreshToken;
        this.expiration = expiration;
    }
}
