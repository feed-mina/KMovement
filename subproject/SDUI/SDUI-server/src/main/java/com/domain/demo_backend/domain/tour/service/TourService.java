package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.client.TourApiClient;
import com.domain.demo_backend.domain.tour.domain.TourPoi;
import com.domain.demo_backend.domain.tour.domain.TourPoiRepository;
import com.domain.demo_backend.domain.tour.dto.HolyPoiDto;
import com.domain.demo_backend.domain.tour.dto.HolyReviewItemDto;
import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import com.domain.demo_backend.domain.tour.dto.TourRegionDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 관광 POI 서비스 — TourAPI 조회 오케스트레이션 + 성지(tour_poi) 조회.
 * Epic #74 · Dev-2(#76) · Dev-4(#96-A).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TourService {

    private final TourApiClient tourApiClient;
    private final TourPoiRepository tourPoiRepository;

    /** 맛집(음식점, contentTypeId=39) 조회 편의 메서드. */
    public static final String CONTENT_TYPE_RESTAURANT = "39";

    /** 성지 목록에서 제외할 공공 데이터 소스. */
    public static final String SOURCE_TOURAPI = "TOURAPI";

    /** 검수 통과 상태. */
    public static final String REVIEW_APPROVED = "APPROVED";

    private static final long REGION_CACHE_TTL_MILLIS = 10 * 60 * 1000L;
    private final Map<String, RegionCacheEntry> regionCache = new ConcurrentHashMap<>();

    /** 성지 목록 응답 상한 — 전국 시드(V90) 이후 지역당 수천 행이 될 수 있다. */
    static final int HOLY_MAX_RESULTS = 300;

    /**
     * TourAPI 표준 시/도 코드. TOUR_API_KEY 미설정·장애 시에도 지역 탐색이
     * 서울로 쪼그라들지 않도록 서버가 전국 목록을 보장한다
     * (scripts/build_holy_poi_seed.py 의 SIDO_TO_AREA 매핑과 동일 코드 체계).
     */
    static final List<TourRegionDto> NATIONWIDE_AREAS = List.of(
            new TourRegionDto("1", "서울"), new TourRegionDto("2", "인천"),
            new TourRegionDto("3", "대전"), new TourRegionDto("4", "대구"),
            new TourRegionDto("5", "광주"), new TourRegionDto("6", "부산"),
            new TourRegionDto("7", "울산"), new TourRegionDto("8", "세종"),
            new TourRegionDto("31", "경기"), new TourRegionDto("32", "강원"),
            new TourRegionDto("33", "충북"), new TourRegionDto("34", "충남"),
            new TourRegionDto("35", "경북"), new TourRegionDto("36", "경남"),
            new TourRegionDto("37", "전북"), new TourRegionDto("38", "전남"),
            new TourRegionDto("39", "제주"));

    private record RegionCacheEntry(List<TourRegionDto> regions, long cachedAt) {
        boolean isFresh(long now) {
            return now - cachedAt < REGION_CACHE_TTL_MILLIS;
        }
    }

    public List<TourPoiDto> getPois(String areaCode, String sigunguCode, String contentTypeId,
                                    String arrange, int numOfRows, int pageNo) {
        int rows = numOfRows <= 0 ? 20 : Math.min(numOfRows, 100);
        int page = pageNo <= 0 ? 1 : pageNo;
        log.info("[TourService] POI 조회 - area={}, sigungu={}, type={}, arrange={}, rows={}, page={}",
                areaCode, sigunguCode, contentTypeId, arrange, rows, page);
        return tourApiClient.areaBasedList(areaCode, sigunguCode, contentTypeId, arrange, rows, page);
    }

    public List<TourPoiDto> getRestaurants(String areaCode, int numOfRows, int pageNo) {
        return getPois(areaCode, null, CONTENT_TYPE_RESTAURANT, null, numOfRows, pageNo);
    }

    /**
     * 성지(HOLY) POI 목록 — tour_poi에서 공공(TOURAPI) 제외 + 검수 승인(APPROVED)분만.
     * 데이터 파이프라인 1차: 시드(V76) 서빙. 후속: LLM 정제 투입분(PENDING)은 검수 후 노출.
     */
    public List<HolyPoiDto> getHolyPois() {
        return getHolyPois(null, null, null);
    }

    public List<HolyPoiDto> getHolyPois(String areaCode, String sigunguCode) {
        return getHolyPois(areaCode, sigunguCode, null);
    }

    public List<HolyPoiDto> getHolyPois(String areaCode, String sigunguCode, String sigunguName) {
        List<HolyPoiDto> pois = tourPoiRepository
                .findHolyPoisByRegion(SOURCE_TOURAPI, REVIEW_APPROVED, areaCode, sigunguCode,
                        sigunguName, PageRequest.of(0, HOLY_MAX_RESULTS))
                .stream()
                .map(HolyPoiDto::from)
                .toList();
        log.info("[TourService] 성지 POI 조회 - area={}, sigungu={}, sigunguName={}, {}건",
                areaCode, sigunguCode, sigunguName, pois.size());
        return pois;
    }

    /**
     * TourAPI 지역 코드를 짧은 TTL로 캐시한다. 갱신 실패 시 마지막 성공값을 반환한다.
     */
    public List<TourRegionDto> getAreas(String areaCode) {
        String normalizedAreaCode = areaCode == null ? "" : areaCode.trim();
        String cacheKey = normalizedAreaCode.isEmpty() ? "areas" : "districts:" + normalizedAreaCode;
        long now = System.currentTimeMillis();
        RegionCacheEntry cached = regionCache.get(cacheKey);
        if (cached != null && cached.isFresh(now)) return cached.regions();

        boolean provinceRequest = normalizedAreaCode.isEmpty();
        try {
            List<TourRegionDto> regions = List.copyOf(tourApiClient.areaCodes(normalizedAreaCode));
            if (!regions.isEmpty()) {
                regionCache.put(cacheKey, new RegionCacheEntry(regions, now));
                return regions;
            }
            if (cached != null) return cached.regions();
            return provinceRequest ? NATIONWIDE_AREAS : List.of();
        } catch (RuntimeException error) {
            if (cached != null) {
                log.warn("[TourService] 지역 코드 갱신 실패, 마지막 성공 캐시 사용 - key={}", cacheKey, error);
                return cached.regions();
            }
            // 시/도 목록만은 TourAPI 없이도 보장한다 — 키 미설정/장애 시 프론트가
            // 서울 폴백으로 쪼그라들어 전국 성지 데이터를 탐색할 수 없었다.
            if (provinceRequest) {
                log.warn("[TourService] 지역 코드 조회 실패, 전국 시/도 상수로 폴백", error);
                return NATIONWIDE_AREAS;
            }
            throw error;
        }
    }

    /** 검수 대기(PENDING) 성지 목록 — 어드민 검수 큐. Dev-4 2차. */
    public List<HolyReviewItemDto> getPendingHolyPois() {
        return tourPoiRepository
                .findBySourceNotAndReviewStatusOrderByPoiSqnoAsc(SOURCE_TOURAPI, "PENDING")
                .stream()
                .map(HolyReviewItemDto::from)
                .toList();
    }

    /**
     * 성지 검수 처리 — APPROVE/REJECT. 공공(TOURAPI) 행은 검수 대상이 아니다.
     *
     * @throws IllegalArgumentException poiSqno 없음 / 잘못된 action / TOURAPI 행
     */
    @Transactional
    public HolyReviewItemDto reviewHolyPoi(Long poiSqno, String action, String reviewer) {
        TourPoi poi = tourPoiRepository.findById(poiSqno)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 POI: " + poiSqno));
        if (SOURCE_TOURAPI.equals(poi.getSource())) {
            throw new IllegalArgumentException("공공(TOURAPI) POI는 검수 대상이 아닙니다: " + poiSqno);
        }
        if (!"PENDING".equals(poi.getReviewStatus())) {
            throw new IllegalArgumentException("PENDING 상태의 POI만 검수할 수 있습니다: " + poiSqno);
        }
        String status = switch (action == null ? "" : action.toUpperCase()) {
            case "APPROVE" -> "APPROVED";
            case "REJECT" -> "REJECTED";
            default -> throw new IllegalArgumentException("action은 APPROVE 또는 REJECT여야 합니다: " + action);
        };
        poi.setReviewStatus(status);
        poi.setReviewedBy(reviewer);
        poi.setReviewedAt(LocalDateTime.now());
        TourPoi saved = tourPoiRepository.save(poi);
        log.info("[TourService] 성지 검수 - poiSqno={}, status={}, reviewer={}", poiSqno, status, reviewer);
        return HolyReviewItemDto.from(saved);
    }

    @Transactional
    public HolyReviewItemDto submitHolyPoi(String title, String addr, Double mapX, Double mapY,
                                            String artist, String recommendReason, String sourceUrl,
                                            Long submitterSqno) {
        String cleanTitle = required(title, "title", 255);
        String cleanSourceUrl = requiredHttpUrl(sourceUrl);
        if (mapX == null || mapY == null || !Double.isFinite(mapX) || !Double.isFinite(mapY)
                || mapX < 124 || mapX > 132 || mapY < 33 || mapY > 39) {
            throw new IllegalArgumentException("Coordinates must be within South Korea");
        }
        tourPoiRepository.findFirstBySourceUrlAndReviewStatus(cleanSourceUrl, "PENDING")
                .ifPresent(p -> { throw new IllegalArgumentException("This source URL is already pending review"); });
        TourPoi poi = new TourPoi();
        poi.setSource("UGC");
        poi.setContentTypeId("HOLY");
        poi.setTitle(cleanTitle);
        poi.setAddr(optional(addr, 500));
        poi.setMapX(mapX);
        poi.setMapY(mapY);
        poi.setArtist(optional(artist, 120));
        poi.setRecommendReason(required(recommendReason, "recommendReason", 500));
        poi.setSourceUrl(cleanSourceUrl);
        poi.setReviewStatus("PENDING");
        poi.setSubmittedBy(submitterSqno);
        return HolyReviewItemDto.from(tourPoiRepository.save(poi));
    }

    private String required(String value, String field, int max) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        String clean = value.trim();
        if (clean.length() > max) throw new IllegalArgumentException(field + " is too long");
        return clean;
    }
    private String optional(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String clean = value.trim();
        if (clean.length() > max) throw new IllegalArgumentException("value is too long");
        return clean;
    }

    private String requiredHttpUrl(String value) {
        String clean = required(value, "sourceUrl", 1000);
        try {
            URI uri = URI.create(clean);
            String scheme = uri.getScheme();
            if (!("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme))
                    || uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("sourceUrl must be a valid http(s) URL with a host");
            }
            return clean;
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("sourceUrl must be a valid http(s) URL with a host");
        }
    }
}
