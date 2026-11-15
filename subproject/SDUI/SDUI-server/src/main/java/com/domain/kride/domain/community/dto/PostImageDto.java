package com.domain.kride.domain.community.dto;

import com.domain.kride.domain.community.domain.PostImage;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PostImageDto {
    private Long postImageId;
    private String storageUrl;
    private String originalName;
    private String storedName;
    private String mimeType;
    private Long fileSize;
    private Integer sortOrder;

    public static PostImageDto from(PostImage image) {
        return PostImageDto.builder()
                .postImageId(image.getPostImageId())
                .storageUrl(image.getStorageUrl())
                .originalName(image.getOriginalName())
                .storedName(image.getStoredName())
                .mimeType(image.getMimeType())
                .fileSize(image.getFileSize())
                .sortOrder(image.getSortOrder())
                .build();
    }
}
