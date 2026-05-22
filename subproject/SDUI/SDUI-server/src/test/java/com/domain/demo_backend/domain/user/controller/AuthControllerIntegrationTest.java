package com.domain.demo_backend.domain.user.controller;

import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.service.AuthService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.domain.demo_backend.global.security.PasswordUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "jwt.secret=test_secret_key_must_be_at_least_32_bytes_long_for_security",
        "jwt.expiration=3600000",
        "jwt.refresh-token.expiration=86400000"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("AuthController 통합 테스트")
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuthService authService;

    private User testUser;
    private final String TEST_EMAIL = "authtest@example.com";
    private final String TEST_PASSWORD = "TestPass123!";

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .userId("authtest")
                .email(TEST_EMAIL)
                .hashedPassword(PasswordUtil.sha256(TEST_PASSWORD))
                .role("ROLE_USER")
                .phone("010-5555-6666")
                .zipCode("12345")
                .roadAddress("서울시 강남구")
                .delYn("N")
                .verifyYn("Y")
                .socialType("N")
                .build();
        testUser = userRepository.save(testUser);
    }

    // ── 로그인 테스트 ──

    @Nested
    @DisplayName("POST /api/auth/login")
    class LoginTests {

        @Test
        @DisplayName("성공: 올바른 이메일+비밀번호 → 200 + 쿠키 반환")
        void login_success() throws Exception {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"user_email\":\"" + TEST_EMAIL + "\",\"user_pw\":\"" + TEST_PASSWORD + "\"}"))
                    .andExpect(status().isOk())
                    .andExpect(header().exists("Set-Cookie"))
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty());
        }

        @Test
        @DisplayName("실패: 잘못된 비밀번호 → 401")
        void login_wrongPassword() throws Exception {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"user_email\":\"" + TEST_EMAIL + "\",\"user_pw\":\"wrongpass\"}"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("실패: 존재하지 않는 이메일 → 401")
        void login_nonExistentEmail() throws Exception {
            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"user_email\":\"nobody@example.com\",\"user_pw\":\"pass\"}"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("실패: 이메일 미인증 사용자 → 401/403")
        void login_unverifiedUser() throws Exception {
            User unverified = User.builder()
                    .userId("unverified")
                    .email("unverified@example.com")
                    .hashedPassword(PasswordUtil.sha256("pass123"))
                    .role("ROLE_GUEST")
                    .phone("010-7777-8888")
                    .zipCode("99999")
                    .roadAddress("test")
                    .delYn("N")
                    .verifyYn("N")
                    .socialType("N")
                    .build();
            userRepository.save(unverified);

            mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"user_email\":\"unverified@example.com\",\"user_pw\":\"pass123\"}"))
                    .andExpect(status().is4xxClientError());
        }
    }

    // ── 회원가입 테스트 ──

    @Nested
    @DisplayName("POST /api/auth/register")
    class RegisterTests {

        @Test
        @DisplayName("성공: 신규 사용자 가입 → 201")
        void register_success() throws Exception {
            mockMvc.perform(post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{" +
                                    "\"userId\":\"newuser\"," +
                                    "\"password\":\"NewPass123!\"," +
                                    "\"email\":\"newuser@example.com\"," +
                                    "\"phone\":\"010-1111-2222\"," +
                                    "\"zipCode\":\"54321\"," +
                                    "\"roadAddress\":\"부산시 해운대구\"" +
                                    "}"))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("실패: 이미 존재하는 이메일 → 409/400")
        void register_duplicateEmail() throws Exception {
            mockMvc.perform(post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{" +
                                    "\"userId\":\"dup\"," +
                                    "\"password\":\"Pass123!\"," +
                                    "\"email\":\"" + TEST_EMAIL + "\"," +
                                    "\"phone\":\"010-3333-4444\"," +
                                    "\"zipCode\":\"11111\"," +
                                    "\"roadAddress\":\"서울시\"" +
                                    "}"))
                    .andExpect(status().is4xxClientError());
        }

        @Test
        @DisplayName("실패: 주소 정보 누락 → 400")
        void register_missingAddress() throws Exception {
            mockMvc.perform(post("/api/auth/register")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{" +
                                    "\"userId\":\"noaddr\"," +
                                    "\"password\":\"Pass123!\"," +
                                    "\"email\":\"noaddr@example.com\"," +
                                    "\"phone\":\"010-0000-0000\"" +
                                    "}"))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── /api/auth/me 테스트 ──

    @Nested
    @DisplayName("GET /api/auth/me")
    class MeTests {

        @Test
        @DisplayName("인증된 사용자 → isLoggedIn=true, 사용자 정보 반환")
        void me_authenticated() throws Exception {
            mockMvc.perform(get("/api/auth/me")
                            .with(user(new CustomUserDetails(testUser))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isLoggedIn").value(true))
                    .andExpect(jsonPath("$.email").value(TEST_EMAIL))
                    .andExpect(jsonPath("$.role").value("ROLE_USER"));
        }

        @Test
        @DisplayName("미인증 사용자 → isLoggedIn=false, role=GUEST")
        void me_anonymous() throws Exception {
            mockMvc.perform(get("/api/auth/me"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isLoggedIn").value(false))
                    .andExpect(jsonPath("$.role").value("GUEST"));
        }
    }

    // ── 이메일 인증 코드 확인 테스트 ──

    @Nested
    @DisplayName("POST /api/auth/verify-code")
    class VerifyCodeTests {

        @Test
        @DisplayName("실패: 이메일 또는 코드 누락 → 400")
        void verifyCode_missingFields() throws Exception {
            mockMvc.perform(post("/api/auth/verify-code")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + TEST_EMAIL + "\"}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("실패: 잘못된 인증 코드 → 400")
        void verifyCode_wrongCode() throws Exception {
            mockMvc.perform(post("/api/auth/verify-code")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + TEST_EMAIL + "\",\"code\":\"0000000\"}"))
                    .andExpect(status().isBadRequest());
        }
    }

    // ── 로그아웃 테스트 ──

    @Nested
    @DisplayName("POST /api/auth/logout")
    class LogoutTests {

        @Test
        @DisplayName("성공: 쿠키 삭제 + 200")
        void logout_success() throws Exception {
            mockMvc.perform(post("/api/auth/logout"))
                    .andExpect(status().isOk())
                    .andExpect(header().exists("Set-Cookie"));
        }
    }

    // ── 인증 상태 확인 ──

    @Nested
    @DisplayName("GET /api/auth/check-verification")
    class CheckVerificationTests {

        @Test
        @DisplayName("인증된 사용자 → isVerified=true")
        void checkVerification_verified() throws Exception {
            mockMvc.perform(get("/api/auth/check-verification")
                            .param("email", TEST_EMAIL))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isVerified").value(true));
        }

        @Test
        @DisplayName("존재하지 않는 사용자 → isVerified=false")
        void checkVerification_nonExistent() throws Exception {
            mockMvc.perform(get("/api/auth/check-verification")
                            .param("email", "ghost@example.com"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.isVerified").value(false));
        }
    }
}
