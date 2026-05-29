package com.domain.demo_backend.domain.user.controller;

import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.domain.token.domain.TokenResponse;
import com.domain.demo_backend.domain.user.dto.KakaoAuthRequest;
import com.domain.demo_backend.domain.user.dto.KakaoUserInfo;
import com.domain.demo_backend.domain.user.service.KakaoService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.domain.demo_backend.global.security.JwtUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/api/kakao")
@Tag(name = " 카카오 로그인 컨트롤러", description = "카카오 로그인, 나에게 보내기 ")
public class KakaoController {
    private static final String KAKAO_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
    // application.properties 에 있는 값 불러오기
    private final Logger log = LoggerFactory.getLogger(KakaoController.class);
    private final RefreshTokenRepository refreshTokenRepository;
    private final KakaoService kakaoService;
    private final JwtUtil jwtUtil;
    private final WebClient webClient;

    @Value("${app.url.web}")
    private String webUrl;

    @Value("${app.url.mobile}")
    private String mobileUrl;

    @Value("${kakao.client-id}")
    private String clientId;

    @Value("${kakao.redirect-uri}")
    private String redirectUri;

    private String accessToken;

    // 생성자 주입
    @Autowired
    public KakaoController(RefreshTokenRepository refreshTokenRepository, KakaoService kakaoService,
                           JwtUtil jwtUtil, WebClient.Builder webClientBuilder) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.kakaoService = kakaoService;
        this.jwtUtil = jwtUtil;
        this.webClient = webClientBuilder.build();
    }

    @PostMapping("/login")
    public ResponseEntity<?> kakaoLogin(@RequestBody KakaoAuthRequest kakaoAuthRequest, HttpServletResponse response) {

        try {
            // 로그로 디버그 정보 출력
            log.info("카카오 로그인 시도");
            log.info("KAKAOCONTROLLER-kakao login");
            log.info("KAKAOCONTROLLER-client_id : " + clientId);
            log.info("KAKAOCONTROLLER-redirectUri : " + redirectUri);

            // 1. 받은 AccessToken으로 카카오에서 사용자 정보를 가져와
            KakaoUserInfo kakaoUserInfo = kakaoService.getKakaoUserInfo(kakaoAuthRequest.getAccessToken());

            // 2. 사용자 정보를 이용해 DB에 회원가입 또는 조회를 진행해
            // /login은 프론트엔드가 OAuth 처리 후 access_token만 전달 → refresh_token 없음
            TokenResponse tokenResponse = kakaoService.registerKakaoUser(kakaoUserInfo,
                    kakaoAuthRequest.getAccessToken(), null, null);

            // 5. Refresh Token 쿠키 생성
            ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", tokenResponse.getRefreshToken())
                    .httpOnly(true)
                    .secure(false)
                    .path("/")
                    .maxAge(7 * 24 * 60 * 60)
                    .sameSite("Lax")
                    .build();

            // 6. Role 쿠키 생성 (RBAC용)
            ResponseCookie roleCookie = ResponseCookie.from("role", tokenResponse.getRole())
                    .httpOnly(false)
                    .secure(false)
                    .path("/")
                    .maxAge(3600)
                    .sameSite("Lax")
                    .build();

            response.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, roleCookie.toString())
                    .body(Map.of(
                            "accessToken", tokenResponse.getAccessToken(),
                            "refreshToken", tokenResponse.getRefreshToken(),
                            "kakaoUserInfo", kakaoUserInfo));

        } catch (Exception e) {
            log.error(" 카카오 로그인 실패", e);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("카카오 로그인 실패");
        }
    }

    @GetMapping("/callback")
    public ResponseEntity<?> getAccessToken(@RequestParam String code, @RequestParam(required = false) String state,
            HttpServletResponse response) {
        log.info("KAKAOCONTROLLER-code: " + code);

        log.info("KAKAOCONTROLLER-@@@@@@@@@@@@@@@@@@@@@@@@");
        log.info("KAKAOCONTROLLER-kakao callback");
        log.info("KAKAOCONTROLLER-client_id : " + clientId);
        log.info("KAKAOCONTROLLER-redirectUri : " + redirectUri);
        log.info("KAKAOCONTROLLER-code : " + code);

        MultiValueMap<String, String> formParams = new LinkedMultiValueMap<>();
        formParams.add("grant_type", "authorization_code");
        formParams.add("client_id", clientId);
        formParams.add("redirect_uri", redirectUri);
        formParams.add("code", code);

        @SuppressWarnings("unchecked")
        Map<String, Object> tokenBody = webClient.post()
                .uri("https://kauth.kakao.com/oauth/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .bodyValue(formParams)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String kakaoAccessToken = (String) tokenBody.get("access_token");
        String kakaoRefreshToken = (String) tokenBody.get("refresh_token");
        Integer expiresIn = (Integer) tokenBody.getOrDefault("expires_in", 21600);
        LocalDateTime tokenExpiresAt = LocalDateTime.now().plusSeconds(expiresIn);

        // 2. 사용자 정보 조회
        KakaoUserInfo userInfo = kakaoService.getKakaoUserInfo(kakaoAccessToken);

        // 3. JWT 발급 (토큰 저장 포함)
        TokenResponse jwtToken = kakaoService.registerKakaoUser(userInfo, kakaoAccessToken, kakaoRefreshToken,
                tokenExpiresAt);

        // 4. Access Token 쿠키 생성
        ResponseCookie accessTokenCookie = ResponseCookie.from("accessToken", jwtToken.getAccessToken())
                .httpOnly(true)
                .secure(false) // 로컬 테스트 시 false로 설정해야 쿠키가 보임
                .path("/")
                .maxAge(3600)
                .sameSite("Lax") // 로컬 테스트용
                .build();

        // 5. Refresh Token 쿠키 생성
        ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", jwtToken.getRefreshToken())
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(7 * 24 * 60 * 60)
                .sameSite("Lax")
                .build();

        // 6. Role 쿠키 생성 (RBAC용)
        ResponseCookie roleCookie = ResponseCookie.from("role", jwtToken.getRole())
                .httpOnly(false)
                .secure(false)
                .path("/")
                .maxAge(3600)
                .sameSite("Lax")
                .build();

        // 일반 로그인/카카오 로그인 성공 로직에 추가
        ResponseCookie loginTypeCookie = ResponseCookie.from("loginType", "K")
                .httpOnly(false) // 프론트엔드 자바스크립트가 읽을 수 있어야 하므로 false
                .path("/")
                .maxAge(3600)
                .build();

        // state 값이 없으면 기본적으로 'web'으로 간주
        String platform = (state != null) ? state : "web";

        if ("mobile".equals(platform)) {
            response.addHeader(HttpHeaders.SET_COOKIE, loginTypeCookie.toString());
            response.addHeader(HttpHeaders.SET_COOKIE, accessTokenCookie.toString());
            response.addHeader(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());
            response.addHeader(HttpHeaders.SET_COOKIE, roleCookie.toString());
            // JSON 응답 반환 (Next.js API Route 호환)
            Map<String, Object> responseBody = new HashMap<>();
            responseBody.put("accessToken", jwtToken.getAccessToken());
            responseBody.put("refreshToken", jwtToken.getRefreshToken());
            responseBody.put("role", jwtToken.getRole());
            responseBody.put("message", "카카오 로그인 성공");
            responseBody.put("platform", platform);
            log.info("KAKAOCONTROLLER-response: role={}, platform={}", jwtToken.getRole(), platform);
            return ResponseEntity.ok(responseBody);
        }
        HttpHeaders redirectHeaders = new HttpHeaders();
        redirectHeaders.setLocation(URI.create(webUrl));
        redirectHeaders.add(HttpHeaders.SET_COOKIE, loginTypeCookie.toString());
        redirectHeaders.add(HttpHeaders.SET_COOKIE, accessTokenCookie.toString());
        redirectHeaders.add(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString());
        redirectHeaders.add(HttpHeaders.SET_COOKIE, roleCookie.toString());
        return new ResponseEntity<>(redirectHeaders, HttpStatus.FOUND);
    }

    @PostMapping("/sendRecord")
    public ResponseEntity<String> sendRecord(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> data) throws JsonProcessingException {

        log.info("KAKAOCONTROLLER- Received Authorization header: {}", authorization);

        // Authorization 헤더 검증
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            log.error(" Authorization 헤더가 없거나 잘못됨: {}", authorization);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("카카오 토큰이 필요합니다.");
        }

        String kakaoAccessToken = (String) data.get("kakaoAccessToken");
        log.info("KAKAOCONTROLLER-📩 Kakao AccessToken from body: {}", kakaoAccessToken);
        // JWT 검증
        String jwtToken = authorization.substring(7);
        log.info("KAKAOCONTROLLER- Extracted Access Token: {}", jwtToken);

        log.error("@@@@@jwtToken", jwtToken);
        if (jwtToken.isEmpty()) {
            log.error(" 추출한 Access Token이 비어 있음");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("유효하지 않은 토큰");
        }

        // 카카오 사용자 정보 조회
        KakaoUserInfo kakaoUserInfo;
        try {
            kakaoUserInfo = kakaoService.getKakaoUserInfo(kakaoAccessToken);
            // userInfo 응답 body 예시 출력
            log.debug("Kakao UserInfo: {}", kakaoUserInfo);

            log.error("@@@@@kakaoUserInfo", kakaoUserInfo);
        } catch (Exception e) {
            log.error(" 카카오 사용자 정보 조회 실패", e);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("카카오 사용자 정보 조회 실패");
        }

        // 클라이언트 로그인 유도 (필요 시)
        if (clientId == null || redirectUri == null) {
            String loginUrl = "https://kauth.kakao.com/oauth/authorize?response_type=code&client_id="
                    + clientId + "&redirect_uri=" + redirectUri;
            log.info("KAKAOCONTROLLER- 로그인이 필요해요. 로그인 페이지로 이동!");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(loginUrl);
        }

        // 전송할 데이터 정리
        Integer stopwatchTime = (Integer) data.getOrDefault("stopwatchTime", 0);
        Integer pomodoroCount = (Integer) data.getOrDefault("pomodoroCount", 0);
        Integer pomodoroTotalTime = (Integer) data.getOrDefault("pomodoroTotalTime", 0);

        String recordUrl = (String) data.getOrDefault("recordUrl", "https://yerin.duckdns.org");
        log.info("KAKAOCONTROLLER- stopwatchTime: {}초, pomodoroCount: {}회, pomodoroTotalTime: {}분",
                stopwatchTime, pomodoroCount, pomodoroTotalTime);
        log.info("KAKAOCONTROLLER- recordUrl: {}", recordUrl);

        // 메시지 구성
        StringBuilder message = new StringBuilder();

        if (stopwatchTime > 0) {
            int minutes = stopwatchTime / 60;
            int seconds = stopwatchTime % 60;
            message.append("⏱️ 스탑워치 기록: ").append(minutes).append("분 ").append(seconds).append("초\n");
        }

        if (pomodoroCount > 0 && pomodoroTotalTime > 0) {
            message.append(" 뽀모도로: ").append(pomodoroCount)
                    .append("회, 총 ").append(pomodoroTotalTime).append("분 완료!");
        }

        if (message.length() == 0) {
            message.append(" 기록이 없어요.");
        }
        ObjectMapper objectMapper = new ObjectMapper();

        String messageText = message.toString();

        Map<String, Object> messageMap = Map.of(
                "object_type", "text",
                "text", messageText, // 여기 messageText는 그대로 써도 됨 (줄바꿈, 특수문자 포함 가능)
                "link", Map.of(
                        "web_url", recordUrl,
                        "mobile_web_url", recordUrl));

        String templateObject = objectMapper.writeValueAsString(messageMap);

        log.info("KAKAOCONTROLLER- 최종 메시지: {}", messageText);

        // 카카오톡 메시지 전송 준비
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("template_object", templateObject);

        log.info("KAKAOCONTROLLER- 카카오 API 요청 전송 중...");

        // 카카오 API 요청 전송
        try {
            webClient.post()
                    .uri(KAKAO_URL)
                    .header("Authorization", "Bearer " + kakaoAccessToken)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue(params)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("KAKAOCONTROLLER- 카카오톡 메시지 전송 성공!");
            return ResponseEntity.ok("카톡 전송 성공!");
        } catch (WebClientResponseException e) {
            log.error(" 카톡 전송 실패! 오류: {}", e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body("카톡 전송 실패! 오류: " + e.getResponseBodyAsString());
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@AuthenticationPrincipal CustomUserDetails userDetails,
            HttpServletResponse response) {
        // 1. Redis에서 리프레시 토큰 삭제
        if (userDetails != null) {
            refreshTokenRepository.deleteById(userDetails.getUserSqno()); // 사용자 고유 번호로 토큰 삭제
        }

        // 모든 인증 관련 쿠키 일괄 삭제
        String[] cookiesToClear = { "accessToken", "refreshToken", "loginType" };
        for (String cookieName : cookiesToClear) {
            ResponseCookie cookie = ResponseCookie.from(cookieName, "")
                    .path("/")
                    .maxAge(0)
                    .httpOnly(!cookieName.equals("loginType"))
                    .secure(false)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        }

        return ResponseEntity.ok().body("로컬 로그아웃 성공");
    }

    // KakaoController.java 내부 하단에 추가
    private void addAuthCookies(HttpServletResponse response, TokenResponse tokens, String type) {
        // 1. Access Token (HttpOnly)
        ResponseCookie access = ResponseCookie.from("accessToken", tokens.getAccessToken())
                .path("/").maxAge(3600).httpOnly(true).secure(false).sameSite("Lax").build();

        // 2. Refresh Token (HttpOnly)
        ResponseCookie refresh = ResponseCookie.from("refreshToken", tokens.getRefreshToken())
                .path("/").maxAge(7 * 24 * 60 * 60).httpOnly(true).secure(false).sameSite("Lax").build();

        // 3. Login Type Flag (일반 쿠키 - 프론트엔드 노출용)
        ResponseCookie loginType = ResponseCookie.from("loginType", type)
                .path("/").maxAge(3600).httpOnly(false).build();

        response.addHeader(HttpHeaders.SET_COOKIE, access.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refresh.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, loginType.toString());
    }
}