package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 반경 후보 중 어떤 사진을 가져올지 고르는 규칙. */
class TourServiceImageBackfillTest {

    private TourPoiDto candidate(String title, String image) {
        return new TourPoiDto("c-" + title, "39", title, "주소", 127.0, 37.0, image, null, null, null, null, "1");
    }

    @Test
    @DisplayName("이름이 맞고 사진이 있는 후보를 고른다")
    void picksMatchingCandidateWithImage() {
        List<TourPoiDto> candidates = List.of(
                candidate("옆집분식", "https://img/other.jpg"),
                candidate("카페그루비", "https://img/groovy.jpg"));

        TourPoiDto match = TourService.bestImageMatch("카페 그루비", candidates);

        assertThat(match).isNotNull();
        assertThat(match.firstImage()).isEqualTo("https://img/groovy.jpg");
    }

    @Test
    @DisplayName("이름이 맞아도 사진이 없으면 고르지 않는다")
    void ignoresMatchingCandidateWithoutImage() {
        List<TourPoiDto> candidates = List.of(
                candidate("카페그루비", null),
                candidate("카페그루비", "  "));

        assertThat(TourService.bestImageMatch("카페 그루비", candidates)).isNull();
    }

    @Test
    @DisplayName("반경 안에 같은 장소가 없으면 아무것도 붙이지 않는다")
    void returnsNullWhenNothingMatches() {
        List<TourPoiDto> candidates = List.of(
                candidate("스타벅스 일산대화점", "https://img/a.jpg"),
                candidate("이마트 대화점", "https://img/b.jpg"));

        assertThat(TourService.bestImageMatch("커피파머", candidates)).isNull();
    }

    @Test
    @DisplayName("후보가 비었거나 제목이 없으면 null")
    void handlesEmptyInput() {
        assertThat(TourService.bestImageMatch("커피파머", List.of())).isNull();
        assertThat(TourService.bestImageMatch(null, List.of(candidate("커피파머", "https://img/a.jpg")))).isNull();
        assertThat(TourService.bestImageMatch("커피파머", null)).isNull();
    }

    @Test
    @DisplayName("여러 후보가 맞으면 더 비슷한 쪽을 고른다")
    void prefersTheCloserTitle() {
        List<TourPoiDto> candidates = List.of(
                candidate("광장시장 먹거리", "https://img/loose.jpg"),
                candidate("광장시장", "https://img/exact.jpg"));

        TourPoiDto match = TourService.bestImageMatch("광장시장", candidates);

        assertThat(match.firstImage()).isEqualTo("https://img/exact.jpg");
    }
}
