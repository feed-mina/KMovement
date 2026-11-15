package com.domain.kride.domain.user.service;

import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import com.domain.kride.domain.user.dto.PasswordDto;
import com.domain.kride.global.security.PasswordUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "jwt.secret=test_secret_key_must_be_at_least_32_bytes_long_for_security",
        "jwt.expiration=3600000",
        "jwt.refresh-token.expiration=86400000"
})
@ActiveProfiles("test")
@Transactional
@DisplayName("AuthService 단위 테스트")
class AuthServiceTest {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    private User testUser;
    private final String ORIGINAL_PASSWORD = "password123";
    private final String NEW_PASSWORD = "newPassword456";

    @BeforeEach
    void setUp() {
        // 테스트용 사용자 생성
        String hashedPassword = PasswordUtil.sha256(ORIGINAL_PASSWORD);

        testUser = User.builder()
                .userId("testuser")
                .email("test@example.com")
                .hashedPassword(hashedPassword)
                .role("ROLE_USER")
                .phone("010-1234-5678")
                .delYn("N")
                .verifyYn("Y")
                .build();

        testUser = userRepository.save(testUser);
    }

    @Test
    @DisplayName("editPassword: 현재 비밀번호가 일치하면 비밀번호 변경 성공")
    void editPassword_shouldSucceedWithCorrectCurrentPassword() {
        // Given
        PasswordDto passwordDto = new PasswordDto();
        passwordDto.setEmail("test@example.com");
        passwordDto.setCurrentPassword(ORIGINAL_PASSWORD);
        passwordDto.setNewPassword(NEW_PASSWORD);
        passwordDto.setCheckNewPassword(NEW_PASSWORD);

        // When
        authService.editPassword(passwordDto);

        // Then
        User updatedUser = userRepository.findByEmail("test@example.com").orElseThrow();
        String expectedHashedPassword = PasswordUtil.sha256(NEW_PASSWORD);
        assertThat(updatedUser.getHashedPassword()).isEqualTo(expectedHashedPassword);
        assertThat(updatedUser.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("editPassword: 현재 비밀번호가 틀리면 예외 발생")
    void editPassword_shouldFailWithIncorrectCurrentPassword() {
        // Given
        PasswordDto passwordDto = new PasswordDto();
        passwordDto.setEmail("test@example.com");
        passwordDto.setCurrentPassword("wrongPassword");
        passwordDto.setNewPassword(NEW_PASSWORD);
        passwordDto.setCheckNewPassword(NEW_PASSWORD);

        // When & Then
        assertThatThrownBy(() -> authService.editPassword(passwordDto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("현재 비밀번호가 일치하지 않습니다.");

        // 비밀번호가 변경되지 않았는지 확인
        User unchangedUser = userRepository.findByEmail("test@example.com").orElseThrow();
        String originalHashedPassword = PasswordUtil.sha256(ORIGINAL_PASSWORD);
        assertThat(unchangedUser.getHashedPassword()).isEqualTo(originalHashedPassword);
    }

    @Test
    @DisplayName("editPassword: 존재하지 않는 사용자는 예외 발생")
    void editPassword_shouldFailWithNonExistentUser() {
        // Given
        PasswordDto passwordDto = new PasswordDto();
        passwordDto.setEmail("nonexistent@example.com");
        passwordDto.setCurrentPassword(ORIGINAL_PASSWORD);
        passwordDto.setNewPassword(NEW_PASSWORD);
        passwordDto.setCheckNewPassword(NEW_PASSWORD);

        // When & Then
        assertThatThrownBy(() -> authService.editPassword(passwordDto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("사용자가 없습니다");
    }

    @Test
    @DisplayName("editPassword: currentPassword가 null이면 검증 없이 비밀번호 변경 (레거시 호환)")
    void editPassword_shouldSucceedWithoutCurrentPasswordValidation() {
        // Given
        PasswordDto passwordDto = new PasswordDto();
        passwordDto.setEmail("test@example.com");
        passwordDto.setCurrentPassword(null); // 현재 비밀번호 없음
        passwordDto.setNewPassword(NEW_PASSWORD);
        passwordDto.setCheckNewPassword(NEW_PASSWORD);

        // When
        authService.editPassword(passwordDto);

        // Then
        User updatedUser = userRepository.findByEmail("test@example.com").orElseThrow();
        String expectedHashedPassword = PasswordUtil.sha256(NEW_PASSWORD);
        assertThat(updatedUser.getHashedPassword()).isEqualTo(expectedHashedPassword);
    }

    @Test
    @DisplayName("editPassword: currentPassword가 빈 문자열이면 검증 없이 비밀번호 변경")
    void editPassword_shouldSucceedWithEmptyCurrentPassword() {
        // Given
        PasswordDto passwordDto = new PasswordDto();
        passwordDto.setEmail("test@example.com");
        passwordDto.setCurrentPassword(""); // 빈 문자열
        passwordDto.setNewPassword(NEW_PASSWORD);
        passwordDto.setCheckNewPassword(NEW_PASSWORD);

        // When
        authService.editPassword(passwordDto);

        // Then
        User updatedUser = userRepository.findByEmail("test@example.com").orElseThrow();
        String expectedHashedPassword = PasswordUtil.sha256(NEW_PASSWORD);
        assertThat(updatedUser.getHashedPassword()).isEqualTo(expectedHashedPassword);
    }

    @Test
    @DisplayName("isUserVerified: 인증된 사용자는 true 반환")
    void isUserVerified_shouldReturnTrueForVerifiedUser() {
        // Given
        String email = "test@example.com";

        // When
        boolean isVerified = authService.isUserVerified(email);

        // Then
        assertThat(isVerified).isTrue();
    }

    @Test
    @DisplayName("isUserVerified: 미인증 사용자는 false 반환")
    void isUserVerified_shouldReturnFalseForUnverifiedUser() {
        // Given
        User unverifiedUser = User.builder()
                .userId("unverified")
                .email("unverified@example.com")
                .hashedPassword(PasswordUtil.sha256("password"))
                .role("ROLE_USER")
                .phone("010-9999-8888")
                .delYn("N")
                .verifyYn("N") // 미인증
                .build();
        userRepository.save(unverifiedUser);

        // When
        boolean isVerified = authService.isUserVerified("unverified@example.com");

        // Then
        assertThat(isVerified).isFalse();
    }

    @Test
    @DisplayName("isUserVerified: 존재하지 않는 사용자는 false 반환")
    void isUserVerified_shouldReturnFalseForNonExistentUser() {
        // When
        boolean isVerified = authService.isUserVerified("nonexistent@example.com");

        // Then
        assertThat(isVerified).isFalse();
    }
}
