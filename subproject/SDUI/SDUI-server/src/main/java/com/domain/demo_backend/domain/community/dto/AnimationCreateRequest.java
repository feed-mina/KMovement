package com.domain.demo_backend.domain.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnimationCreateRequest {

    @NotNull
    private Long postImageId;

    @NotBlank
    private String route;
}
