package com.domain.demo_backend.domain.community.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BatchAnimationImageRequest {

    @NotNull
    private Long postImageId;

    @Size(max = 500)
    private String ttsText;

    @Pattern(regexp = "photo|sketch|auto")
    private String imageType = "auto";
}
