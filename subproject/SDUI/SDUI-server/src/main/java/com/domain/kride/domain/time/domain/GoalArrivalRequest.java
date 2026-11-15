package com.domain.kride.domain.time.domain;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GoalArrivalRequest {
    private String status;
    private LocalDateTime recordedTime;

}
