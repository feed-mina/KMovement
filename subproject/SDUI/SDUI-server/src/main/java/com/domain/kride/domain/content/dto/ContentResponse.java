package com.domain.kride.domain.content.dto;


import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@ToString
@EqualsAndHashCode
public class ContentResponse {
    private BigInteger contentId;
    private Long userSqno;
    private String userId;
    private String title;
    private String content;

    @JsonProperty("day_tag1") // JSON의 day_tag1을 이 필드에 담으라는 뜻
    private String dayTag1;

    @JsonProperty("day_tag2")
    private String dayTag2;

    @JsonProperty("day_tag3")
    private String dayTag3;
    private String contentStatus;
    private Integer emotion;
    private String delYn;
    private String date;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDateTime regDt;
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDateTime lastUpdtDt;

    @JsonProperty("selected_times")
    private List<Integer> selectedTimes;

    @JsonProperty("daily_slots")
    private Map<String, Object> dailySlots;

}
