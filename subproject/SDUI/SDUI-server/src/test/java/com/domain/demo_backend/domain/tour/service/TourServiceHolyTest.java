package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.client.TourApiClient;
import com.domain.demo_backend.domain.tour.domain.TourPoi;
import com.domain.demo_backend.domain.tour.domain.TourPoiRepository;
import com.domain.demo_backend.domain.tour.dto.HolyPoiDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 성지(HOLY) POI 조회 순수 단위 테스트 — Spring 컨텍스트·DB 불필요, 리포지토리 모킹.
 * Epic #74 · Dev-4(#96-A).
 */
class TourServiceHolyTest {

    private TourApiClient tourApiClient;
    private TourPoiRepository tourPoiRepository;
    private TourService tourService;

    @BeforeEach
    void setUp() {
        tourApiClient = mock(TourApiClient.class);
        tourPoiRepository = mock(TourPoiRepository.class);
        tourService = new TourService(tourApiClient, tourPoiRepository);
    }

    private TourPoi holy(String contentId, String title, String artist) {
        TourPoi p = new TourPoi();
        p.setContentId(contentId);
        p.setContentTypeId("HOLY");
        p.setSource("SEED");
        p.setTitle(title);
        p.setMapX(127.0);
        p.setMapY(37.5);
        p.setArtist(artist);
        p.setFandomInfo("팬덤 정보");
        p.setRecommendReason("추천 이유");
        p.setReviewStatus("APPROVED");
        return p;
    }

    @Test
    @DisplayName("성지 조회는 공공(TOURAPI) 제외 + APPROVED만 리포지토리에 요청한다")
    void holyQueryUsesApprovedNonTourapiFilter() {
        when(tourPoiRepository.findBySourceNotAndReviewStatusOrderByPoiSqnoAsc("TOURAPI", "APPROVED"))
                .thenReturn(List.of(holy("holy-a", "성지A", "BTS")));

        List<HolyPoiDto> result = tourService.getHolyPois();

        assertThat(result).hasSize(1);
        verify(tourPoiRepository).findBySourceNotAndReviewStatusOrderByPoiSqnoAsc("TOURAPI", "APPROVED");
        verifyNoInteractions(tourApiClient); // 성지는 TourAPI를 타지 않는다
    }

    @Test
    @DisplayName("엔티티 → DTO 매핑에 성지 확장 필드(artist/fandomInfo/recommendReason)가 보존된다")
    void dtoCarriesHolyFields() {
        when(tourPoiRepository.findBySourceNotAndReviewStatusOrderByPoiSqnoAsc("TOURAPI", "APPROVED"))
                .thenReturn(List.of(holy("holy-b", "성지B", "aespa")));

        HolyPoiDto dto = tourService.getHolyPois().get(0);

        assertThat(dto.contentId()).isEqualTo("holy-b");
        assertThat(dto.title()).isEqualTo("성지B");
        assertThat(dto.artist()).isEqualTo("aespa");
        assertThat(dto.fandomInfo()).isEqualTo("팬덤 정보");
        assertThat(dto.recommendReason()).isEqualTo("추천 이유");
        assertThat(dto.mapX()).isEqualTo(127.0);
        assertThat(dto.mapY()).isEqualTo(37.5);
    }

    @Test
    @DisplayName("결과가 없으면 빈 리스트를 반환한다(프론트는 시드 폴백 사용)")
    void emptyResultReturnsEmptyList() {
        when(tourPoiRepository.findBySourceNotAndReviewStatusOrderByPoiSqnoAsc("TOURAPI", "APPROVED"))
                .thenReturn(List.of());

        assertThat(tourService.getHolyPois()).isEmpty();
    }
}
