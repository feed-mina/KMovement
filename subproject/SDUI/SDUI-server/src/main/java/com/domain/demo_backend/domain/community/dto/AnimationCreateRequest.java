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

    /**
     * Optional trajectory preset for the {@code tora_cogvideox_i2v} route
     * (e.g. {@code object_pan_right}). Ignored by other routes. When blank,
     * the backend supplies a default so Tora runs instead of falling back.
     */
    private String trajectoryPreset;
}
