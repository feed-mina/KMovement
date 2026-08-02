package com.domain.demo_backend.domain.tour.client;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * TourAPI 호출이 실패했을 때 "왜" 가 로그에 남는지 확인한다.
 *
 * <p>지금까지는 화면에 "장소를 불러오지 못했어요" 만 뜨고 서버에는 아무것도 남지
 * 않아, 서비스키가 거부된 것인지 상류가 죽은 것인지 배포 로그로 구분할 수 없었다.</p>
 */
class TourApiClientDiagnosticsTest {

    /** data.go.kr 이 키를 거부할 때 실제로 돌려주는 봉투. _type=json 이어도 XML 이다. */
    private static final String SERVICE_KEY_REJECTED = """
            <OpenAPI_ServiceResponse>
              <cmmMsgHeader>
                <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
                <returnReasonCode>30</returnReasonCode>
              </cmmMsgHeader>
            </OpenAPI_ServiceResponse>
            """;

    @Test
    @DisplayName("JSON 이 아닌 오류 봉투는 조용히 빈 목록이 되지 않고 예외가 된다")
    void nonJsonBodyBecomesAnError() {
        assertThatThrownBy(() -> TourApiClient.parseJsonBody("areaCode2", SERVICE_KEY_REJECTED, "key"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("areaCode2");
    }

    @Test
    @DisplayName("빈 응답도 예외로 올린다")
    void blankBodyBecomesAnError() {
        assertThatThrownBy(() -> TourApiClient.parseJsonBody("areaCode2", "   ", "key"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("예외 메시지에는 응답 본문을 넣지 않는다 — 메시지는 응답으로 새어 나갈 수 있다")
    void errorMessageCarriesNoResponseBody() {
        assertThatThrownBy(() -> TourApiClient.parseJsonBody("areaCode2", SERVICE_KEY_REJECTED, "key"))
                .hasMessageNotContaining("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");
    }

    @Test
    @DisplayName("정상 JSON 은 그대로 Map 이 된다")
    void validJsonParses() {
        Map<String, Object> parsed = TourApiClient.parseJsonBody(
                "areaCode2",
                "{\"response\":{\"header\":{\"resultCode\":\"0000\"},\"body\":{\"items\":\"\"}}}",
                "key");

        assertThat(parsed).containsKey("response");
    }

    @Test
    @DisplayName("resultCode 가 0000 이 아니면 이상으로 잡는다 — 이 응답은 결과 0건과 구분이 안 된다")
    void abnormalResultCodeIsDetected() {
        Map<String, Object> failed = Map.of("response", Map.of(
                "header", Map.of("resultCode", "22", "resultMsg", "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR")));

        assertThat(TourApiClient.abnormalResultCode(failed))
                .contains("resultCode=22")
                .contains("LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR");
    }

    @Test
    @DisplayName("정상 응답과 header 없는 응답은 이상으로 잡지 않는다")
    void normalResponsesAreNotFlagged() {
        assertThat(TourApiClient.abnormalResultCode(
                Map.of("response", Map.of("header", Map.of("resultCode", "0000"))))).isNull();
        assertThat(TourApiClient.abnormalResultCode(Map.of("response", Map.of()))).isNull();
        assertThat(TourApiClient.abnormalResultCode(Map.of())).isNull();
    }

    @Test
    @DisplayName("로그에 남기는 본문에서 서비스키를 가린다 — 저장소도 배포 로그도 공개다")
    void previewMasksTheServiceKey() {
        String body = "<returnAuthMsg>bad</returnAuthMsg><serviceKey>s3cr3t-key</serviceKey>";

        String masked = TourApiClient.preview(body, "s3cr3t-key");

        assertThat(masked).doesNotContain("s3cr3t-key");
        assertThat(masked).contains("***");
    }

    @Test
    @DisplayName("본문이 길면 자르고, 여러 줄은 한 줄로 만든다")
    void previewTruncatesAndFlattens() {
        String masked = TourApiClient.preview("a\n  b\tc", "key");
        assertThat(masked).isEqualTo("a b c");

        assertThat(TourApiClient.preview("x".repeat(5000), "key")).hasSizeLessThan(500);
        assertThat(TourApiClient.preview(null, "key")).isEqualTo("<empty>");
    }

    @Test
    @DisplayName("카드용 썸네일(firstimage2)을 원본과 따로 담는다")
    void thumbnailIsCarriedSeparatelyFromTheOriginal() {
        Map<String, Object> response = Map.of("response", Map.of("body", Map.of("items", Map.of(
                "item", List.of(Map.of(
                        "contentid", "1",
                        "title", "서울숲",
                        "firstimage", "https://img/original.jpg",
                        "firstimage2", "https://img/thumb.jpg"))))));

        var pois = TourApiClient.parseItems(response);

        assertThat(pois).hasSize(1);
        assertThat(pois.get(0).firstImage()).isEqualTo("https://img/original.jpg");
        assertThat(pois.get(0).thumbnail()).isEqualTo("https://img/thumb.jpg");
    }

    @Test
    @DisplayName("썸네일이 없는 장소는 null 이다 — 화면이 원본으로 떨어지도록")
    void missingThumbnailStaysNull() {
        Map<String, Object> response = Map.of("response", Map.of("body", Map.of("items", Map.of(
                "item", List.of(Map.of("contentid", "1", "title", "서울숲", "firstimage", "https://img/o.jpg"))))));

        assertThat(TourApiClient.parseItems(response).get(0).thumbnail()).isNull();
    }
}
