package com.domain.demo_backend.domain.kpop.controller;
import com.domain.demo_backend.domain.kpop.service.FanEventFeedService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
@RequestMapping("/api/v1/kpop")
public class FanEventFeedController {
    private final FanEventFeedService feed;
    public FanEventFeedController(FanEventFeedService feed){this.feed=feed;}
    @GetMapping({"/event-feed","/me/event-feed"})
    public ResponseEntity<?> get(jakarta.servlet.http.HttpServletRequest request,@AuthenticationPrincipal CustomUserDetails user,
        @RequestParam(required=false) String artistId,@RequestParam(defaultValue="all") String geography,@RequestParam(required=false) String countryCode,
        @RequestParam(required=false) String from,@RequestParam(required=false) String to,@RequestParam(defaultValue="1") int page) {
        boolean personal=request.getRequestURI().endsWith("/me/event-feed");
        if(personal&&(user==null||user.getUserSqno()==null))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Login required.");
        return ResponseEntity.ok().header("Cache-Control","private, no-store").header("Vary","Cookie, Authorization").header("X-Event-Feed-Policy","fan-events-v1")
            .body(ApiResponse.success(feed.feed(personal?user.getUserSqno():null,artistId,geography,countryCode,from,to,page)));
    }
}
