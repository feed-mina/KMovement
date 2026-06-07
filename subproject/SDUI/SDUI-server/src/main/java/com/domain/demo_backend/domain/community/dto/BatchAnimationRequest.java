package com.domain.demo_backend.domain.community.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class BatchAnimationRequest {

    @Valid
    @Size(min = 1, max = 10)
    private List<BatchAnimationImageRequest> images;

    @Pattern(regexp = "bright_travel|cute_character|city_walk|cinematic_memory")
    private String bgmKey = "bright_travel";

    @Pattern(regexp = "auto|cogvideox_real|3d_photo_light|tora_cogvideox_i2v")
    private String photoRoute = "cogvideox_real";

    private String bgmDescription = "";

    @jakarta.validation.constraints.Min(5)
    @jakarta.validation.constraints.Max(30)
    private int bgmDuration = 15;
}
