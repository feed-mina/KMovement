package com.domain.demo_backend.domain.community.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class PostUpdateRequest {
    @Size(max = 200, message = "제목은 200자 이내로 입력해주세요.")
    private String title;

    @Size(max = 5000, message = "내용은 5000자 이내로 입력해주세요.")
    private String content;

    private List<String> retainedImages;
}
