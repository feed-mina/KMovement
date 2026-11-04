package com.domain.demo_backend.domain.user.service;

import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.security.JwtUtil;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import java.util.Properties;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AuthVerificationMailTest {
    @Test
    void resendUsesRequestedEmailAndPersistsTheDeliveredCode() throws Exception {
        UserRepository repository = mock(UserRepository.class);
        JavaMailSender sender = mock(JavaMailSender.class);
        User user = User.builder().email("mina@example.com").verifyYn("N").build();
        when(repository.findByEmail("mina@example.com")).thenReturn(Optional.of(user));
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(sender.createMimeMessage()).thenReturn(message);
        AuthService service = new AuthService(repository, mock(JwtUtil.class), mock(StringRedisTemplate.class));
        ReflectionTestUtils.setField(service, "mailSender", sender);
        ReflectionTestUtils.setField(service, "fromEmail", "sender@example.com");
        service.resendVerification("mina@example.com");
        assertThat(user.getVerificationCode()).matches("[0-9]{6}");
        assertThat(message.getFrom()[0].toString()).isEqualTo("sender@example.com");
        verify(sender).send(message);
        verify(repository).save(user);
    }
}
