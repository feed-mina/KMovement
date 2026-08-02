package com.domain.demo_backend.domain.tour.client;

import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import com.domain.demo_backend.domain.tour.dto.TourRegionDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * 한국관광공사 TourAPI(국문 관광정보) 클라이언트.
 * Epic #74 · Dev-2(#76).
 *
 * <p>서비스키는 {@code TOUR_API_KEY} 환경변수로 주입한다(미설정 시 부팅 경고, 호출 시 예외).
 * data.go.kr 서비스키는 <b>Decoded</b> 값을 넣으면 WebClient가 인코딩한다.</p>
 */
@Slf4j
@Component
public class TourApiClient {

    private final WebClient webClient;
    private final String serviceKey;
    private final String mobileApp;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /** 로그에 남길 응답 본문 길이 상한. 오류 봉투는 이 안에 다 들어온다. */
    private static final int BODY_PREVIEW_LIMIT = 400;

    public TourApiClient(
            @Value("${tour.base-url:https://apis.data.go.kr/B551011/KorService2}") String baseUrl,
            @Value("${tour.api-key:}") String serviceKey,
            @Value("${tour.mobile-app:Kride}") String mobileApp) {
        this.webClient = WebClient.builder().baseUrl(baseUrl).build();
        this.serviceKey = serviceKey;
        this.mobileApp = mobileApp;
        if (serviceKey == null || serviceKey.isBlank()) {
            log.warn("[TourApiClient] ⚠ TOUR_API_KEY 미설정. 관광 POI 조회가 실패합니다. 배포 환경에 서비스키를 주입하세요.");
        }
    }

    /**
     * 지역기반 관광정보 조회(areaBasedList2).
     *
     * @param areaCode      지역 코드(예: 1=서울). null이면 전체
     * @param contentTypeId 콘텐츠 타입(예: 39=음식점, 12=관광지). null이면 전체
     * @param numOfRows     페이지당 건수
     * @param pageNo        페이지 번호(1-base)
     */
    @SuppressWarnings("unchecked")
    public List<TourPoiDto> areaBasedList(String areaCode, String sigunguCode, String contentTypeId,
                                          String arrange, int numOfRows, int pageNo) {
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new IllegalStateException("TOUR_API_KEY가 설정되지 않았습니다.");
        }

        // WebClient의 baseUrl과 결합하려면 uriBuilder(문자열 경로)를 써야 한다.
        // URI 객체를 넘기면 baseUrl과 결합되지 않아 상대 URI로 요청이 실패한다.
        // Decoded 서비스키는 DefaultUriBuilderFactory가 정확히 1회 인코딩한다.
        Optional<String> area = Optional.ofNullable(areaCode).filter(s -> !s.isBlank());
        Optional<String> sigungu = Optional.ofNullable(sigunguCode).filter(s -> !s.isBlank());
        Optional<String> type = Optional.ofNullable(contentTypeId).filter(s -> !s.isBlank());
        // arrange: A=제목순, C=수정일순, D=생성일순 (기본 A)
        String arrangeCode = (arrange != null && !arrange.isBlank()) ? arrange : "A";

        Map<String, Object> res = requestJson("areaBasedList2", uriBuilder -> uriBuilder
                .path("/areaBasedList2")
                .queryParam("serviceKey", serviceKey)
                .queryParam("MobileOS", "ETC")
                .queryParam("MobileApp", mobileApp)
                .queryParam("_type", "json")
                .queryParam("arrange", arrangeCode)
                .queryParam("numOfRows", numOfRows)
                .queryParam("pageNo", pageNo)
                .queryParamIfPresent("areaCode", area)
                .queryParamIfPresent("sigunguCode", sigungu)
                .queryParamIfPresent("contentTypeId", type)
                .build());

        return parseItems(res);
    }

    /**
     * 위치기반 관광정보 조회(locationBasedList2).
     *
     * <p>성지 시드는 TourAPI content_id 가 없어 ID 로 이어 붙일 수 없다. 좌표 반경으로
     * 후보를 좁힌 뒤 이름으로 같은 장소인지 확인하는 사진 보강 경로에서 쓴다.</p>
     *
     * @param mapX   경도(lng)
     * @param mapY   위도(lat)
     * @param radius 반경(m). TourAPI 최대 20000
     */
    public List<TourPoiDto> locationBasedList(double mapX, double mapY, int radius, int numOfRows) {
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new IllegalStateException("TOUR_API_KEY가 설정되지 않았습니다.");
        }

        Map<String, Object> res = requestJson("locationBasedList2", uriBuilder -> uriBuilder
                .path("/locationBasedList2")
                .queryParam("serviceKey", serviceKey)
                .queryParam("MobileOS", "ETC")
                .queryParam("MobileApp", mobileApp)
                .queryParam("_type", "json")
                .queryParam("arrange", "E") // E=거리순
                .queryParam("mapX", mapX)
                .queryParam("mapY", mapY)
                .queryParam("radius", radius)
                .queryParam("numOfRows", numOfRows)
                .queryParam("pageNo", 1)
                .build());

        return parseItems(res);
    }

    /**
     * Returns TourAPI area codes. Without {@code areaCode}, this returns provinces;
     * with an area code, it returns that province's districts.
     */
    public List<TourRegionDto> areaCodes(String areaCode) {
        if (serviceKey == null || serviceKey.isBlank()) {
            throw new IllegalStateException("TOUR_API_KEY is not configured");
        }

        Optional<String> area = Optional.ofNullable(areaCode).filter(s -> !s.isBlank());
        Map<String, Object> res = requestJson("areaCode2", uriBuilder -> uriBuilder
                .path("/areaCode2")
                .queryParam("serviceKey", serviceKey)
                .queryParam("MobileOS", "ETC")
                .queryParam("MobileApp", mobileApp)
                .queryParam("_type", "json")
                .queryParam("numOfRows", 100)
                .queryParam("pageNo", 1)
                .queryParamIfPresent("areaCode", area)
                .build());

        return parseRegions(res);
    }

    /**
     * TourAPI 를 호출해 JSON 본문을 Map 으로 돌려준다. 실패하면 이유를 로그에 남긴다.
     *
     * <p>본문을 {@code String} 으로 받아 직접 파싱한다. 바로 Map 으로 역직렬화하면
     * 서비스키가 거부됐을 때 {@code UnsupportedMediaTypeException} 만 올라오고 이유가
     * 사라진다 — data.go.kr 은 키가 미등록·미승인이거나 한도를 넘으면 {@code _type=json}
     * 을 무시하고 XML 오류 봉투를 돌려주기 때문이다. 그 봉투에 원인이 적혀 있다
     * (SERVICE_KEY_IS_NOT_REGISTERED_ERROR, LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS 등).</p>
     *
     * <p>이 저장소는 공개다. 본문에 서비스키가 섞여 나올 수 있으므로 가린 뒤 남긴다.</p>
     */
    private Map<String, Object> requestJson(String operation, Function<UriBuilder, URI> uriFunction) {
        String body;
        try {
            body = webClient.get().uri(uriFunction).retrieve().bodyToMono(String.class).block();
        } catch (WebClientResponseException e) {
            log.error("[TourApiClient] {} HTTP 오류 - status={}, body={}",
                    operation, e.getStatusCode(), preview(e.getResponseBodyAsString(), serviceKey));
            throw e;
        }

        return parseJsonBody(operation, body, serviceKey);
    }

    /**
     * 응답 본문을 Map 으로 만든다. 실패하면 원인을 로그에 남기고 예외를 던진다.
     *
     * <p>예외 메시지에는 본문을 넣지 않는다. 메시지는 응답으로 새어 나갈 수 있고,
     * 진단에 필요한 본문은 로그에 있다.</p>
     */
    static Map<String, Object> parseJsonBody(String operation, String body, String serviceKey) {
        if (body == null || body.isBlank()) {
            log.error("[TourApiClient] {} 응답 본문이 비어 있습니다.", operation);
            throw new IllegalStateException("TourAPI 응답이 비어 있습니다: " + operation);
        }

        String trimmed = body.stripLeading();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            log.error("[TourApiClient] {} 가 JSON 이 아닌 응답을 돌려줬습니다. 서비스키가 거부됐을 가능성이 큽니다"
                            + " (Encoded 대신 Decoded 키인지, KorService2 활용신청이 승인됐는지 확인). body={}",
                    operation, preview(body, serviceKey));
            throw new IllegalStateException("TourAPI 가 JSON 이 아닌 응답을 돌려줬습니다: " + operation);
        }

        Map<String, Object> parsed;
        try {
            parsed = OBJECT_MAPPER.readValue(body, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            log.error("[TourApiClient] {} 응답 JSON 파싱 실패 - body={}", operation, preview(body, serviceKey));
            throw new IllegalStateException("TourAPI 응답을 해석하지 못했습니다: " + operation, e);
        }

        String abnormal = abnormalResultCode(parsed);
        if (abnormal != null) {
            log.error("[TourApiClient] {} 응답 코드가 정상이 아닙니다 - {}", operation, abnormal);
        }
        return parsed;
    }

    /**
     * JSON 으로 오는 오류도 있다. 이때 resultCode 는 "0000" 이 아니고 body 가 비어 있어
     * 파서가 빈 목록을 돌려준다 — 예외가 아니라 "결과 0건" 으로 보인다.
     *
     * @return 이상이 있으면 "resultCode=..., resultMsg=..." 형태, 정상이면 null
     */
    @SuppressWarnings("unchecked")
    static String abnormalResultCode(Map<String, Object> parsed) {
        if (!(parsed.get("response") instanceof Map<?, ?> response)) return null;
        if (!(((Map<String, Object>) response).get("header") instanceof Map<?, ?> header)) return null;

        Map<String, Object> head = (Map<String, Object>) header;
        String resultCode = str(head.get("resultCode"));
        if (resultCode == null || "0000".equals(resultCode)) return null;

        return "resultCode=" + resultCode + ", resultMsg=" + str(head.get("resultMsg"));
    }

    /**
     * 서비스키를 가리고 길이를 잘라 한 줄로 만든다.
     * 이 저장소는 공개고 배포 로그도 공개다. 본문에 키가 섞여 나올 수 있다.
     */
    static String preview(String body, String serviceKey) {
        if (body == null || body.isBlank()) return "<empty>";
        String masked = body;
        if (serviceKey != null && !serviceKey.isBlank()) {
            masked = masked.replace(serviceKey, "***");
        }
        masked = masked.replaceAll("\\s+", " ").trim();
        return masked.length() <= BODY_PREVIEW_LIMIT
                ? masked
                : masked.substring(0, BODY_PREVIEW_LIMIT) + "…(생략)";
    }

    @SuppressWarnings("unchecked")
    static List<TourRegionDto> parseRegions(Map<String, Object> res) {
        List<TourRegionDto> out = new ArrayList<>();
        if (res == null) return out;

        Object responseObj = res.get("response");
        if (!(responseObj instanceof Map<?, ?> response)) return out;
        Object bodyObj = ((Map<String, Object>) response).get("body");
        if (!(bodyObj instanceof Map<?, ?> body)) return out;
        Object itemsObj = ((Map<String, Object>) body).get("items");
        if (!(itemsObj instanceof Map<?, ?> items)) return out;
        Object itemObj = ((Map<String, Object>) items).get("item");

        List<Map<String, Object>> itemList = new ArrayList<>();
        if (itemObj instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) itemList.add((Map<String, Object>) map);
            }
        } else if (itemObj instanceof Map<?, ?> single) {
            itemList.add((Map<String, Object>) single);
        }

        for (Map<String, Object> item : itemList) {
            String code = str(item.get("code"));
            String name = str(item.get("name"));
            if (code != null && !code.isBlank() && name != null && !name.isBlank()) {
                out.add(new TourRegionDto(code, name));
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    static List<TourPoiDto> parseItems(Map<String, Object> res) {
        List<TourPoiDto> out = new ArrayList<>();
        if (res == null) return out;

        Object responseObj = res.get("response");
        if (!(responseObj instanceof Map<?, ?> response)) return out;
        Object bodyObj = ((Map<String, Object>) response).get("body");
        if (!(bodyObj instanceof Map<?, ?> body)) return out;
        Object itemsObj = ((Map<String, Object>) body).get("items");
        if (!(itemsObj instanceof Map<?, ?> items)) return out; // 결과 0건이면 items=""(String)

        Object itemObj = ((Map<String, Object>) items).get("item");
        List<Map<String, Object>> itemList = new ArrayList<>();
        if (itemObj instanceof List<?> list) {
            for (Object o : list) if (o instanceof Map<?, ?> m) itemList.add((Map<String, Object>) m);
        } else if (itemObj instanceof Map<?, ?> single) {
            itemList.add((Map<String, Object>) single); // 1건이면 단일 객체
        }

        for (Map<String, Object> it : itemList) {
            out.add(new TourPoiDto(
                    str(it.get("contentid")),
                    str(it.get("contenttypeid")),
                    str(it.get("title")),
                    str(it.get("addr1")),
                    parseDouble(it.get("mapx")),
                    parseDouble(it.get("mapy")),
                    str(it.get("firstimage")),
                    // firstimage2 는 같은 사진의 썸네일이다. 카드는 150×100 으로 그리는데
                    // 원본은 수백 KB~수 MB 라 첫 화면에서만 몇 MB 를 받게 된다.
                    str(it.get("firstimage2")),
                    str(it.get("tel")),
                    str(it.get("cat1")),
                    str(it.get("cat2")),
                    str(it.get("cat3")),
                    str(it.get("areacode"))
            ));
        }
        return out;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static Double parseDouble(Object o) {
        if (o == null) return null;
        try {
            String s = o.toString().trim();
            return s.isEmpty() ? null : Double.valueOf(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
