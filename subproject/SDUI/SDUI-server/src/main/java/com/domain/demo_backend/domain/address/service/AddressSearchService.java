package com.domain.demo_backend.domain.address.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 회원가입 주소 입력용 도로명 주소 검색.
 * 웹은 Daum 우편번호 iframe을 쓰지만 네이티브 앱은 iframe을 띄울 수 없어
 * 카카오 로컬 REST API를 서버에서 프록시한다(REST 키를 클라이언트에 노출하지 않기 위함).
 */
@Service
public class AddressSearchService {

    private static final int MAX_RESULTS = 10;

    private final WebClient webClient;
    private final String kakaoRestApiKey;
    private final String kakaoLocalAddressUrl;
    private final Duration requestTimeout;

    public AddressSearchService(
            WebClient.Builder webClientBuilder,
            @Value("${kakao.client-id}") String kakaoRestApiKey,
            @Value("${kakao.local.address-url:https://dapi.kakao.com/v2/local/search/address.json}")
            String kakaoLocalAddressUrl,
            @Value("${kakao.local.timeout:3s}") Duration requestTimeout) {
        this.webClient = webClientBuilder.build();
        this.kakaoRestApiKey = kakaoRestApiKey;
        this.kakaoLocalAddressUrl = kakaoLocalAddressUrl;
        this.requestTimeout = requestTimeout;
    }

    public List<Map<String, String>> search(String keyword) {
        String query = keyword == null ? "" : keyword.trim();
        if (query.length() < 2) {
            return List.of();
        }

        URI uri = UriComponentsBuilder.fromUriString(kakaoLocalAddressUrl)
                .queryParam("query", query)
                .queryParam("size", MAX_RESULTS)
                .queryParam("analyze_type", "similar")
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUri();

        @SuppressWarnings("unchecked")
        Map<String, Object> body = webClient.get()
                .uri(uri)
                .header("Authorization", "KakaoAK " + kakaoRestApiKey)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(requestTimeout)
                .block();

        return mapDocuments(body);
    }

    /** 카카오 로컬 응답의 documents를 앱 계약({zipCode, roadAddress, …})으로 변환. */
    static List<Map<String, String>> mapDocuments(Map<String, Object> body) {
        Object documents = body == null ? null : body.get("documents");
        if (!(documents instanceof List<?> list)) {
            return List.of();
        }

        List<Map<String, String>> items = new ArrayList<>();
        for (Object document : list) {
            if (!(document instanceof Map<?, ?> documentMap)) {
                continue;
            }
            // 우편번호(zone_no)는 도로명 주소에만 실려온다. 도로명이 없는 지번 전용
            // 결과는 회원가입 폼(zipCode + roadAddress 필수)에 쓸 수 없어 제외한다.
            Object roadAddress = documentMap.get("road_address");
            if (!(roadAddress instanceof Map<?, ?> roadMap)) {
                continue;
            }
            String zipCode = text(roadMap.get("zone_no"));
            String roadName = text(roadMap.get("address_name"));
            if (zipCode.isEmpty() || roadName.isEmpty()) {
                continue;
            }

            Map<String, String> item = new LinkedHashMap<>();
            item.put("zipCode", zipCode);
            item.put("roadAddress", roadName);
            Object jibun = documentMap.get("address");
            if (jibun instanceof Map<?, ?> jibunMap) {
                String jibunName = text(jibunMap.get("address_name"));
                if (!jibunName.isEmpty()) {
                    item.put("jibunAddress", jibunName);
                }
            }
            String buildingName = text(roadMap.get("building_name"));
            if (!buildingName.isEmpty()) {
                item.put("buildingName", buildingName);
            }
            items.add(item);
            if (items.size() == MAX_RESULTS) {
                break;
            }
        }
        return items;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
