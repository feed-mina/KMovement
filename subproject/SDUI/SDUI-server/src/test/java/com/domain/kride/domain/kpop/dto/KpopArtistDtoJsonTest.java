package com.domain.kride.domain.kpop.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.sql.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Map 응답을 record 로 바꾼 뒤에도 JSON 모양(키 이름, 날짜 형식)이 그대로인지 확인한다. */
class KpopArtistDtoJsonTest {

    // Spring Boot 기본 설정과 같게: 날짜를 숫자가 아닌 "yyyy-MM-dd" 로 쓴다.
    private final ObjectMapper mapper = Jackson2ObjectMapperBuilder.json()
            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build();

    @Test
    void artistDetailKeepsTheSameJsonKeysAndDateFormat() throws Exception {
        Map<String, Object> artistRow = new HashMap<>();
        artistRow.put("id", 7L);
        artistRow.put("slug", "aespa");
        artistRow.put("nameKo", "에스파");
        artistRow.put("nameEn", "aespa");
        artistRow.put("profile", null);
        Map<String, Object> eventRow = Map.of(
                "id", 11L, "artistId", 7L, "titleKo", "팬미팅",
                "date", Date.valueOf("2026-10-05"), "officialUrl", "https://example.com");

        KpopArtistDetailDto detail = KpopArtistDetailDto.of(
                KpopArtistDto.fromRow(artistRow), List.of(KpopArtistEventDto.fromRow(eventRow)));
        JsonNode json = mapper.readTree(mapper.writeValueAsString(detail));

        assertThat(json.get("id").asLong()).isEqualTo(7L);
        assertThat(json.get("nameKo").asText()).isEqualTo("에스파");
        assertThat(json.has("profile")).isTrue();
        assertThat(json.get("events").get(0).get("date").asText()).isEqualTo("2026-10-05");

        // Redis 캐시에 남은 예전 Map JSON 도 그대로 읽혀야 한다.
        String cachedMapJson = "{\"id\":7,\"slug\":\"aespa\",\"nameKo\":\"에스파\",\"events\":"
                + "[{\"id\":11,\"artistId\":7,\"date\":\"2026-10-05\"}],\"extra\":1}";
        KpopArtistDetailDto restored = mapper.readValue(cachedMapJson, KpopArtistDetailDto.class);
        assertThat(restored.events().get(0).date()).hasToString("2026-10-05");
    }
}
