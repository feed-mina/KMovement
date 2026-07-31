package com.domain.demo_backend.domain.tour.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 성지 사진 보강의 오매칭 방지 기준.
 * 잘못된 사진이 붙는 것은 사진이 없는 것보다 나쁘므로, 애매하면 붙이지 않는 쪽이 옳다.
 */
class PoiTitleMatcherTest {

    @Test
    @DisplayName("같은 장소는 표기가 달라도 같다고 본다")
    void matchesSamePlaceDespiteFormatting() {
        assertThat(PoiTitleMatcher.isSamePlace("셀렉토커피 남양주호평점", "셀렉토커피남양주호평점")).isTrue();
        assertThat(PoiTitleMatcher.isSamePlace("임진각 평화누리", "임진각평화누리")).isTrue();
        assertThat(PoiTitleMatcher.isSamePlace("카페 그루비", "카페그루비(수원점)")).isTrue();
        assertThat(PoiTitleMatcher.isSamePlace("감천문화마을", "감천 문화마을")).isTrue();
    }

    @Test
    @DisplayName("반경 안의 다른 가게는 붙이지 않는다")
    void rejectsNearbyButDifferentPlaces() {
        assertThat(PoiTitleMatcher.isSamePlace("커피파머", "스타벅스 일산대화점")).isFalse();
        assertThat(PoiTitleMatcher.isSamePlace("초은당", "북한강 카페거리")).isFalse();
        assertThat(PoiTitleMatcher.isSamePlace("미리내 성지", "안성맞춤랜드")).isFalse();
    }

    @Test
    @DisplayName("짧은 공통어만으로 같은 장소가 되지 않는다")
    void shortCommonWordsDoNotMatch() {
        // '카페'가 들어간다고 같은 카페가 아니다.
        assertThat(PoiTitleMatcher.isSamePlace("카페", "카페 그루비")).isFalse();
        assertThat(PoiTitleMatcher.isSamePlace("초원사진관", "초원")).isFalse();
    }

    @Test
    @DisplayName("빈 값과 null 은 매칭되지 않는다")
    void emptyNeverMatches() {
        assertThat(PoiTitleMatcher.isSamePlace(null, "자갈치시장")).isFalse();
        assertThat(PoiTitleMatcher.isSamePlace("자갈치시장", null)).isFalse();
        assertThat(PoiTitleMatcher.isSamePlace("  ", "자갈치시장")).isFalse();
        assertThat(PoiTitleMatcher.similarity("", "")).isZero();
    }

    @Test
    @DisplayName("완전히 같은 이름은 1.0")
    void identicalScoresOne() {
        assertThat(PoiTitleMatcher.similarity("광장시장", "광장시장")).isEqualTo(1.0d);
    }
}
