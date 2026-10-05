package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.tour.client.TourApiClient;
import com.domain.demo_backend.domain.tour.domain.HolyContentRepository;
import com.domain.demo_backend.domain.tour.domain.TourPoiRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TourServiceRestaurantTest {

    private TourApiClient tourApiClient;
    private TourService tourService;

    @BeforeEach
    void setUp() {
        tourApiClient = mock(TourApiClient.class);
        tourService = new TourService(
                tourApiClient,
                mock(TourPoiRepository.class),
                mock(HolyContentRepository.class), mock(com.domain.demo_backend.domain.tour.domain.HolyReviewAuditRepository.class));
    }

    @Test
    @DisplayName("맛집 페이지는 지역, 시군구, 정렬, 페이지와 음식점 타입을 그대로 전달한다")
    void restaurantPageKeepsAllFilters() {
        when(tourApiClient.areaBasedList("1", "23", "39", "C", 24, 2))
                .thenReturn(List.of());

        tourService.getRestaurants("1", "23", "C", 24, 2);

        verify(tourApiClient).areaBasedList("1", "23", "39", "C", 24, 2);
    }
}
