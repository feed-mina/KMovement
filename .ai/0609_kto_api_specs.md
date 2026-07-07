# 한국관광공사 OpenAPI 호출 스펙 정리 (ennoia API 커넥터용)

> 작성: 2026-06-09 / 연계: [0609_tourism_promptathon_plan.md](0609_tourism_promptathon_plan.md), [0609_ennoia_prompts.md](0609_ennoia_prompts.md)
> 출처: 공공데이터포털(data.go.kr) 각 API 상세 페이지 + TourAPI 콘텐츠랩 + 실연동 사례
>
> ⚠️ **정확도 표기**
> - ✅ **확인됨**: 국문/다국어/사진 등 TourAPI 본 서비스 — 실연동 예제로 검증된 스펙
> - 🔶 **구조 확인 / 파라미터명 최종확인 필요**: 연관관광지·집중률예측 등 빅데이터 계열 — data.go.kr이 자동 조회를 차단하므로, **해당 페이지 Swagger UI에서 요청변수명만 한 번 더 대조**할 것 (페이지 링크 명시)

---

## 0. 공통 사항

### 인증키 (serviceKey)
- 공공데이터포털 마이페이지 → 개인 API 인증키 → **인코딩키 / 디코딩키**
- URL 쿼리스트링에 직접 넣을 땐 보통 **인코딩키** 사용 (이미 URL-encode 됨)
- ennoia API 커넥터에서 헤더/쿼리 파라미터로 키를 분리 입력하는 경우 **디코딩키** 사용 (커넥터가 인코딩 처리)
- 제출폼 ④에는 **인코딩키 + 디코딩키 모두** 입력

### 공통 요청 파라미터 (TourAPI 본 서비스)
| 파라미터 | 필수 | 설명 | 권장값 |
|----------|:---:|------|--------|
| `serviceKey` | ✅ | 인증키 | (발급키) |
| `MobileOS` | ✅ | 요청 OS | `ETC` |
| `MobileApp` | ✅ | 앱 이름 | `KRide` |
| `_type` | — | 응답 포맷 | `json` (기본 XML) |
| `numOfRows` | — | 페이지당 개수 | `10`~`30` |
| `pageNo` | — | 페이지 번호 | `1` |
| `arrange` | — | 정렬 | `O`(제목) `Q`(수정일+이미지) `R`(생성일+이미지) `A`(제목) `C`(수정일) `D`(생성일) |

### 응답 공통 구조
```json
{
  "response": {
    "header": { "resultCode": "0000", "resultMsg": "OK" },
    "body": {
      "items": { "item": [ { ... } ] },
      "numOfRows": 10, "pageNo": 1, "totalCount": 123
    }
  }
}
```
> ennoia에서 다음 노드로 넘길 때 경로: `response.body.items.item[]`

---

## 1. ✅ 국문 관광정보 서비스 (KorService2) — 플래너 [3] 핵심

- 페이지: https://www.data.go.kr/data/15101578/openapi.do
- **Base URL**: `http://apis.data.go.kr/B551011/KorService2/`
  - (구버전 `KorService1`은 단계적 종료 → **KorService2** 사용, 오퍼레이션 접미사 `2`)

### 오퍼레이션
| operation | 용도 | K-Ride 활용 |
|-----------|------|-------------|
| `areaBasedList2` | 지역기반 목록 | 지역 선택 시 관광지/맛집 목록 |
| `locationBasedList2` | 좌표기반 목록(반경) | 촬영지 좌표 주변 POI |
| `searchKeyword2` | 키워드 검색 | "아티스트명/장소명" 검색 |
| `searchFestival2` | 축제/행사(기간) | 콘서트·페스티벌 연계 |
| `searchStay2` | 숙박 검색 | 숙소 추천 |
| `detailCommon2` | 공통 상세(개요/주소/이미지) | 일정 카드 상세 |
| `detailIntro2` | 타입별 상세(운영시간 등) | 운영정보 |
| `detailInfo2` | 반복정보(코스 구성 등) | 여행코스 세부 |
| `detailImage2` | 추가 이미지 | 영상 소재 |
| `areaCode2` | 지역코드 조회 | 지역명→코드 변환 |
| `categoryCode2` | 분류코드 조회 | 목적→카테고리 매핑 |

### 주요 요청 파라미터
| operation | 파라미터 | 설명 |
|-----------|----------|------|
| `areaBasedList2` | `areaCode`, `sigunguCode`, `contentTypeId`, `cat1/cat2/cat3` | 지역·시군구·콘텐츠타입·분류 |
| `locationBasedList2` | `mapX`(경도), `mapY`(위도), `radius`(m, 최대 20000) | 좌표+반경 |
| `searchKeyword2` | `keyword`(UTF-8 인코딩), `contentTypeId`, `areaCode` | 키워드 |
| `searchFestival2` | `eventStartDate`(YYYYMMDD), `eventEndDate`, `areaCode` | 행사 기간 |
| `detailCommon2` 등 | `contentId`, `contentTypeId` | 단건 상세 |

### contentTypeId 코드값
| 값 | 의미 | 값 | 의미 |
|----|------|----|------|
| 12 | 관광지 | 28 | 레포츠 |
| 14 | 문화시설 | 32 | 숙박 |
| 15 | 축제공연행사 | 38 | 쇼핑 |
| 25 | 여행코스 | 39 | 음식점 |

### areaCode 코드값 (지역 매핑)
| 코드 | 지역 | 코드 | 지역 | 코드 | 지역 |
|----|------|----|------|----|------|
| 1 | 서울 | 7 | 울산 | 34 | 충남 |
| 2 | 인천 | 8 | 세종 | 35 | 경북 |
| 3 | 대전 | 31 | 경기 | 36 | 경남 |
| 4 | 대구 | 32 | 강원 | 37 | 전북 |
| 5 | 광주 | 33 | 충북 | 38 | 전남 |
| 6 | 부산 | | | 39 | 제주 |

### 주요 응답 필드 (item)
`contentid`, `contenttypeid`, `title`, `addr1`, `addr2`, `mapx`(경도), `mapy`(위도), `firstimage`, `firstimage2`, `tel`, `areacode`, `sigungucode`, `cat1/2/3`, `overview`(detailCommon)

### 호출 예시
```
http://apis.data.go.kr/B551011/KorService2/locationBasedList2
  ?serviceKey={KEY}&MobileOS=ETC&MobileApp=KRide&_type=json
  &mapX=126.9882&mapY=37.5512&radius=2000&contentTypeId=12&numOfRows=20
```
> K-Ride 흐름: RAG로 얻은 촬영지 좌표 → `locationBasedList2`로 주변 POI → `detailCommon2`로 상세.

---

## 2. ✅ 다국어 관광정보 서비스 — 다국어 토글 ([3] + ${language})

- 본 서비스와 **오퍼레이션·파라미터 동일**, Base URL의 서비스명만 언어별로 분기.

| 언어 | 서비스명 (Base URL) | data.go.kr |
|------|---------------------|------------|
| 영어 | `EngService2` | 15101753 |
| 일본어 | `JpnService2` | (포털 검색) |
| 중문 간체 | `ChsService2` | — |
| 중문 번체 | `ChtService2` | — |
| 독어 | `GerService2` | — |
| 불어 | `FreService2` | — |
| 서어 | `SpnService2` | — |
| 노어 | `RusService2` | — |

```
http://apis.data.go.kr/B551011/EngService2/areaBasedList2?serviceKey={KEY}&MobileOS=ETC&MobileApp=KRide&_type=json&areaCode=1&contentTypeId=12
```
> **중요**: 영문 일정은 LLM 번역에 의존하지 말고 `EngService2`에서 영문 `title`/`addr1`을 직접 받을 것(표기 정확).
> ennoia에선 `${language}` 변수로 Base URL의 서비스명을 스위칭(분기 노드 또는 변수 치환).

---

## 3. 🔶 관광지별 연관관광지 정보 서비스 — 플래너 [4] (성지 주변 연계 코스)

- 페이지: https://www.data.go.kr/data/15128560/openapi.do
- 설명: **TMAP 내비게이션 데이터 기반**, 중심관광지와 연결성 높은 연관관광지를 **전체/관광지/음식/숙박 유형별 각 최대 50위**까지 제공.
- 계열: 관광 빅데이터 계열 (B551011) — **TourAPI 본 서비스와 파라미터 체계가 다름**

### 구조 (🔶 Swagger에서 요청변수명 최종 확인)
- **Base URL 패턴**: `http://apis.data.go.kr/B551011/TarRlteTarService1/`
- **operation**: `areaBasedList1` (지역기반 연관관광지 목록)
- **요청 파라미터(추정/일반형)**:
  | 파라미터 | 설명 |
  |----------|------|
  | `serviceKey`, `MobileOS`, `MobileApp`, `_type`, `numOfRows`, `pageNo` | 공통 |
  | `baseYm` | 기준연월 (YYYYMM) — 빅데이터 계열 필수 |
  | `areaCd` | 지역코드 (시도) |
  | `signguCd` | 시군구코드 |
- **주요 응답 필드(추정)**: `hubTatsNm`(중심관광지명), `rlteTatsNm`(연관관광지명), `rlteRank`(연관순위), `rlteCtgryLclsNm/MclsNm/SclsNm`(연관 대/중/소분류), `rlteRegnNm`/`rlteSignguNm`(지역명)

### 잠정 호출 예시 (예상값 — Swagger 확인 전 사용 가능)
```
http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1
  ?serviceKey={KEY}&MobileOS=ETC&MobileApp=KRide&_type=json
  &numOfRows=10&pageNo=1
  &baseYm=202604        # 직전 확정 월(현재 기준 2~3개월 전 권장: 데이터 적재 지연)
  &areaCd=11            # ⚠️ 빅데이터 계열은 행정안전부 법정동코드(서울=11) 사용 추정
  &signguCd=11680       # 시군구 법정동코드(강남구=11680) — 선택
```
> ⚠️ **areaCd 주의**: 본 서비스(KorService2)의 `areaCode`(서울=1)와 **다를 수 있음**. 빅데이터 계열은 행안부 법정동코드(서울=11, 부산=26, 제주=50)를 쓰는 경우가 많아 **Swagger 예제값으로 반드시 대조**. 잠정은 법정동코드로 진행.
> ⚠️ **확인 절차**: 위 페이지 → "활용신청"한 계정으로 로그인 → **상세기능정보/참고문서(Swagger)** 에서 `baseYm`·`areaCd`·`signguCd`의 정확한 표기와 operation명(`areaBasedList1` 여부)을 대조한 뒤 ennoia 커넥터에 입력.
> K-Ride 흐름: 일정 중심관광지(촬영지) → 연관관광지 상위 N개를 후보로 받아 LLM 노드 [7]의 `{{kto_related}}`로 투입 → 동선·연계 코스 확장.

---

## 4. 🔶 관광지 집중률(방문자 추이 예측) 정보 서비스 — 플래너 [5] (혼잡 회피)

- 설명: **이동통신 데이터 기반 ML 예측** — 해당 지역의 **향후 5주간 날짜별 방문자 비율 예측값** 제공. (국내=KT, 외국인=SKT 기반)
- 데이터 해석 참고: 한국관광 데이터랩 https://datalab.visitkorea.or.kr
- 계열: 관광 빅데이터 계열 (B551011)

### 구조 (🔶 Swagger에서 요청변수명·operation 최종 확인)
- **Base URL 패턴**: `http://apis.data.go.kr/B551011/{집중률서비스명}/`
- **요청 파라미터(추정/일반형)**:
  | 파라미터 | 설명 |
  |----------|------|
  | `serviceKey`, `MobileOS`, `MobileApp`, `_type`, `numOfRows`, `pageNo` | 공통 |
  | `baseYmd` 또는 `baseYm` | 기준일/기준월 |
  | `areaCd`, `signguCd` | 지역/시군구코드 |
  | (관광지 단건일 경우) 관광지 식별코드 | — |
- **주요 응답 필드(추정)**: 날짜(`baseYmd`), 방문자 비율 예측값(`predRate`/`cnctrRate` 류), 지역명

### 잠정 호출 예시 (예상값 — Swagger 확인 전 사용 가능)
```
http://apis.data.go.kr/B551011/{집중률서비스명}/areaBasedList1
  ?serviceKey={KEY}&MobileOS=ETC&MobileApp=KRide&_type=json
  &numOfRows=35&pageNo=1     # 5주 × 7일 = 35행 한 번에 수신
  &baseYm=202606            # 예측 기준월
  &areaCd=11&signguCd=11680 # 법정동코드 추정(연관관광지와 동일 체계)
```
> 활용 로직(예상값 기반): 응답의 날짜별 `predRate`를 정렬 → **비율 상위(혼잡) 날짜·요일 회피**, 하위(한산) 시간대 우선 배치. LLM 노드 [7] `{{kto_congest}}`로 "회피 권장: X요일 오후" 형태 요약 투입.
> ⚠️ **확인 절차**: 공공데이터포털에서 "관광지 집중률 방문자 추이 예측" 검색 → 활용신청한 서비스 상세페이지 Swagger에서 operation명·요청변수명·날짜형식(YYYYMM vs YYYYMMDD) 확정.
> K-Ride 흐름: 후보 방문지/지역의 5주 예측 비율 → 비율 높은 날짜/시간대 회피 → LLM 노드 [7]의 `{{kto_congest}}`로 투입 → 방문 순서/날짜 최적화.

---

## 5. ✅ 관광사진 정보 서비스 — 영상 [B][C] 소재 보강

- 페이지: https://www.data.go.kr/data/15101914/openapi.do
- **Base URL**: `http://apis.data.go.kr/B551011/PhotoGalleryService1/`
- **operation**: `galleryList1`(목록), `galleryDetailList1`(상세), `galleryKeywordList1`(키워드), `gallerySearchList1`(검색)
- 요청 파라미터: 공통 + `keyword`, `arrange`
- 응답 필드: `galContentId`, `galTitle`, `galWebImageUrl`(고화질 이미지 URL), `galPhotographyMonth`, `galPhotographyLocation`, `galSearchKeyword`
> K-Ride 흐름: 방문지/지역 키워드로 고화질 관광사진 → 추억 영상 인서트 컷·미리보기 소재.

---

## 6. 보조 API 빠른 참고

| 서비스 | data.go.kr | 비고 |
|--------|-----------|------|
| 영문 관광정보 | 15101753 | `EngService2` |
| 관광빅데이터 정보서비스 | 15101972 | 방문자/검색량 빅데이터(B551011) — `baseYm`·`areaCd` 계열 |
| 기초지자체 중심관광지 정보 | 15128559 | 연관관광지와 같은 계열(중심관광지 추출) |
| 무장애 여행 정보 | (포털 검색) | `companion=휠체어` 분기 |
| 반려동물 동반여행 | (포털 검색) | `companion=반려동물` 분기 |
| 관광지 오디오 가이드 | (포털 검색) | 영상 내레이션 텍스트 소스 |

---

## 6-B. ennoia API 커넥터 폼 입력값 (템플릿)

> 국문 `areaBasedList2` 기준. 다른 오퍼레이션/언어는 URL과 동적 파라미터만 교체.

| 폼 필드 | 값 |
|---------|-----|
| 이름 | `KTO 국문 관광정보 (areaBasedList2)` |
| Method | `GET` |
| URL | `http://apis.data.go.kr/B551011/KorService2/areaBasedList2` |
| 헤더/인증 | 없음 (serviceKey는 쿼리로) |

**쿼리 파라미터**
| 키 | 값 | 종류 |
|----|-----|------|
| `serviceKey` | (디코딩키 또는 인코딩키) | 고정 |
| `MobileOS` | `ETC` | 고정 |
| `MobileApp` | `KRide` | 고정 |
| `_type` | `json` | 고정 |
| `numOfRows` | `20` | 고정 |
| `pageNo` | `1` | 고정 |
| `areaCode` | 1=서울 등 | **변수(LLM이 채움)** |
| `contentTypeId` | 12/39 등 | **변수(LLM이 채움, 선택)** |

복제 대상: `locationBasedList2`(`mapX`/`mapY`/`radius`), `searchKeyword2`(`keyword`), 영문 `EngService2/...`, 🔶 `TarRlteTarService1/areaBasedList1`, 🔶 집중률.

**자주 막히는 지점**
- http/https: 기본 `http://apis.data.go.kr`. ennoia가 https 강제 시 https 시도 → 인증서 오류면 http.
- serviceKey 이중 인코딩: `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 발생 시 인코딩키↔디코딩키를 바꿔 입력.
- 동적 파라미터(`areaCode`/`keyword`/`mapX·mapY`)는 반드시 **변수(LLM 채움)** 로 지정.

---

## 7. ennoia API 커넥터 설정 체크리스트

- [ ] 본 서비스(국문): Base `…/KorService2/`, operation `areaBasedList2`/`locationBasedList2`/`detailCommon2`
- [ ] 다국어: `${language}` → 서비스명(`EngService2` 등) 스위칭 노드/변수
- [ ] `_type=json` 고정 (XML 파싱 회피)
- [ ] 응답 매핑 경로 `response.body.items.item[]`
- [ ] 연관관광지·집중률: **활용신청 계정 Swagger에서 요청변수명 대조 후** 커넥터 입력 (🔶 필수)
- [ ] 인증키: 커넥터가 인코딩 처리하면 디코딩키, 직접 쿼리면 인코딩키
- [ ] 타임아웃/캐시: 빅데이터 계열은 응답이 느릴 수 있음 → 캐시 노드 권장
- [ ] 제출폼 ⑤: **실제 호출한 서비스만** 체크 (국문 + 영문 + 연관관광지 + 집중률예측 + 관광사진/오디오가이드)

---

## 8. 출처

- [국문 관광정보 서비스 (15101578)](https://www.data.go.kr/data/15101578/openapi.do)
- [영문 관광정보 서비스 (15101753)](https://www.data.go.kr/data/15101753/openapi.do)
- [관광지별 연관관광지 정보 (15128560)](https://www.data.go.kr/data/15128560/openapi.do)
- [기초지자체 중심관광지 정보 (15128559)](https://www.data.go.kr/data/15128559/openapi.do)
- [관광빅데이터 정보서비스 (15101972)](https://www.data.go.kr/data/15101972/openapi.do)
- [관광사진 정보 (15101914)](https://www.data.go.kr/data/15101914/openapi.do)
- [TourAPI 콘텐츠랩](https://api.visitkorea.or.kr/)
- [한국관광 데이터랩](https://datalab.visitkorea.or.kr/)
- [mcp-korea-tourism-api (참고 구현)](https://github.com/harimkang/mcp-korea-tourism-api)
