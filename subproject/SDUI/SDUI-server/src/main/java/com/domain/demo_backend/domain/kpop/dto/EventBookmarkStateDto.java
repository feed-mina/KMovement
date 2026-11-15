package com.domain.demo_backend.domain.kpop.dto;

/** 일정 북마크/해제 응답. */
public record EventBookmarkStateDto(Long eventId, boolean bookmarked) {
}
