package com.domain.demo_backend.domain.tour.client;

import com.domain.demo_backend.domain.tour.dto.TourPoiDto;
import com.domain.demo_backend.domain.tour.dto.TourRegionDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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

        Map<String, Object> res = webClient.get()
                .uri(uriBuilder -> uriBuilder
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
                        .build())
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();

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

        Map<String, Object> res = webClient.get()
                .uri(uriBuilder -> uriBuilder
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
                        .build())
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();

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
        Map<String, Object> res = webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/areaCode2")
                        .queryParam("serviceKey", serviceKey)
                        .queryParam("MobileOS", "ETC")
                        .queryParam("MobileApp", mobileApp)
                        .queryParam("_type", "json")
                        .queryParam("numOfRows", 100)
                        .queryParam("pageNo", 1)
                        .queryParamIfPresent("areaCode", area)
                        .build())
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();

        return parseRegions(res);
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
    private List<TourPoiDto> parseItems(Map<String, Object> res) {
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
