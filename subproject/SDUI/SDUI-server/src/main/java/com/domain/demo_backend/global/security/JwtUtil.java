package com.domain.demo_backend.global.security;

import com.domain.demo_backend.domain.token.domain.RefreshToken;
import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.domain.token.domain.TokenResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;
import java.util.Base64;
import java.util.Date;


@Component
public class JwtUtil {

    private static final String SECRET_KEY = "mySuperSecretKey"; //  비밀키 (32바이트)
    private static final String SALT = "mySaltValue"; //  SALT 값
    // Access Token: 1시간
    private static final long ACCESS_TOKEN_VALIDITY = 1000L * 60 * 60; // 1시간

//    private static final String SCRET_kEY = "${jwt.secret-key}";
    /*
     * @@@@ 2026-01-25 RefreshTokenRepository 주입받아 저장 > TTL 초기화
     * */
    // Refresh Token: 7일
    private static final long REFRESH_TOKEN_VALIDITY = 1000L * 60 * 60 * 24 * 7; // 7일
    private final RefreshTokenRepository refreshTokenRepository;
    //    private static final long REFRESH_TOKEN_VALIDITY = 1000L * 60 * 60 * 3; // 3시간
    private final UserRepository userRepository;
    private SecretKey secretKey;
    @Value("${jwt.issuer}")
    private String issuer;
    @Value("${jwt.secret-key}")
    private String secret;

    public JwtUtil(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    /**
     * AES-256으로 문자열을 암호화 하는 메서드
     */
    public static String encryptAesByBase64(String strToEncrypt) {
        try {
            byte[] iv = new byte[16]; // 초기화 백터 (IV)
            IvParameterSpec ivspec = new IvParameterSpec(iv);

            SecretKeySpec secretKey = getSecretKey();
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivspec);

            byte[] encryptedText = cipher.doFinal(strToEncrypt.getBytes(StandardCharsets.UTF_8));

            //Base64 인코딩 후 반환
            return Base64.getEncoder().encodeToString(encryptedText);

        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    // AES56으로 암호화된 문자열을 복호화 하는 메서드
    public static String decryptAesByBase64(String strToDecrypt) {
        try {
            byte[] iv = new byte[16]; // 초기화 백터 (IV)
            IvParameterSpec ivspec = new IvParameterSpec(iv);

            SecretKeySpec secretKey = getSecretKey();
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivspec);

            // Base64 디코딩 후 복호화
            byte[] decodedText = Base64.getDecoder().decode(strToDecrypt);
            return new String(cipher.doFinal(decodedText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    //      * AES-256 비밀키 생성 메서드
    private static SecretKeySpec getSecretKey() throws Exception {
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        KeySpec spec = new PBEKeySpec(SECRET_KEY.toCharArray(), SALT.getBytes(), 65536, 256);
        SecretKey secretKey = factory.generateSecret(spec);
        return new SecretKeySpec(secretKey.getEncoded(), "AES");
    }

    @PostConstruct
    public void init() {
        // 설정 파일에 기본 키를 두지 않는다. 값이 비어 있으면 조용히 약한 키로 켜지지 않고 시작을 멈춘다.
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("jwt.secret-key is not configured.");
        }
        this.secretKey = Keys.hmacShaKeyFor(Base64.getDecoder().decode(secret.trim()));

    }

    // 토큰생성
    public TokenResponse generateTokens(User user) {
        Date now = new Date();

        Date accessExp = new Date(now.getTime() + ACCESS_TOKEN_VALIDITY);
        Date refreshExp = new Date(now.getTime() + REFRESH_TOKEN_VALIDITY);
        long ttlInSeconds = REFRESH_TOKEN_VALIDITY / 1000;

        Claims claims = Jwts.claims().setSubject(user.getEmail());

        String accessToken = Jwts.builder()
                .setSubject(user.getEmail())
                .claim("email", user.getEmail())
                .claim("userSqno", user.getUserSqno())
                .claim("userId", user.getUserId())
                .claim("role", user.getRole())
                .setIssuedAt(now)
                .setExpiration(accessExp)
                .signWith(secretKey, SignatureAlgorithm.HS256)
                .compact();


        // Refresh Token 생성
        String refreshToken = Jwts.builder()
                .setSubject(user.getEmail())
                .setIssuedAt(now)
                .setExpiration(refreshExp)
                .signWith(secretKey, SignatureAlgorithm.HS256)
                .compact();

        // Redis 저장
        refreshTokenRepository.save(new RefreshToken(
                user.getUserSqno(),
                user.getEmail(),
                refreshToken,
                ttlInSeconds
        ));



        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .userId(user.getUserId())
                .userSqno(user.getUserSqno())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }

    public Claims validateToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(secretKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String createAccessToken(User user) {
        Claims claims = Jwts.claims().setSubject(user.getEmail());
        claims.put("userId", user.getUserId());
        claims.put("userSqno", user.getUserSqno());
        claims.put("role", user.getRole()); // 역할 클레임 추가
        Date now = new Date();
        Date accessExp = new Date(now.getTime() + 1000L * 60 * 60); // 1시간

        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(now)
                .setExpiration(new Date(System.currentTimeMillis() + ACCESS_TOKEN_VALIDITY))
                .signWith(secretKey, SignatureAlgorithm.HS256)
                .compact();
    }

}
