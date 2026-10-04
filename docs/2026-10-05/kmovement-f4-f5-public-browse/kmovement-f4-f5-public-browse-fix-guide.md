# KMovement F4·F5 공개 조회 통합 작업 fix-guide

> 기준: `origin/main` `ec54fadfac062e7d561bcc14685ecb1961acad17`
> 조사 시각: 2026-10-05 08:07 KST
> 현재 단계: 분석·작업 계약 작성 완료 / 코드 수정·테스트·배포·PR 미실행

## 최종 목표

`/view/TOUR_EXPLORE` 한 화면에서 **F4 전국 맛집**과 **F5 K-컬처 성지**를 함께 구현·검증할 수 있게 하되, TourAPI 장애가 성지 DB 조회를 멈추지 않고 성지 오류가 맛집 탭을 숨기지 않도록 두 공개 조회 경계를 분리한다.

## 핵심 결론

화면과 서버 소스의 상당 부분은 이미 `main`에 있지만 운영 화면의 네 공개 조회가 현재 모두 500이다. 공통 공개 라우팅을 먼저 열고, F4의 TourAPI 비밀값·진짜 페이지 이동과 F5의 승인 데이터·필터·오류 격리를 각각 검증해야 한다.

다음 행동은 **한 작업 브랜치에서 공통 게이트 → F4 → F5 순서의 독립 커밋을 만들고, 두 기능의 통과 여부를 따로 기록하는 것**이다. 이 문서는 그 작업을 실행하지 않는다.

## 3줄 줄거리

1. 탐색 화면과 맛집·성지 서버 코드는 이미 있지만 운영 데이터 요청은 현재 실패한다.
2. 공통 지역 선택과 카드 UI는 재사용하고, 맛집은 TourAPI, 성지는 승인된 DB 데이터라는 출처 차이를 유지한다.
3. 한 PR에서 함께 작업하되 별도 공개 게이트와 검증표를 둬 한쪽 실패가 다른 쪽의 롤백을 강제하지 않게 한다.

지금 나는 **[F4·F5 공개 조회 통합] 중 [운영 장애와 공통 계약]의 [구현 전 원인 분리]**에 있다.

## 현재 확인된 사실

| 구분 | 확인 결과 | 판정 |
|---|---|---|
| 기준 소스 | `origin/main`과 로컬 `main`이 동일한 `ec54fad` | 확인 |
| 탐색 화면 | `GET /view/TOUR_EXPLORE` → HTTP 200 | 확인 |
| 지역 API | `GET /api/v1/tour/areas` → HTTP 500 | 확인 |
| 맛집 API | `GET /api/v1/tour/restaurants?...` → HTTP 500 | 확인 |
| 성지 API | `GET /api/v1/tour/holy?...` → HTTP 500 | 확인 |
| 작품 API | `GET /api/v1/tour/holy/contents?...` → HTTP 500 | 확인 |
| 공개 라우팅 | Hostinger compose에는 health와 F2 주소검색 라우터만 있고 tour GET 라우터가 없음 | 확인 |
| F4 비밀값 | Spring은 `TOUR_API_KEY`를 요구하지만 Hostinger compose/configtree에는 해당 secret이 없음 | 확인 |
| F4 화면 페이징 | 운영 요청은 24건만 받고, 현재 “더 보기”는 이미 받은 배열만 펼침 | 확인 |
| F5 공개 조건 | 리포지토리는 `source != TOURAPI`와 `reviewStatus = APPROVED`를 함께 적용 | 확인 |
| F5 운영 500 원인 | 공개 라우팅, 실행 로그, DB migration/schema 중 무엇인지 아직 단정 불가 | 미확인 |

## 가설과 검증

### 가설 A · 공통 공개 GET 라우터가 첫 차단점이다

- 근거: `g1.compose.yml`의 Spring 라벨에는 `/api/platform/health`, `/api/v1/address/search`만 있다.
- 검증: tour 공개 GET 경로를 명시적 allowlist로 추가하고 외부에서 각 경로가 Spring 응답 헤더·본문을 반환하는지 확인한다.
- 성공: areas, restaurants/poi, holy, holy/contents가 200·빈 결과·의도한 5xx를 서로 구분한다.
- 현재 판정: **일부 확인**. 설정 누락은 확인했지만 서버 로그를 보지 않아 500의 단일 원인이라고 확정하지 않는다.

### 가설 B · F4는 TourAPI 설정과 실제 서버 페이지 이동을 추가하면 완성할 수 있다

- 근거: `TourApiClient`는 Decoded 서비스키를 요구하고 `areaBasedList2`에 `pageNo`를 보낸다.
- 검증: 키 주입 뒤 서울 맛집 1·2페이지를 조회해 서로 다른 `contentId`가 나오고, 화면의 다음 페이지가 새 요청을 만드는지 확인한다.
- 성공: 첫 24건, 다음 24건 또는 마지막 페이지, 빈 지역, 공급자 오류, 마지막 성공 캐시가 구분된다.
- 현재 판정: **일부 확인**. 소스 계약은 있으나 운영 키와 응답은 미확인이다.

### 가설 C · F5는 TourAPI와 독립적으로 승인된 DB 데이터만 제공할 수 있다

- 근거: `/holy`는 `tour_poi`·`holy_content`를 읽고 공공 TourAPI 호출을 하지 않는다.
- 검증: TourAPI를 실패시킨 상태에서도 성지 조회가 200인지 확인하고, PENDING·REJECTED가 결과에 없는지 DB와 응답을 대조한다.
- 성공: 지역·작품·종류 필터가 적용되고 좌표·출처가 있으며, 성지 실패가 맛집 상태를 덮지 않는다.
- 현재 판정: **소스 확인 / 운영 미확인**.

## 함께 작업하는 단위

```text
공통 게이트
  ├─ 공개 GET 경로 allowlist
  ├─ 지역 필터 계약 하나로 통일
  └─ 탭별 loading / empty / error 상태 분리
       ├─ F4 맛집: TourAPI 키 → 1페이지 → 다음 페이지 → 캐시/오류
       └─ F5 성지: 승인 DB → 작품/종류 → 좌표/출처 → 오류 격리
```

권장 작업 형태는 **작업 브랜치 하나, 커밋 최소 4개, PR 하나**다.

1. `deploy: expose read-only tour endpoints`
2. `feat: complete restaurant pagination and fallback`
3. `feat: isolate approved holy browse and filters`
4. `test/docs: verify F4 and F5 separately`

같은 PR에 있어도 배포 기록에는 F4와 F5 결과를 별도 행으로 남긴다.

## 수정 지도

### 1. 공통 공개 게이트

**현재 문제**

- 운영 tour 조회 4개가 모두 500이다.
- Spring Security는 GET `/api/v1/tour/**`를 공개하지만 reverse proxy의 명시적 tour 라우터가 없다.
- broad `PathPrefix` 하나로 쓰기·관리 경로까지 넓히면 안 된다.

**수정 위치**

- `deploy/hostinger/g1.compose.yml`
- `deploy/hostinger/g1.secrets.example/`
- 배포 런북·release record

**권장 변경**

- 다음 GET만 명시적으로 Spring에 연결한다: `/areas`, `/poi`, `/restaurants`, `/holy`, `/holy/contents`.
- POST `/holy/submissions`와 `/api/admin/**`는 이번 공개 묶음에서 열지 않는다.
- `spring_tour_api_key` secret을 `tour.api-key` configtree 항목으로 연결한다. 실제 값은 Git·보고서·로그에 넣지 않는다.
- config revision과 기존 Spring image digest를 기록하고, 앱 코드가 바뀌면 새 digest로 교체한다.

**완료 증거**

- compose config 통과, 공개 포트 80/443만 유지.
- 허용한 GET은 Spring으로 가고 POST·admin은 기존 인증/차단을 유지.
- 로그의 공급자 오류 본문에서 서비스키가 `***`로 가려짐.

### 2. F4 · 전국 맛집

**현재 문제**

- 실제 탐색 화면은 의미가 넓은 `/poi?contentTypeId=39`를 쓰고, 별도 `/restaurants` 함수도 있어 계약이 둘이다.
- 화면의 “더 보기”는 서버 2페이지를 부르지 않는다. 실응답이 24건이면 버튼도 나타나지 않는다.
- 지역 목록만 짧은 메모리 캐시가 있고 맛집 마지막 성공 응답 캐시는 없다.

**핵심 파일**

- `metadata-project/services/tourApi.ts`
- `metadata-project/components/plugins/travel/TourExploreScreen.tsx`
- `SDUI-server/.../TourController.java`
- `SDUI-server/.../TourService.java`
- `SDUI-server/.../TourApiClient.java`

**권장 계약**

- F4의 대표 경로를 `/api/v1/tour/restaurants`로 고정한다.
- `areaCode`, `sigunguCode`, `arrange`, `numOfRows`, `pageNo`를 같은 이름으로 전달한다.
- 필터가 바뀌면 `pageNo=1`로 초기화하고, 다음 페이지는 새 결과를 중복 없이 이어 붙인다.
- 응답 수가 page size보다 작으면 마지막 페이지로 처리한다. 정확한 전체 건수가 필요해지면 별도 pagination DTO로 확장한다.
- 공급자 실패 시 마지막 성공 캐시임을 화면과 로그에서 구분한다. 캐시가 없으면 오류를 표시하고 빈 결과로 위장하지 않는다.

**완료 증거**

- 서울 전체 → 종로구 → 최신순 필터가 각기 새 요청을 만든다.
- 1페이지와 2페이지의 `contentId` 중복이 없다.
- 카드에 이름·주소·이미지/대체 표시·출처가 나타난다.
- 공급자 오류, 캐시 fallback, 결과 0건이 서로 다른 화면이다.

### 3. F5 · K-컬처 성지

**현재 문제**

- API 실패 시 일반 성지는 코드 내 소수 예시로 조용히 대체돼 운영 장애를 숨길 수 있다.
- 성지 맛집 실패는 빈 목록으로 바뀌고 작품 자동완성 실패도 조용히 사라진다.
- K-POP 지역 랜딩의 “성지 탐색하기” 링크가 category를 전달하지 않아 기본 맛집 탭으로 열린다.
- 현재 API의 종류 경계는 `전체 성지`와 `FOOD`다. `kpop/drama/movie/show` 전체 분류 필터는 작품 선택지 검색에만 있고 성지 목록 직접 필터는 아니다.

**핵심 파일·데이터**

- `TourExploreScreen.tsx`, `tourApi.ts`
- `TourPoiRepository.java`, `HolyContentRepository.java`
- `V90__holy_poi_nationwide_seed.sql`
- `V91__holy_content_links.sql`
- `V92__holy_food_kind.sql`
- `/travel/kpop` 지역 랜딩 링크

**권장 계약**

- 공개 결과는 DB의 APPROVED 데이터만 실제 성지로 표시한다.
- 정적 예시는 개발·데모라고 명시하지 않는 한 운영 fallback으로 사용하지 않는다.
- 진입 링크에 성지 category를 전달하고, 화면은 허용된 category만 해석한다.
- MVP 종류 필터는 현재 계약과 맞춰 `전체 성지 / 성지 맛집`으로 고정한다.
- `K-POP/드라마/영화/예능` 전체 분류 필터가 꼭 필요하면 `category`를 `/holy`와 repository까지 별도 확장한다. 이 확장은 구현 전에 사용자 선택을 받는다.

**완료 증거**

- APPROVED만 노출되고 PENDING·REJECTED·TOURAPI 행은 없다.
- 시·도, 시·군·구 이름, 작품/아티스트, 전체/성지 맛집 조합을 검증한다.
- 카드와 상세에 주소·좌표·작품/아티스트·추천 이유·안전한 출처 링크가 맞는다.
- API 오류는 예시 데이터로 정상처럼 보이지 않는다.
- F5를 숨기거나 롤백해도 F4는 계속 조회된다.

## 공통 화면 상태 계약

| 상태 | F4 맛집 | F5 성지 |
|---|---|---|
| loading | 첫 페이지 skeleton, 다음 페이지 버튼 busy | 승인 데이터 skeleton, 작품 검색 busy |
| ready | 실시간 또는 명시된 cache 카드 | APPROVED DB 카드 |
| empty | 선택 지역에 맛집 없음 | 선택 필터에 승인 성지 없음 |
| error | TourAPI/네트워크 오류와 재시도 | DB/공개 경로 오류와 재시도 |
| degraded | 마지막 성공 캐시 + 기준 시각 | 기본적으로 사용하지 않음 |

## Before / After

### Before · 현재 확인 화면

- `/view/TOUR_EXPLORE` 문서는 200으로 열린다.
- 지역·맛집·성지·작품 API는 모두 500이다.
- 맛집은 “장소를 불러오지 못했어요”가 표시될 수 있다.
- 일반 성지는 정적 예시로 대체되어 장애가 가려질 수 있다.
- K-POP 랜딩에서 탐색으로 이동해도 기본 맛집 탭이 열린다.

### After · 구현 후 예상 모형

- 지역 링크는 선택한 시·도와 의도한 탭을 함께 연다.
- 맛집은 서버 1페이지 후 실제 다음 페이지를 요청한다.
- 성지는 승인 데이터만 표시하고 작품·성지 맛집 필터를 적용한다.
- 두 탭의 오류·빈 결과·재시도가 독립적이다.
- 실제 데이터 출처와 캐시 여부가 사용자가 오해하지 않게 표시된다.

> After는 구현 결과나 실제 캡처가 아니라 이번 작업의 목표 모형이다.

## 제안 테스트와 명령 — 아직 실행하지 않음

| 실행 위치 | 제안 명령 | 기대 결과 |
|---|---|---|
| `subproject/SDUI/SDUI-server` | `./gradlew.bat test --tests "*Tour*"` | 공개 조회·승인 필터·공급자 오류 테스트 통과 |
| `subproject/SDUI/metadata-project` | `npm.cmd test -- --runInBand TourExploreScreen tourApi` | 지역·페이지·성지 필터·독립 오류 상태 통과 |
| 저장소 루트 | `docker compose -f deploy/hostinger/g1.compose.yml config` | 미치환 변수 없음, 비밀값 출력 없음 |
| 임시 HTTPS | 허용 GET과 차단 POST를 각각 요청 | 읽기만 공개, 쓰기·관리 경계 유지 |

## 에이전트에게 그대로 전달할 요청문

```text
목표: KMovement origin/main 최신 SHA에서 F4 전국 맛집과 F5 K-컬처 성지 공개 조회를 한 작업 브랜치에서 구현하되, 데이터 출처와 장애·롤백을 서로 격리한다.

확인된 사실:
- /view/TOUR_EXPLORE는 운영에서 200이지만 areas, restaurants, holy, holy/contents는 2026-10-05 08:07 KST 현재 모두 500이다.
- Hostinger g1 compose에는 health와 주소검색 라우터만 있고 tour 공개 GET 라우터와 TourAPI secret 연결이 없다.
- F4 화면은 24건만 가져오고 현재 더 보기는 새 서버 페이지를 요청하지 않는다.
- F5 서버는 APPROVED 비공공 DB 성지만 조회하도록 구현돼 있지만 운영 응답은 아직 검증되지 않았다.
- 일반 성지의 정적 fallback은 운영 장애를 정상처럼 보이게 할 수 있다.

맡길 범위:
1. 명시적인 tour GET allowlist와 configtree TourAPI secret 이름을 추가한다. 실제 비밀값은 커밋하지 않는다.
2. F4 대표 계약을 restaurants로 통일하고 지역·정렬·pageNo를 전달해 실제 다음 페이지를 구현한다.
3. F4의 정상·빈 값·공급자 오류·마지막 성공 cache를 구분한다.
4. F5는 APPROVED DB 데이터만 공개하고 지역·작품/아티스트·전체/성지 맛집 필터를 검증한다.
5. K-POP 랜딩에서 성지 탭으로 정확히 진입하게 하고, 정적 예시는 운영 성공으로 사용하지 않는다.
6. F4와 F5의 loading/empty/error/rollback을 독립 상태로 유지한다.
7. 기존 웹·주소검색·F2·EC2·RunPod 경로와 데이터 볼륨을 보존한다.

완료 기준:
- compose config와 관련 단위·화면 테스트 통과
- 외부 80/443 외 공개 포트 없음, 허용 GET 외 쓰기·관리 route 확대 없음
- F4 서울/시군구/정렬/1·2페이지/빈 결과/공급자 오류/cache 증거
- F5 APPROVED-only/지역/작품/성지 맛집/좌표/출처/빈 결과/DB 오류 증거
- 한 기능을 실패 또는 비활성화해도 다른 기능은 정상
- main SHA, image digest, config revision, target, rollback digest를 한 배포 기록에 넣되 F4·F5 판정을 별도 행으로 기록
- PR URL, 변경 파일, 실행·미실행, 다음 단계 F6 후보 제공

권한 경계: main 병합, 실제 Hostinger secret 입력, 운영 배포와 DNS 변경은 사용자 확인 전 실행하지 않는다.
```

## 사용자가 지금 직접 할 일

없음. 구현 시작을 승인할 때 다음 두 선택만 알려주면 된다.

1. F5의 “종류”를 이번에는 `전체 성지 / 성지 맛집`으로 제한할지
2. F4 실패 시 마지막 성공 캐시를 보여줄지, 오류만 보여줄지

## 구현 완료 시 받아야 할 증거

- PR URL과 커밋별 F4/F5 구분
- 테스트 실행 URL 또는 로그 요약
- 실제 운영 요청의 상태·건수·서로 다른 1/2페이지 ID
- 승인 상태별 DB 건수와 공개 결과 대조(개인정보·비밀값 제외)
- 데스크톱·모바일 폭의 loading/empty/error/ready 화면
- 배포 SHA·digest·config revision·rollback digest
- 비밀값·내부 포트·POST/admin 비공개 확인

## 이번 문서에서 하지 않은 일

- 애플리케이션·compose 수정
- TourAPI 키 생성·입력
- 테스트·빌드·PR·병합
- Hostinger 접속·배포·로그 조회
- 운영 데이터 변경
