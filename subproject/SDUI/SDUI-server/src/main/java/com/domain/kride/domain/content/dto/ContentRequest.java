package com.domain.kride.domain.content.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@ToString
@EqualsAndHashCode
public class ContentRequest {

    @JsonFormat(pattern = "yyyy-MM-dd")
    private String regDt;
    private String title;
    private String content;
    private Map<String, String> tags;
    private Long contentId;

    @JsonProperty("day_tag1")
    private String dayTag1;

    @JsonProperty("day_tag2")
    private String dayTag2;

    @JsonProperty("day_tag3")
    private String dayTag3;
    private Integer emotion;
    private String date;
    private String delYn = "N";
    private int pageNo = 1;
    private int pageSize = 10;
    @JsonProperty("selected_times")
    private List<Integer> selectedTimes;

    @JsonProperty("daily_slots")
    private Map<String, Object> dailySlots;
    private String contentType;
    private String contentStatus;
    private Long userSqno;
    private String userId;
    private String email;
    private String frstRegstIp;
    private String lastUpdtIp;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private String lastUpdtDt;

    private String searchType;
    private String searchText;

    @JsonProperty("is_private")
    private Boolean isPrivate;
}