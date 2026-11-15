package com.domain.kride.domain.kpop.dto;

/** 아티스트 팔로우/해제 응답. */
public record ArtistFollowStateDto(Long artistId, boolean followed) {
}
