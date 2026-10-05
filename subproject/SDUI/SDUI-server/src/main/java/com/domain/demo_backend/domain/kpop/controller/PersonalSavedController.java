package com.domain.demo_backend.domain.kpop.controller;
import com.domain.demo_backend.domain.kpop.service.PersonalSavedService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/kpop/me/saved")
public class PersonalSavedController {
    private final PersonalSavedService service;
    private Long owner(CustomUserDetails user) {
        if(user==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Login required.");
        return user.getUserSqno();
    }
    private ResponseEntity<ApiResponse<Map<String,Object>>> response(Map<String,Object> body) {
        return ResponseEntity.ok().header("Cache-Control","private, no-store").body(ApiResponse.success(body));
    }
    @GetMapping("/{kind}") public ResponseEntity<?> page(@PathVariable String kind,@RequestParam(defaultValue="1") int page,@AuthenticationPrincipal CustomUserDetails user) {
        return response(service.page(kind,page,owner(user)));
    }
    @GetMapping("/{kind}/{ref}") public ResponseEntity<?> state(@PathVariable String kind,@PathVariable Long ref,@AuthenticationPrincipal CustomUserDetails user) {
        return response(service.state(kind,ref,owner(user)));
    }
    @PostMapping("/{kind}/{ref}") public ResponseEntity<?> save(@PathVariable String kind,@PathVariable Long ref,@AuthenticationPrincipal CustomUserDetails user) {
        return response(service.save(kind,ref,owner(user)));
    }
    @DeleteMapping("/{kind}/{ref}") public ResponseEntity<?> remove(@PathVariable String kind,@PathVariable Long ref,@AuthenticationPrincipal CustomUserDetails user) {
        return response(service.remove(kind,ref,owner(user)));
    }
}
