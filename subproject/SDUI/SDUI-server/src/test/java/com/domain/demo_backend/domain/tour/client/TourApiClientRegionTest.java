package com.domain.demo_backend.domain.tour.client;

import com.domain.demo_backend.domain.tour.dto.TourRegionDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TourApiClientRegionTest {

    @Test
    @DisplayName("TourAPI areaCode2 복수 응답을 코드와 이름으로 정규화한다")
    void parsesRegionList() {
        Map<String, Object> response = Map.of(
                "response", Map.of(
                        "body", Map.of(
                                "items", Map.of(
                                        "item", List.of(
                                                Map.of("code", "1", "name", "서울", "rnum", 1),
                                                Map.of("code", "31", "name", "경기도", "rnum", 2)
                                        )
                                )
                        )
                )
        );

        assertThat(TourApiClient.parseRegions(response))
                .containsExactly(new TourRegionDto("1", "서울"), new TourRegionDto("31", "경기도"));
    }

    @Test
    @DisplayName("TourAPI areaCode2 단일 객체와 빈 items 응답을 안전하게 처리한다")
    void parsesSingleAndEmptyRegionResponses() {
        Map<String, Object> single = Map.of(
                "response", Map.of(
                        "body", Map.of(
                                "items", Map.of("item", Map.of("code", "23", "name", "종로구"))
                        )
                )
        );

        assertThat(TourApiClient.parseRegions(single))
                .containsExactly(new TourRegionDto("23", "종로구"));
        assertThat(TourApiClient.parseRegions(Map.of("response", Map.of("body", Map.of("items", "")))))
                .isEmpty();
    }
}
