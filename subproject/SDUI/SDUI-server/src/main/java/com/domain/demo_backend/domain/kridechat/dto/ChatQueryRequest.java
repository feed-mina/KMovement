package com.domain.demo_backend.domain.kridechat.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class ChatQueryRequest {
    private String message;
    private String intent;
    private List<String> artists;
    private List<String> regions;
    private List<String> purposes;
    private Integer duration;
    private Map<String, Integer> budget;
}
