package com.domain.demo_backend.domain.address.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AddressSearchServiceTest {

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
}
