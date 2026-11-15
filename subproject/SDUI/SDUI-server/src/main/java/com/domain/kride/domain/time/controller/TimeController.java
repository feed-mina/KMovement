package com.domain.kride.domain.time.controller;


import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/timer")
public class TimeController {

    // 현재 시간
    @GetMapping("/now")
    public String getCurrentTime() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

    }

    //health 주소로 GET 요청이 오면 실행
    @GetMapping("/health")
    public String healthCheck() {
        return "OK";  // "OK"라는 글자를 돌려줘요
    }
}
