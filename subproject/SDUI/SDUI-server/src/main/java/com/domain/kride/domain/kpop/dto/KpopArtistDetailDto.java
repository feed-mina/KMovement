package com.domain.kride.domain.kpop.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/** GET /api/v1/kpop/artists/{artistId}. 카드 필드에 일정 목록(events)이 더해진다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KpopArtistDetailDto(
        Long id,
        String slug,
        String nameKo,
        String nameEn,
        String profile,
        String imageUrl,
        String officialUrl,
        String instagramUrl,
        String youtubeUrl,
        String xUrl,
        List<KpopArtistEventDto> events
) {
    public static KpopArtistDetailDto of(KpopArtistDto artist, List<KpopArtistEventDto> events) {
        return new KpopArtistDetailDto(artist.id(), artist.slug(), artist.nameKo(), artist.nameEn(),
                artist.profile(), artist.imageUrl(), artist.officialUrl(), artist.instagramUrl(),
                artist.youtubeUrl(), artist.xUrl(), List.copyOf(events));
    }
}
