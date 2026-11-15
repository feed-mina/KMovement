package com.domain.kride.domain.kpop.service;

import com.domain.kride.domain.kpop.dto.KpopArtistDetailDto;
import com.domain.kride.domain.kpop.dto.KpopArtistDto;
import com.domain.kride.domain.kpop.dto.KpopArtistEventDto;
import com.domain.kride.domain.kpop.repository.KpopArtistRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/** Public artist list/detail and follow/bookmark rules used by KpopController. */
@Service
public class KpopArtistService {

    private final KpopArtistRepository artistRepository;
    private final PersonalSavedService personalSavedService;
    private final KpopCacheService cacheService;

    @Autowired
    public KpopArtistService(KpopArtistRepository artistRepository,
                             PersonalSavedService personalSavedService,
                             @Nullable KpopCacheService cacheService) {
        this.artistRepository = artistRepository;
        this.personalSavedService = personalSavedService;
        this.cacheService = cacheService;
    }

    public List<KpopArtistDto> artists(String q) {
        Object query = blankToNull(q);
        Map<String, Object> keyParts = new LinkedHashMap<>();
        keyParts.put("q", query);
        return cached("artists", keyParts, new TypeReference<List<KpopArtistDto>>() {},
                () -> artistRepository.findApprovedArtists(query).stream().map(KpopArtistDto::fromRow).toList());
    }

    public KpopArtistDetailDto artist(String artistId) {
        String artistRef = artistId == null ? "" : artistId.trim();
        return cached("artist_detail", Map.of("artistRef", artistRef), new TypeReference<KpopArtistDetailDto>() {},
                () -> {
                    KpopArtistDto artist = artistRepository.findApprovedArtistByRef(artistRef)
                            .map(KpopArtistDto::fromRow)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "K-POP resource not found."));
                    List<KpopArtistEventDto> events = artistRepository.findApprovedEventsByArtist(artist.id())
                            .stream().map(KpopArtistEventDto::fromRow).toList();
                    return KpopArtistDetailDto.of(artist, events);
                });
    }

    public void follow(Long artistId, Long userSqno) {
        personalSavedService.save("artists", artistId, userSqno);
    }

    public void unfollow(Long artistId, Long userSqno) {
        artistRepository.deleteArtistFollow(userSqno, artistId);
    }

    public void bookmark(Long eventId, Long userSqno) {
        personalSavedService.save("events", eventId, userSqno);
    }

    public void unbookmark(Long eventId, Long userSqno) {
        artistRepository.deleteEventBookmark(userSqno, eventId);
    }

    private <T> T cached(String resource, Map<String, ?> keyParts, TypeReference<T> type, Supplier<T> loader) {
        return cacheService == null
                ? loader.get()
                : cacheService.catalog(resource, keyParts, Duration.ofMinutes(5), type, loader);
    }

    private static Object blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
