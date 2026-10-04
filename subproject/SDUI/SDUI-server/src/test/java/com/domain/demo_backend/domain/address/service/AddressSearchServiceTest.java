package com.domain.demo_backend.domain.address.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AddressSearchServiceTest {

    @Test
    @DisplayName("검색어와 KakaoAK 헤더로 카카오 REST API를 호출한다")
    void search_callsConfiguredKakaoEndpointWithoutExposingTheKey() {
        AtomicReference<String> requestedUrl = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> {
            requestedUrl.set(request.url().toString());
            authorization.set(request.headers().getFirst(HttpHeaders.AUTHORIZATION));
            return Mono.just(ClientResponse.create(HttpStatus.OK)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body("{\"documents\":[{\"road_address\":{\"zone_no\":\"06236\",\"address_name\":\"서울 강남구 테헤란로 152\"}}]}")
                    .build());
        });
        AddressSearchService service = new AddressSearchService(
                builder,
                "test-rest-key",
                "https://kakao.test/v2/local/search/address.json",
                Duration.ofSeconds(1));

        List<Map<String, String>> items = service.search(" 테헤란로 152 ");

        assertEquals("KakaoAK test-rest-key", authorization.get());
        assertTrue(requestedUrl.get().startsWith("https://kakao.test/v2/local/search/address.json?"));
        assertTrue(requestedUrl.get().contains("size=10"));
        assertTrue(requestedUrl.get().contains("analyze_type=similar"));
        assertEquals("06236", items.get(0).get("zipCode"));
    }

    @Test
    @DisplayName("외부 API가 제한 시간 안에 응답하지 않으면 요청을 종료한다")
    void search_timesOut() {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> Mono.never());
        AddressSearchService service = new AddressSearchService(
                builder,
                "test-rest-key",
                "https://kakao.test/v2/local/search/address.json",
                Duration.ofMillis(10));

        assertThrows(RuntimeException.class, () -> service.search("테헤란로"));
    }

    @Test
    @DisplayName("두 글자 미만 검색어는 외부 API를 호출하지 않는다")
    void search_skipsShortKeywords() {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> {
            throw new AssertionError("short keyword must not call the upstream API");
        });
        AddressSearchService service = new AddressSearchService(
                builder,
                "test-rest-key",
                "https://kakao.test/v2/local/search/address.json",
                Duration.ofSeconds(1));

        assertTrue(service.search("강").isEmpty());
    }

    @Test
    @DisplayName("카카오 로컬 응답을 앱 계약(zipCode/roadAddress)으로 변환한다")
    void mapDocuments_mapsRoadAddressRows() {
        Map<String, Object> body = Map.of(
                "documents", List.of(
                        Map.of(
                                "address_name", "서울 강남구 테헤란로 152",
                                "road_address", Map.of(
                                        "address_name", "서울 강남구 테헤란로 152",
                                        "zone_no", "06236",
                                        "building_name", "강남파이낸스센터"),
                                "address", Map.of("address_name", "서울 강남구 역삼동 737"))));

        List<Map<String, String>> items = AddressSearchService.mapDocuments(body);

        assertEquals(1, items.size());
        Map<String, String> item = items.get(0);
        assertEquals("06236", item.get("zipCode"));
        assertEquals("서울 강남구 테헤란로 152", item.get("roadAddress"));
        assertEquals("서울 강남구 역삼동 737", item.get("jibunAddress"));
        assertEquals("강남파이낸스센터", item.get("buildingName"));
    }

    @Test
    @DisplayName("도로명 주소가 없는(지번 전용) 결과는 제외한다 — 우편번호를 채울 수 없기 때문")
    void mapDocuments_skipsJibunOnlyRows() {
        Map<String, Object> body = Map.of(
                "documents", List.of(
                        Map.of("address_name", "지번만 있는 주소",
                                "address", Map.of("address_name", "서울 어딘가 1-1"))));

        assertTrue(AddressSearchService.mapDocuments(body).isEmpty());
    }

    @Test
    @DisplayName("응답이 null이거나 documents가 없어도 빈 목록을 돌려준다")
    void mapDocuments_toleratesMalformedBodies() {
        assertTrue(AddressSearchService.mapDocuments(null).isEmpty());
        assertTrue(AddressSearchService.mapDocuments(Map.of()).isEmpty());
        assertTrue(AddressSearchService.mapDocuments(Map.of("documents", "oops")).isEmpty());
    }

    @Test
    @DisplayName("카카오가 더 많이 반환해도 앱 계약은 최대 10건이다")
    void mapDocuments_capsResultsAtTen() {
        List<Map<String, Object>> documents = java.util.stream.IntStream.range(0, 12)
                .mapToObj(index -> Map.<String, Object>of(
                        "road_address", Map.of(
                                "address_name", "서울 테스트로 " + index,
                                "zone_no", String.format("%05d", index))))
                .toList();

        assertEquals(10, AddressSearchService.mapDocuments(Map.of("documents", documents)).size());
    }
}
