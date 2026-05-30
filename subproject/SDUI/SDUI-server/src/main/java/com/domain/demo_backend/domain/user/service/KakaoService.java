package com.domain.demo_backend.domain.user.service;

import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.domain.token.domain.TokenResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.dto.KakaoUserInfo;
import com.domain.demo_backend.global.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class KakaoService {
    private static final String KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final WebClient webClient;
    private final Logger log = LoggerFactory.getLogger(KakaoService.class);

    @Value("${kakao.client-id}")
    private String clientId;

    public KakaoService(RefreshTokenRepository refreshTokenRepository, JwtUtil jwtUtil,
                        UserRepository userRepository, WebClient.Builder webClientBuilder) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.webClient = webClientBuilder.build();
    }

    public KakaoUserInfo getKakaoUserInfo(String accessToken) {
        log.info("KAKAOSERVICE-@@@@@@@@@@@@@@@@@@@@@@@@");
        log.info("KAKAOSERVICE-getKakaoUserInfo");
        log.info("KAKAOSERVICE-accessToken : " + accessToken);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = webClient.get()
                .uri("https://kapi.kakao.com/v2/user/me")
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (body == null) {
            throw new RuntimeException("카카오에서 사용자 정보를 받지 못했어요!");
        }

        log.info("KAKAOSERVICE-body : " + body);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> kakaoAccount = (Map<String, Object>) body.get("kakao_account");
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) body.get("properties");

            Long id = ((Number) body.get("id")).longValue();

            String nickname = (properties != null) ? (String) properties.get("nickname") : null;
            if (nickname == null || nickname.isBlank()) {
                nickname = "kakao_" + id;
            }

            String email = null;
            if (kakaoAccount != null && kakaoAccount.get("email") != null) {
                email = kakaoAccount.get("email").toString();
            }
            if (email == null || email.isBlank()) {
                email = "kakao_" + id + "@noemail.kakao";
            }

            log.info("KAKAOSERVICE-nickname : {}, email : {}", nickname, email);

        } catch (Exception e) {
            log.error("카카오 사용자 정보 가져오기 실패", e);
            throw new RuntimeException("카카오 사용자 정보 가져오기 실패: " + e.getMessage());
        }
        return KakaoUserInfo.fromMap(body, accessToken);
    }

    @Transactional
    public TokenResponse registerKakaoUser(KakaoUserInfo kakaoUserInfo, String accessToken,
                                            String refreshToken, LocalDateTime tokenExpiresAt) {
        log.info("KAKAOSERVICE-사용자 확인: {}", kakaoUserInfo.getEmail());

        User user = userRepository.findByEmail(kakaoUserInfo.getEmail())
                .map(existingUser -> {
                    // 탈퇴한 유저라면 재활성화
                    if ("Y".equals(existingUser.getDelYn())) {
                        existingUser.setDelYn("N");
                        existingUser.setUpdatedAt(LocalDateTime.now());
                    }
                    // 카카오 토큰 갱신 (로그인할 때마다 최신 토큰 유지)
                    existingUser.setKakaoAccessToken(accessToken);
                    if (refreshToken != null) existingUser.setKakaoRefreshToken(refreshToken);
                    if (tokenExpiresAt != null) existingUser.setKakaoTokenExpiresAt(tokenExpiresAt);
                    return existingUser;
                })
                .orElseGet(() -> {
                    log.info("KAKAOSERVICE-신규 카카오 유저 가입");
                    return userRepository.save(User.builder()
                            .userId(kakaoUserInfo.getEmail().split("@")[0])
                            .password("") // 소셜 로그인은 비밀번호가 의미 없음
                            .hashedPassword("")
                            .email(kakaoUserInfo.getEmail())
                            .phone("111-111-111")
                            .role("ROLE_GUEST")  // 신규 카카오 사용자는 GUEST로 시작
                            .verifyYn("Y")
                            .socialType("K")
                            .delYn("N")
                            .kakaoAccessToken(accessToken)
                            .kakaoRefreshToken(refreshToken)
                            .kakaoTokenExpiresAt(tokenExpiresAt)
                            .createdAt(LocalDateTime.now())
                            .build());
                });

        return jwtUtil.generateTokens(user);
    }

    /**
     * 카카오 액세스 토큰을 리프레시 토큰으로 갱신한다.
     * 갱신된 토큰은 DB에 저장된다.
     *
     * @return 새 액세스 토큰 (갱신 실패 시 기존 토큰 반환)
     */
    @Transactional
    public String refreshKakaoToken(User user) {
        if (user.getKakaoRefreshToken() == null) {
            log.warn("KAKAOSERVICE-refreshKakaoToken: 리프레시 토큰 없음. userId={}", user.getUserId());
            return user.getKakaoAccessToken();
        }

        try {
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("grant_type", "refresh_token");
            params.add("client_id", clientId);
            params.add("refresh_token", user.getKakaoRefreshToken());

            @SuppressWarnings("unchecked")
            Map<String, Object> body = webClient.post()
                    .uri(KAKAO_TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue(params)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            if (body == null) throw new RuntimeException("빈 응답");

            String newAccessToken = (String) body.get("access_token");
            Integer expiresIn = (Integer) body.get("expires_in");
            String newRefreshToken = (String) body.get("refresh_token"); // 새 리프레시 토큰 (있는 경우)

            user.setKakaoAccessToken(newAccessToken);
            user.setKakaoTokenExpiresAt(LocalDateTime.now().plusSeconds(expiresIn != null ? expiresIn : 21600));
            if (newRefreshToken != null) user.setKakaoRefreshToken(newRefreshToken);
            userRepository.save(user);

            log.info("KAKAOSERVICE-토큰 갱신 성공. userId={}", user.getUserId());
            return newAccessToken;

        } catch (Exception e) {
            log.error("KAKAOSERVICE-토큰 갱신 실패. userId={}", user.getUserId(), e);
            return user.getKakaoAccessToken();
        }
    }
}
