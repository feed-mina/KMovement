package com.domain.kride.domain.kridechat.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@Builder
public class ChatQueryResponse {
    private String intent;
    private String reply;
    private List<Map<String, Object>> pois;
    private String recommendationText;
    private Map<String, Object> itinerary;
}
