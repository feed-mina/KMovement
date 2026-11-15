package com.domain.kride.domain.user.dto;


import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EmailRequest {
    private String to;
    private String subject;
    private String body;
    private String imagePath;
    private String imageName;
}
