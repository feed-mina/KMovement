package com.domain.demo_backend.domain.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CommentRequest {

    @NotBlank(message = "Comment content is required.")
    @Size(max = 2000, message = "Comment content must not exceed 2000 characters.")
    private String content;
}
