package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.client.TourApiClient;
import com.domain.demo_backend.domain.tour.domain.TourPoi;
import com.domain.demo_backend.domain.tour.domain.TourPoiRepository;
import com.domain.demo_backend.domain.tour.dto.HolyPoiDto;
import com.domain.demo_backend.domain.tour.dto.HolyReviewItemDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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

    // ── 검수(2차) ──

    @Test
    @DisplayName("검수 대기 큐는 PENDING 상태만 조회한다")
    void pendingQueueQueriesPendingOnly() {
        when(tourPoiRepository.findBySourceNotAndReviewStatusOrderByPoiSqnoAsc("TOURAPI", "PENDING"))
                .thenReturn(List.of(holy("holy-p", "대기성지", "IVE")));

        List<HolyReviewItemDto> queue = tourService.getPendingHolyPois();

        assertThat(queue).hasSize(1);
        assertThat(queue.get(0).title()).isEqualTo("대기성지");
        verify(tourPoiRepository).findBySourceNotAndReviewStatusOrderByPoiSqnoAsc("TOURAPI", "PENDING");
    }

    @Test
    @DisplayName("APPROVE 액션은 APPROVED로 저장하고 검수자·시각을 기록한다")
    void approveSetsApprovedWithReviewer() {
        TourPoi pending = holy("holy-p", "대기성지", "IVE");
        pending.setPoiSqno(10L);
        pending.setReviewStatus("PENDING");
        when(tourPoiRepository.findById(10L)).thenReturn(Optional.of(pending));
        when(tourPoiRepository.save(any(TourPoi.class))).thenAnswer(inv -> inv.getArgument(0));

        HolyReviewItemDto result = tourService.reviewHolyPoi(10L, "APPROVE", "adminUser");

        assertThat(result.reviewStatus()).isEqualTo("APPROVED");
        assertThat(result.reviewedBy()).isEqualTo("adminUser");
        assertThat(result.reviewedAt()).isNotNull();
    }

    @Test
    @DisplayName("REJECT 액션은 REJECTED로 저장한다")
    void rejectSetsRejected() {
        TourPoi pending = holy("holy-r", "반려성지", "다수");
        pending.setPoiSqno(11L);
        pending.setReviewStatus("PENDING");
        when(tourPoiRepository.findById(11L)).thenReturn(Optional.of(pending));
        when(tourPoiRepository.save(any(TourPoi.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(tourService.reviewHolyPoi(11L, "reject", "adminUser").reviewStatus())
                .isEqualTo("REJECTED");
    }

    @Test
    @DisplayName("잘못된 action·없는 poiSqno·공공(TOURAPI) 행은 IllegalArgumentException")
    void invalidReviewRequestsThrow() {
        TourPoi pending = holy("holy-x", "성지X", "다수");
        pending.setPoiSqno(12L);
        pending.setReviewStatus("PENDING");
        when(tourPoiRepository.findById(12L)).thenReturn(Optional.of(pending));
        when(tourPoiRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tourService.reviewHolyPoi(12L, "DELETE", "admin"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> tourService.reviewHolyPoi(99L, "APPROVE", "admin"))
                .isInstanceOf(IllegalArgumentException.class);

        TourPoi publicPoi = holy("tourapi-1", "공공POI", null);
        publicPoi.setPoiSqno(13L);
        publicPoi.setSource("TOURAPI");
        when(tourPoiRepository.findById(13L)).thenReturn(Optional.of(publicPoi));
        assertThatThrownBy(() -> tourService.reviewHolyPoi(13L, "APPROVE", "admin"))
                .isInstanceOf(IllegalArgumentException.class);

        TourPoi alreadyReviewed = holy("holy-reviewed", "검수완료", "BTS");
        alreadyReviewed.setPoiSqno(14L);
        alreadyReviewed.setSource("UGC");
        when(tourPoiRepository.findById(14L)).thenReturn(Optional.of(alreadyReviewed));
        assertThatThrownBy(() -> tourService.reviewHolyPoi(14L, "REJECT", "admin"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PENDING");

        verify(tourPoiRepository, never()).save(any(TourPoi.class));
    }

    @Test
    @DisplayName("UGC 제보는 출처와 제출자를 보존한 PENDING 성지로 저장한다")
    void ugcSubmissionCreatesPendingPoi() {
        when(tourPoiRepository.findFirstBySourceUrlAndReviewStatus("https://example.com/fact", "PENDING"))
                .thenReturn(Optional.empty());
        when(tourPoiRepository.save(any(TourPoi.class))).thenAnswer(inv -> {
            TourPoi poi = inv.getArgument(0);
            assertThat(poi.getSource()).isEqualTo("UGC");
            assertThat(poi.getReviewStatus()).isEqualTo("PENDING");
            assertThat(poi.getSubmittedBy()).isEqualTo(7L);
            poi.setPoiSqno(101L);
            return poi;
        });

        HolyReviewItemDto result = tourService.submitHolyPoi("서울숲 촬영지", "서울 성동구", 127.04, 37.54,
                "BTS", "공개 출처로 촬영 사실을 확인했습니다.", "https://example.com/fact", 7L);

        assertThat(result.source()).isEqualTo("UGC");
        assertThat(result.reviewStatus()).isEqualTo("PENDING");
        verify(tourPoiRepository).save(any(TourPoi.class));
    }

    @Test
    @DisplayName("동일 출처의 PENDING 제보는 중복 등록하지 않는다")
    void duplicatePendingSourceIsRejected() {
        when(tourPoiRepository.findFirstBySourceUrlAndReviewStatus("https://example.com/fact", "PENDING"))
                .thenReturn(Optional.of(holy("old", "기존 제보", "BTS")));

        assertThatThrownBy(() -> tourService.submitHolyPoi("서울숲", "서울", 127.04, 37.54,
                "BTS", "확인된 사실", "https://example.com/fact", 7L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already pending");
        verify(tourPoiRepository, never()).save(any(TourPoi.class));
    }

    @Test
    @DisplayName("출처 URL과 한국 좌표가 유효하지 않으면 UGC 제보를 거부한다")
    void invalidUgcSubmissionIsRejected() {
        assertThatThrownBy(() -> tourService.submitHolyPoi("서울숲", "서울", 10.0, 10.0,
                "BTS", "확인된 사실", "not-a-url", 7L))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> tourService.submitHolyPoi("서울숲", "서울", 127.04, 37.54,
                "BTS", "확인된 사실", "https://", 7L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("with a host");
        assertThatThrownBy(() -> tourService.submitHolyPoi("서울숲", "서울", Double.NaN, 37.54,
                "BTS", "확인된 사실", "https://example.com/fact", 7L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("South Korea");
        verify(tourPoiRepository, never()).save(any(TourPoi.class));
    }
}
