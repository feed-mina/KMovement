package com.domain.demo_backend.domain.user.service;


import com.domain.demo_backend.domain.token.domain.TokenResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.dto.LoginRequest;
import com.domain.demo_backend.domain.user.dto.PasswordDto;
import com.domain.demo_backend.domain.user.dto.RegisterRequest;
import com.domain.demo_backend.global.exception.BusinessException;
import com.domain.demo_backend.global.exception.custom.DuplicateEmailException;
import com.domain.demo_backend.global.security.JwtUtil;
import com.domain.demo_backend.global.security.PasswordUtil;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;
import java.util.Random;

@Service
public class AuthService {
    private final Logger log = LoggerFactory.getLogger(AuthService.class);
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    private final StringRedisTemplate redisTemplate;

    @Value("${app.url.web}")
    private String webUrl;

    @Value("${app.url.mobile}")
    private String mobileUrl;


    @Value("${spring.mail.username}")
    private String fromEmail;
/*
    @Value("${solapi.api-key}")
    private String apiKey;

    @Value("${solapi.api-secret}")
    private String apiSecret;

    @Value("${solapi.sender-number}")
    private String senderNumber;

    private DefaultMessageService messageService;

    @PostConstruct
    public void init() {
        this.messageService = NurigoApp.INSTANCE.initialize(apiKey, apiSecret, "https://api.solapi.com");
    }
 */
    @Autowired
    private JavaMailSender mailSender;


    public AuthService(UserRepository userRepository, JwtUtil jwtUtil, StringRedisTemplate redisTemplate) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public TokenResponse login(LoginRequest loginRequest) {
        // 탈퇴한 유저가 delYn ='N' 이면 계정정보가 없다 . 또는 에러가 나면 계정정보가 없다라고 떠야한다.

        //  이메일로 사용자 조회
        User user = userRepository.findByEmail(loginRequest.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 이메일입니다"));


        //  이메일 인증 여부 확인 (verifyYn 필드 사용)
        if (!"Y".equals(user.getVerifyYn())) {
            throw new IllegalArgumentException("인증이 필요합니다.");
        }


        //  비밀번호 검증 (PasswordUtil 사용)
        String encryptedInputPw = PasswordUtil.sha256(loginRequest.getPassword());
        if (!user.getHashedPassword().equals(encryptedInputPw)) {
            throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
        }


        // 로그인 시각 갱신 (더티 체킹에 의해 자동 업데이트됨)
        user.setUpdatedAt(LocalDateTime.now());
        // 5. JWT 발급

        // 5. JWT 발급
        return jwtUtil.generateTokens(user);
    }


    // 새 사용자 정보를 해시처리 후 데이터베이스에 저장
    // 이미 존재하는 사용자 아이디인지 확인하고 중복되면 예외 발생
    @Transactional
    public void register(RegisterRequest registerRequest) {
        // 1. 이메일로 기존 유저 조회
        Optional<User> existingUserOpt = userRepository.findByEmail(registerRequest.getEmail());

        if (existingUserOpt.isPresent()) {
            User user = existingUserOpt.get();

            // 가공되지 않은 활성 유저인 경우
            if ("N".equals(user.getDelYn())) {
                throw new DuplicateEmailException();
            }

            // 탈퇴 유저인 경우 (재가입 로직)
            LocalDate withdrawDate = user.getWithdrawAt().toLocalDate();
            if (ChronoUnit.DAYS.between(withdrawDate, LocalDate.now()) < 7) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "탈퇴 후 7일 이내에는 재가입이 불가능합니다.");
            }

            // 재가입 처리 (기존 엔티티 업데이트)
            updateUserForReRegistration(user, registerRequest);
            return;
        }

        // 2. 신규 가입 시 아이디/핸드폰 중복 체크
        String requestedUserId = registerRequest.getUserId().trim();
        if (userRepository.existsByUserIdIgnoreCase(requestedUserId)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }

        if (userRepository.findByPhone(registerRequest.getPhone()).isPresent()) {
            throw new IllegalArgumentException("이미 존재하는 핸드폰 번호입니다.");
        }

        // 3. 신규 유저 저장
        User newUser = User.builder()
                .userId(requestedUserId)
                .password(registerRequest.getPassword()) // 실제로는 BCryptPasswordEncoder 사용 권장
                .hashedPassword(PasswordUtil.sha256(registerRequest.getPassword()))
                .phone(registerRequest.getPhone())
                .email(registerRequest.getEmail())
                .zipCode(registerRequest.getZipCode())      // 주소 저장 추가
                .roadAddress(registerRequest.getRoadAddress())
                .detailAddress(registerRequest.getDetailAddress())
                .role("ROLE_GUEST")
                .delYn("N")
                .verifyYn("N")
                .socialType("N")
                .createdAt(LocalDateTime.now())
                .build();

        userRepository.save(newUser);
    }

    private void updateUserForReRegistration(User user, RegisterRequest request) {
        // 빌더 대신 Setter나 별도의 업데이트 메서드 사용
        user.reRegister(
                request.getPassword(),
                PasswordUtil.sha256(request.getPassword()),
                request.getPhone(),
                request.getZipCode(),
                request.getRoadAddress(),
                request.getDetailAddress()
        );
        userRepository.save(user);
    }
    @Transactional
    public String sendUrlVerificationCode(String email) throws MessagingException {
        // 1. 보안을 위한 랜덤 토큰 생성
        String token = java.util.UUID.randomUUID().toString();

        // 2. Redis에 저장 (Key: token, Value: email, 유효시간: 30분)
        // opsForValue().set(key, value, timeout, unit)
        redisTemplate.opsForValue().set(token, email, 30, java.util.concurrent.TimeUnit.MINUTES);

        // 3. 인증 링크 생성
        String confirmUrl = "http://localhost:8080/api/auth/confirm-email?token=" + token;

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, "utf-8");
        helper.setTo(email);
        helper.setSubject("📨 회원가입 인증을 완료해주세요");

        String emailContent = "<div style='text-align:center; padding:20px;'>"
                + "<h2>SDUI Project 인증</h2>"
                + "<p>아래 버튼을 누르면 30분 내에 인증이 완료됩니다.</p>"
                + "<a href='" + confirmUrl + "' style='background:#0052cc; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;'>인증하기</a>"
                + "</div>";

        helper.setText(emailContent, true);
        mailSender.send(message);

        return "SENT_LINK";
    }

    @Transactional
    public boolean confirmEmailByToken(String token) {
        // 1. Redis에서 토큰으로 이메일을 찾는다.
        String email = redisTemplate.opsForValue().get(token);

        if (email == null) {
            // 토큰이 만료되었거나 존재하지 않는 경우
            return false;
        }

        // 2. 이메일로 유저를 찾아 인증 상태 업데이트
        return userRepository.findByEmail(email)
                .map(user -> {
                    user.setVerifyYn("Y");
                    // 3. 인증 완료 후 Redis에서 토큰 즉시 삭제
                    redisTemplate.delete(token);
                    return true;
                }).orElse(false);
        }



    public String sendVerificationCode(String email , String platform) throws MessagingException {
        //랜덤 인등코드 생성
        String verificationCode = generateRendomCode();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        user.setVerificationCode(verificationCode);
        userRepository.save(user);
        // 이메일 작성 및 전송
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, "utf-8");
        helper.setTo(email);

        String baseUrl = platform.equalsIgnoreCase("mobile") ? mobileUrl : webUrl;
        String verifyUrl = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/view/VERIFY_CODE_PAGE")
                .queryParam("email", email)
                .queryParam("code", verificationCode)
                .build()
                .encode()
                .toUriString();
        helper.setSubject("📨 이메일 인증 코드 발송");

        String emailContent = "<div style='padding:20px; font-family:Arial; text-align:center;'>"
                + "<h2>🚀 회원가입 인증 코드</h2>"
                + "<p>아래 인증 코드를 입력해주세요!</p>"
                + "<h1 style='color:#4CAF50;'>" + verificationCode + "</h1>"
                + "<a href='" + verifyUrl + "' style='display:inline-block; padding:10px 20px; background-color:#4CAF50; color:white; text-decoration:none; border-radius:5px;'>인증 페이지로 이동하기</a>"
                + "<p>감사합니다 😊</p>"
                + "</div>";

        helper.setText(emailContent, true);   // 여기 true가 HTML이라는 뜻이야!

        mailSender.send(message);

        return verificationCode; // 인증 코드 반환

    }

    private String generateRendomCode() {
        Random random = new Random();
        int code = 1000000 + random.nextInt(10000);
        // 랜덤 6자리 숫자 생성
        return String.valueOf(code);
    }

    // 회원가입 페이지 이후 인증번호 코드 페이지
    @Transactional
    public boolean verifyCode(String email, String code, String platform) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("사용자가 없습니다"));

        if (user == null) {
            log.error("사용자를 찾을 수 없음: {}", email);
            return false;
        }

        if (!code.equals(user.getVerificationCode())) {
            log.error(" 인증 실패: 코드 불일치 -> 입력한 코드: {}, 저장된 코드: {}", code, user.getVerificationCode());
            return false;
        }
        user.setRole("ROLE_USER");
        user.setVerifyYn("Y");
        userRepository.save(user);
        return true; // 코드가 틀리면 false
    }

    public void resendEmail(String email, String verificationCode) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, "utf-8");

        helper.setTo(email);
        helper.setSubject("📨 이메일 인증 코드 재발송");

        String emailContent = "<div style='padding:20px; font-family:Arial; text-align:center;'>"
                + "<h2>📨 이메일 인증 코드</h2>"
                + "<p>아래 인증 코드를 입력해주세요!</p>"
                + "<h1 style='color:#4CAF50;'>" + verificationCode + "</h1>"
                + "<p>감사합니다 😊</p>"
                + "</div>";

        helper.setText(emailContent, true);

        mailSender.send(message);
    }

    // 인증코드 재발송 로직
    public void resendVerification(String email) throws MessagingException {
        LoginRequest loginRequest = new LoginRequest();
        User user = userRepository.findByEmail(loginRequest.getEmail()).orElse(null);

        if (user == null) {
            throw new IllegalArgumentException("존재하지 않는 사용자입니다: " + email);
        }

        String verificationCode = generateRendomCode();
        user.setVerificationCode(verificationCode);
        resendEmail(email, verificationCode);
    }

    // 이미 존재하는 사용자인지 email(외래키),jwtToken 확인하고  update문으로 delyn,updateAt 값 변경
    @Transactional
    public void nonMember(RegisterRequest registerRequest) {
        Date date = new Date();
        LocalDateTime ldt = date.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
        User existingUser = userRepository.findByEmail(registerRequest.getEmail()).orElseThrow(() -> new IllegalArgumentException("사용자가 없습니다"));
        if (existingUser == null) {
            log.info("  250527_회원탈퇴 실패: 해당 사용자가 존재하지 않습니다.");
            throw new IllegalArgumentException("해당 사용자가 존재하지 않습니다.");
        }
        // 회원탈퇴 처리
        existingUser.setDelYn("Y");
        existingUser.setVerifyYn("N");
        existingUser.setVerificationCode("0000000");
        existingUser.setUpdatedAt(ldt);
        existingUser.setWithdrawAt(ldt);
        log.info("  250527_existingUser : " + existingUser);
        log.info("  250527_user Mapper nonMember 시작");
        log.info("  250527_user 탈퇴 처리 완료: " + existingUser);
    }

    @Transactional
    public void editPassword(PasswordDto passwordDto) {
        Date date = new Date();
        LocalDateTime ldt = date.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
        log.info("  250527_@@@@@비밀변호 변경 서비스 진입 email: " + passwordDto.getEmail());
        User existingUser = userRepository.findByEmail(passwordDto.getEmail()).orElseThrow(() -> new IllegalArgumentException("사용자가 없습니다"));
        if (existingUser == null) {
            log.info("  250527_비밀변호 변경 실패: 해당 사용자가 존재하지 않습니다.");
            throw new IllegalArgumentException("해당 사용자가 존재하지 않습니다.");
        }

        // 현재 비밀번호 검증 (보안 강화)
        if (passwordDto.getCurrentPassword() != null && !passwordDto.getCurrentPassword().isEmpty()) {
            String currentHashedPassword = PasswordUtil.sha256(passwordDto.getCurrentPassword());
            if (!existingUser.getHashedPassword().equals(currentHashedPassword)) {
                log.error("  비밀번호 변경 실패: 현재 비밀번호가 일치하지 않습니다.");
                throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
            }
        }

        // 비밀변호 변경 처리
        existingUser.setUpdatedAt(ldt);
        // 비밀번호 암호화
        String newHashedPassword = PasswordUtil.sha256(passwordDto.getNewPassword());

        existingUser.setPassword(passwordDto.getCheckNewPassword());
        existingUser.setHashedPassword(newHashedPassword);
        existingUser.setUpdatedAt(ldt);
        //  userRepository.editPassword(existingUser); // 기존 레코드를 update
        existingUser.setHashedPassword(newHashedPassword);
        log.debug("existingUser: {}", existingUser);
        log.debug("user Mapper nonMember 시작");
        log.debug("user 탈퇴 처리 완료: {}", existingUser);
    }

    public boolean isUserVerified(String email) {
        // 1. DB에서 해당 이메일로 유저를 찾는다. (없으면 당연히 인증 안 된 것)
        // 2. 유저의 verifyYn 값이 "Y"인지 확인해서 맞으면 true, 아니면 false를 준다.
        return userRepository.findByEmail(email)
                .map(user -> "Y".equals(user.getVerifyYn()))
                .orElse(false);
    }
/*


    public String sendVerificationPhoneCode(String phoneNumber) {
        String verificationPhoneCode = generateRendomCode();

        // 휴대폰 번호를 키로, 인증번호를 값으로 저장. 유효기간 3분 설정.
        redisTemplate.opsForValue().set(phoneNumber, verificationPhoneCode, 3, TimeUnit.MINUTES);

        // 여기서 솔라피 API를 호출하여 실제로 문자를 발송함 (솔라피 연동 코드 필요)
        sendSmsViaSolapi(phoneNumber, verificationPhoneCode);

        return verificationPhoneCode;
    }

    public boolean verifyPhoneCode(String phoneNumber, String inputCode) {
        // Redis에서 해당 번호로 저장된 인증번호를 가져옴
        String savedCode = redisTemplate.opsForValue().get(phoneNumber);

        if (savedCode != null && savedCode.equals(inputCode)) {
            // 인증 성공 시 Redis에서 삭제 (1회용이므로)
            redisTemplate.delete(phoneNumber);
            return true;
        }
        return false;
    }

    public void sendSmsViaSolapi(String phoneNumber, String code) {
        Message message = new Message();
        message.setFrom(senderNumber);
        message.setTo(phoneNumber);
        message.setText("[SDUI Project] 인증번호는 [" + code + "] 입니다. 3분 내에 입력해 주세요.");

        try {
            SingleMessageSentResponse response = this.messageService.sendOne(new SingleMessageSendingRequest(message));
            System.out.println(response.getMessageId());
        } catch (Exception e) {
            System.err.println(e.getMessage());
        }
    }

 */

}
