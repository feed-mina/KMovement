package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.domain.kpop.repository.KpopArtistRepository;
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

    public List<Map<String, Object>> artists(String q) {
        Object query = blankToNull(q);
        Map<String, Object> keyParts = new LinkedHashMap<>();
        keyParts.put("q", query);
        return cached("artists", keyParts, new TypeReference<List<Map<String, Object>>>() {},
                () -> artistRepository.findApprovedArtists(query));
    }

    public Map<String, Object> artist(String artistId) {
        String artistRef = artistId == null ? "" : artistId.trim();
        return cached("artist_detail", Map.of("artistRef", artistRef), new TypeReference<Map<String, Object>>() {},
                () -> {
                    Map<String, Object> loaded = new LinkedHashMap<>(artistRepository.findApprovedArtistByRef(artistRef)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "K-POP resource not found.")));
                    Long resolvedArtistId = ((Number) loaded.get("id")).longValue();
                    loaded.put("events", artistRepository.findApprovedEventsByArtist(resolvedArtistId));
                    return loaded;
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
