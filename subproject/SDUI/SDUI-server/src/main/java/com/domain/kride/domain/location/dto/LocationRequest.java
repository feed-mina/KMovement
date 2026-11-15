package com.domain.kride.domain.location.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LocationRequest {
    private String userSqno;
    private double lat;
    private double lng;
    private String restaurantId;
    private String status; // NORMAL, HELP
}
