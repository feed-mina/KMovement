package com.domain.kride.domain.community.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LikeStatusResponse {
    private boolean liked;
    private long likeCount;
}
