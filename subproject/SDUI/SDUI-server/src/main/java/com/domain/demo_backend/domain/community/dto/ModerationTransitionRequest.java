package com.domain.demo_backend.domain.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ModerationTransitionRequest {

    @NotBlank(message = "A target status is required.")
    private String status;

    @Size(max = 1000, message = "The moderation note must not exceed 1000 characters.")
    private String note;
}
