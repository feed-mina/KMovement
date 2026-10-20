# KRIDE 공개 6개 화면 UI 벤치마킹 스펙 정의서

- 작성일: 2026-10-20 · 작성 방식: ui-benchmarking-analyst (교집합 방식, 10-06 보고서와 같은 절차)
- 대상: https://kmovement.srv1869569.hstgr.cloud/ · 브랜치 `claude/brave-fermat-wy8yww` (HEAD `899cf5c`) · 웹앱 `subproject/SDUI/metadata-project` (Next.js 16 App Router)
- 짝 문서: `kride-public-six-screens-ui-benchmark.html` (Before 소스 재현 ↔ After 기대 화면 GUI 목업)
- 표기: `[확인]` 은 2026-10-20 웹 검색으로 출처를 확인한 레퍼런스, `[기억]` 은 확인하지 않은 것. 코드 근거는 `파일:줄`.
- 범위: 10-06 보고서(G0~G8: 코스 위자드 오류·아티스트 선택·SDUI 홈·마이·내 목록·언어 채팅)는 구현 완료. 이번에는 **비로그인 방문자가 링크로 들어와 처음 지나는 화면**만 다룬다.

> 이 문서는 **스펙과 체크리스트**다. 코드는 고치지 않았다. "구현까지" 요청이 오면 §6 할 일 순서(H0→H8)로 진행하면 된다.

---

## 0. 추론한 입력 (확인 바람)

| # | 화면 (경로 · 컴포넌트) | Primary Goal (한 줄) | 보조 행동 | 데이터 특성 |
|---|---|---|---|---|
| 1 | 랜딩 홈 (`/` · `app/page.tsx` + `KrideNav`) | **처음 온 사람이 1분 안에 코스 만들기나 탐색을 시작한다** | K-POP 탐색 · 가이드 읽기 · 로그인 | 정적 카피, 서버 컴포넌트라 로그인 분기 없음, 실제 숫자 없음 |
| 2 | 여행지 탐색 (`/view/TOUR_EXPLORE` · `TourExploreScreen.tsx`) | **지역·카테고리로 장소를 훑고 마음에 드는 곳을 저장한다** | 지도 보기 · 작품 필터 · 성지 제보 | TourAPI 24건/페이지, 성지는 자체 DB, 좌표 있음/없음 혼재, 저장은 localStorage |
| 3 | 동선 만들기 (`/view/ROUTE_PLANNER` · `RouteScreen.tsx`) | **지역·목적·기간을 고르고 하루 코스(지도 + 순서)를 받는다** | 길 찾기 · 카카오 공유 · 기본/AI 전환 | 기본 모드 서울 맛집 12곳 고정, AI 120초·로그인 필요, 길 찾기는 별도 컴포넌트 |
| 4 | 아티스트 (`/view/kpop` · `ArtistCatalogScreen.tsx`) | **아티스트를 찾아 저장하고 일정·상품·코스로 이어간다** | 검색 · 상세 · 저장 | 30팀, 8명/페이지 서버 페이징, 검수 사진 일부, 저장은 로그인 |
| 5 | 팬 일정 (`/view/KPOP_EVENTS` · `FanEventFeed.tsx`) | **내(또는 전체) 아티스트의 다가오는 일정을 날짜순으로 보고 저장한다** | 아티스트·지역·날짜 필터 · 공식 안내 | 12건/페이지, 국내·해외·온라인, 로그인 시 "내 아티스트" 기본, 시간대 미확정 |
| 6 | 로그인 (`/view/LOGIN_PAGE` · `AuthFlowScreen.tsx:56-106`) | **가장 빠른 방법으로 로그인하고 하던 곳으로 돌아간다** | 회원가입 · 비밀번호 찾기 | 이메일/비밀번호 + 카카오, `returnTo` 쿼리 존재 |

설계를 가르는 축: ① 진입점이 둘인 라벨(홈·코스 만들기) ② 조건 입력 → 결과 순서(2·3·5) ③ 비로그인 기본값(4·5·6) ④ 로컬 저장 vs 계정 저장(2) ⑤ 모바일 1열에서 결과까지의 깊이(1·5).

---

## 1. 레퍼런스 선정 (화면당 3~4개, 같은 회사 제품 중복 없음, 국내 1개 이상)

| # | 화면 | 레퍼런스 | 왜 골랐나 |
|---|---|---|---|
| 1 | 랜딩 홈 | Airbnb 홈 `[확인]` · Klook 홈 `[확인]` · 마이리얼트립 홈 `[기억]` · 야놀자 홈 `[기억]` | 여행 3 + 국내 OTA 2. "검색 1개 + 카테고리 타일" 교집합이 뚜렷 |
| 2 | 여행지 탐색 | Klook 검색 결과 `[확인]` · Airbnb 검색 결과 `[기억]` · 네이버 지도 `[기억]` · 카카오맵 `[기억]` | 지도 + 리스트 분할, 필터 pill, 결과 수·정렬 한 줄 |
| 3 | 동선 만들기 | Wanderlog `[확인]` · Google Maps 경로 `[기억]` · 네이버 지도 길찾기 `[기억]` · 트리플 일정 만들기 `[기억]` | "조건 → 지도 + 순서" 와 구간 이동 시간 표기 |
| 4 | 아티스트 | Spotify 아티스트 선택 `[확인·10-06]` · Weverse `[확인·10-06]` · 멜론 아티스트 `[기억]` · Apple Music `[기억]` | 원형 사진 그리드, 즉시 검색, 이니셜 폴백 |
| 5 | 팬 일정 | Ticketmaster 2026-09 개편 `[확인]` · Weverse 일정 `[확인·10-06]` · 인터파크 티켓 `[기억]` · Bandsintown `[기억]` | 월 헤더 + 날짜 타일, 팔로우/워치리스트 분리, 지역 전환 |
| 6 | 로그인 | 카카오 로그인 디자인 가이드 `[확인]` · 토스 `[기억]` · 당근 `[기억]` · Airbnb 로그인 `[기억]` | 국내는 카카오 최상단, 이메일은 보조 |

확인 출처:
- Airbnb categories (2022 개편): skift.com/2022/05/11/airbnb-reorganizes-its-search-around-curated-categories · rentalscaleup.com/how-do-airbnb-categories-work
- Klook teardown: screensdesign.com/showcase/klook-travel-hotels-leisure · screensdesign.com/explore/flows/finding-places
- Wanderlog: wanderlog.com/road-trip-planner · whistleout.com/CellPhones/Apps/wanderlog-group-trip-planning-app
- Ticketmaster 2026-09: news.livenationentertainment.com (newest app update) · ticketnews.com/2026/09/ticketmaster-updates-app-with-watchlist-personalized-recommendations-and-smarter-search
- 카카오 로그인 디자인 가이드: developers.kakao.com/docs/latest/ko/kakaologin/design-guide (컨테이너 #FEE500 · 심볼 #000 · 레이블 85% · 타사 버튼 강조 금지)
- Weverse / Spotify: 10-06 스펙 §1 에서 확인한 출처 재사용

---

## 2. 4축 분해 → 교집합 표준 (2/3 이상이 같은 선택을 한 항목만 "표준")

### 2-1. 랜딩 홈
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 히어로 안에 검색/목적지 입력 1개 (4/4) · Primary 1개 (4/4) · 카테고리 아이콘 타일 4~6 (4/4) · 숫자·사회적 증거 (3/4) | Airbnb 는 카테고리 행이 검색 위 |
| Interaction | 목적지 칩 탭 = 검색 결과 이동 (3/4) · 타일 전체가 탭 영역 (4/4) | Klook "where to next" 개인화 |
| State | 로그인 후 "이어서 하기"/최근 본 것 (3/4) · 비로그인 1줄 배너 (3/4) | — |
| Edge | 모바일 하단 탭 4~5 (4/4) · 헤더 1줄 (4/4) · 하단 반복 CTA 없음 (3/4) | — |

### 2-2. 여행지 탐색
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 상단 고정 필터 바(검색 + 칩 1줄) (4/4) · 결과 수 + 정렬 1줄 (4/4) · 카드 썸네일 + 카테고리 + 거리 (3/4) · 지도↔리스트 전환 또는 분할 (4/4) | Klook 카드에 평점·예약 수 |
| Interaction | 카드 탭 = 핀 하이라이트 (3/4) · 세부 필터는 바텀시트 (3/4) · 조건이 URL 에 남음 (4/4) | — |
| State | 로딩 Skeleton 카드 (4/4) · 결과 0 = 이유 + 초기화 (4/4) · 오류 = 원인 + 재시도 (4/4) | — |
| Edge | 저장이 계정과 동기화 (3/4) · 좌표 없는 장소 표기 (2/4 → 선택지) | — |

### 2-3. 동선 만들기
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 조건 입력 → 결과 순서 (4/4) · 지도 + 순서 리스트 (4/4) · 결과 액션(공유·저장·길찾기) 1줄 (3/4) | Wanderlog 는 지도가 화면 절반 고정 |
| Interaction | 조건 바꾸면 재생성, 입력 보존 (4/4) · 구간 이동 시간 표시 (3/4) | — |
| State | 생성 중 진행 표시 (3/4) · 실패 = 원인 + 재시도 + 조건 유지 (4/4) · 로그인 필요는 버튼 옆 배지 (2/4 → 선택지) | — |
| Edge | 결과 공유 링크 (3/4) · 무관한 위젯 없음 (4/4) | — |

### 2-4. 아티스트
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 원형/정사각 사진 그리드 3~6열 (4/4) · 이름 + 보조 1줄 (3/4) · 저장 아이콘 사진 위 (3/4) | Weverse 는 가로 스크롤 행 |
| Interaction | 입력 즉시 필터 (4/4) · 더 보기/무한 (4/4) · 탭 + 카운트 (3/4) | — |
| State | 이미지 없음 → 이니셜 (4/4) · 로딩 Skeleton 원형 (3/4) · 결과 0 = 초기화 (4/4) | — |
| Edge | 긴 이름 2줄 말줄임 (3/4) · 데스크톱 6열 (3/4) | — |

### 2-5. 팬 일정
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 필터 1줄 칩/드롭다운 (4/4) · 월 구분 헤더 + 날짜 타일 (4/4) · 행 = 날짜·제목·아티스트·장소·저장 (4/4) | Ticketmaster 는 For You/Trending 섹션 |
| Interaction | 선택 즉시 반영 (4/4) · 기간 프리셋 (3/4) · 지역/도시 전환 (4/4) | — |
| State | 비로그인 유도 배너 (3/4) · 로딩 행 Skeleton (3/4) · 결과 0 = 조건 바꾸기 (4/4) | — |
| Edge | 면책 문구 상단 1회 (3/4) · 외부 공식 링크 새 창 (4/4) | — |

### 2-6. 로그인
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 소셜(카카오) 최상단·가장 큼 (국내 3/3) · 이메일은 "또는" 아래 (3/4) · 회원가입·비밀번호 찾기 링크 (4/4) | Airbnb 는 전화번호 우선 |
| Interaction | 돌아갈 곳/이유 한 줄 (3/4) · 이메일 폼은 접힘 (2/4 → 선택지) | — |
| State | 제출 중 비활성 + 문구 (4/4) · 오류 role=alert (4/4) | — |
| Edge | 개발·보안 문구 미노출 (4/4) · 카카오 버튼 규정(#FEE500 · 심볼 · 타사 강조 금지) (가이드) | — |

---

## 3. 갭 분석 (업계 표준 vs 현재 코드) — 있음 / 없음 / 다름

### 3-0. 모든 화면에 걸친 갭 (가장 먼저)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 홈 진입점 | 홈은 한 곳 | `/` 를 유일한 홈으로. `MAIN_PAGE` 의 로그인 후 카드를 `/` 의 클라이언트 아일랜드로 이식, `/view/MAIN_PAGE` → `/` | 로고와 "홈" 메뉴가 같은 화면으로 가는가? | **다름** — 로고 `href="/"`, 메뉴 "홈" `/view/MAIN_PAGE` (`KrideNav.tsx:6,8`) |
| 코스 만들기 진입점 | 같은 라벨 = 같은 화면 | 히어로/탭 "코스" → `ROUTE_PLANNER`. INTRO 위자드는 "아티스트 코스(5단계)" 로 개명 | "코스 만들기" 가 한 화면으로만 가는가? | **다름** — `page.tsx:26` → ROUTE_PLANNER, `KrideNav.tsx:6`·`KpopNav.tsx` → INTRO1 |
| 모바일 내비 | 하단 탭 4~5 | `kride-site-shell` 분기에서 `BottomNav` 를 750px 이하 렌더, 상단은 로고 + 마이 | 390px 에서 헤더 1줄 + 하단 탭? | **다름** — `kride-unified.css:2` 750px 이하 `display:block`, 메뉴 wrap 2줄, 하단 탭 없음 |
| 색·포커스 토큰 | 토큰 한 벌 | 화면 CSS 의 16진수를 `--semantic-*`/`--text-*`/`--border-hair` 로, 포커스 링 `--kride-focus-ring` 1종 | 화면별 CSS 에 16진수가 없는가? | **다름** — 탐색 `#791F1F·#b73848·#c9cdd3`, 팬 일정 `#941b38·#ae1c3e·#8c1c3a·#202c40`, 아티스트 `#285cb2·#8b94a3·#c87941`, 로그인 `#FDBFBC`, 동선 `RED` 상수 + 인라인 |
| 로딩·오류 | Skeleton + 원인·재시도 | `ScreenSkeleton`·`KrideStatePanel`(10-06) 적용 | 최초 로딩이 Skeleton 인가? | **다름** — 4화면 텍스트 로딩. 동선 오류 재시도 없음 (`RouteScreen.tsx:150-151`) |
| 숫자·카운트 | 탭·타일에 실제 수 | `totalCount`·지역 카운트 노출, 값 없으면 비움 | 누르기 전에 양을 아는가? | **없음** — 홈·K-POP 서브 메뉴 카운트 없음 |

### 3-1. 랜딩 홈 (`app/page.tsx`, `marketing.module.css`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| Primary 개수 | 1개 | 히어로만 `primaryButton`, 하단 `.cta` 삭제, 카드는 텍스트 링크 | 빨간 버튼이 하나인가? | **다름** — `:26,37,40` 3개, 모두 `/view/ROUTE_PLANNER` |
| 목적지 입력 | 히어로 검색 1개 | 검색 → `TOUR_EXPLORE?area=&category=`(`resolveAreaParam`) / `kpop?q=` 분기, 지역 칩 | 입력할 것이 첫 화면에 있는가? | **없음** |
| 숫자·증거 | 타일에 실제 수 | `FoodHubLanding` 의 "권역 3 · 맛집 5 · 성지 2" 재사용, 아티스트·일정 totalCount | 숫자가 보이는가? | **없음** — "17개 시·도" 텍스트만 |
| 진입 링크 수 | 섹션당 3~4 | 칩 3 + 카드 3 → 카테고리 타일 4 + 인기 지역 4 | 한 섹션에 링크 6개 이상인가? | **다름** — `:30-35` 칩 3 + 카드 3 |
| 로그인 분기 | 이어서 하기 / 1줄 배너 | 클라이언트 아일랜드 `ResumeCard` | 로그인 후 화면이 달라지는가? | **없음** — 서버 컴포넌트, 분기 없음 |
| 색 | 토큰 | `module.css` 의 `#e50914·#a30d16·#ffe5e7·#65656d` 등을 토큰으로 | 16진수 없는가? | **부분** — 변수 폴백 형태로 일부만 토큰 |

### 3-2. 여행지 탐색 (`TourExploreScreen.tsx`, `TourPoiCard.tsx`, `tour-explore.css`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 검색창 역할 | 서버 검색 | 라벨 "이 목록에서 찾기" 로 접거나 TourAPI keyword 검색으로 승격 | 검색이 전체를 대상으로 하는가? | **다름** — `placeQuery` 는 받은 24건 로컬 필터 (`:107`) |
| 결과 수 문구 | "지역 카테고리 n곳" + 정렬 | `tour-result-count` 를 "서울 맛집 24곳" 으로, 더 불러오기 버튼 1개 | 기술 문구가 없는가? | **다름** — "불러온 n곳 중 m곳 · 화면에 k곳 표시" (`:290`) |
| 카드 정보 | 썸네일 16:10 + 카테고리 + 거리 | `tour-card-grid` 2열, `hasTourCoordinates` 로 거리 계산, "지도에서 선택" 버튼을 카드 탭으로 | 카드만 보고 종류·거리를 아는가? | **다름** — 150px auto-fill, 100px 회색 썸네일, 주소 1줄 (`TourPoiCard.tsx:24-66`) |
| 저장 소재 | 계정 동기화 | 로그인 시 `/me/saved` 저장 + 로컬 병합, 비로그인은 배너 | 기기를 바꿔도 저장이 남는가? | **다름** — `SAVED_KEY='kride:saved-pois'` localStorage |
| 로딩/오류 | Skeleton / 공용 패널 | 카드 Skeleton 4장, `tour-recovery` → `KrideStatePanel` | Skeleton 인가? | **다름** — 텍스트, 오류 색 별도 (`#fff8f8·#ead0d1`) |
| URL 상태 | 조건이 URL 에 | `router.replace` 로 area/category/sigungu/arrange 동기화 | 뒤로가기·공유 시 조건이 남는가? | **다름** — 진입 시만 읽음 (`:207` 주석) |

### 3-3. 동선 만들기 (`RouteScreen.tsx`, `AppShell.tsx:31`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 조건 → 결과 | 조건 먼저 | 조건 카드(지역·목적·기간) 상단 고정, 기본 모드도 `region`→areaCode 매핑 | 첫 화면에서 조건을 고르는가? | **다름** — 기본 모드 서울 고정 (`:43`), 조건은 AI 모드 전용 (`:128`) |
| 헤더 버튼 | 모드 segmented + 결과 액션 1줄 | segmented(기본/AI), 하단 바(길 찾기·공유·저장) | 헤더에 버튼이 2개 이하인가? | **다름** — 길 찾기·카카오 공유·기본·AI 4개 (`:119-124`) |
| 무관 위젯 | 없음 | `RecordTimeComponent` 를 코스 저장 시점/마이로 | 최상단이 화면 목적과 같은가? | **다름** — `AppShell.tsx:31` ROUTE_PLANNER 에만 시간 설정 위젯 |
| 오류·로딩 | 원인 + 재시도 + 조건 유지 / Skeleton | `KrideStatePanel` + `fetchedKeyRef` 리셋 재시도, 지도·리스트 Skeleton | 재시도가 있는가? | **다름** — 텍스트만 (`:149-151`) |
| 구간 이동 | 이동 수단·시간 1줄 | `slot` + 구간 거리로 "도보 12분" 추정 | 장소 사이 이동이 보이는가? | **없음** — `routeDistanceKm` 총합만 |
| 스타일 | CSS + 토큰 | `route-screen.css` 분리 | 인라인 스타일이 없는가? | **다름** — 전면 인라인, `RED` 상수 |

### 3-4. 아티스트 (`ArtistCatalogScreen.tsx`, `KpopCards.tsx`, `KpopNav.tsx`, `artist-catalog.css`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 검색 | 즉시 필터 | 디바운스 300ms + `?q=` 동기화, 버튼 2개 제거 | 타이핑하면 바로 줄어드는가? | **다름** — submit + 초기화 (`:100-104`) |
| 카드 밀도 | 사진 + 이름 + 1줄 | 목록 variant 를 원형 그리드로, eyebrow·소개·SNS 는 상세만 | 한 화면에 6팀 이상 보이는가? | **다름** — 2열 큰 카드, 반복 문구 (`KpopCards.tsx:111`) |
| 페이지네이션 | 더 보기/무한 | 30건 1회 요청 후 클라이언트 "더 보기" | 안내 문구 없이 이어지는가? | **다름** — `PAGE_SIZE=8` + "1페이지 · 한 페이지에 최대 8명" (`:120`) |
| 탭 카운트 | 탭 + 수 | `KpopNav` 에 totalCount, "코스 만들기 →" 제거 | 탭에 수가 있는가? | **없음** |
| 폴백 사진 | 이니셜 브랜드 톤 | `CardImage`(10-06 G3) 규칙과 통일 | 사진 없는 카드가 브랜드 톤인가? | **다름** — 규칙 미문서화 |
| 포커스·색 | 토큰 | `#285cb2·#8b94a3·#c87941` → 토큰 | 16진수 없는가? | **다름** |

### 3-5. 팬 일정 (`FanEventFeed.tsx`, `fan-events.css`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 필터 층수 | 1줄 | 아티스트 ▾ · 지역 ▾ · 기간 ▾ 드롭다운/시트, 기존 `navigate()` 재사용 | 390px 첫 화면에 결과가 보이는가? | **다름** — 대상(`:42`) + 아티스트 박스(`:44`) + 개최 구분(`:45`) + 날짜 aside(`:46`) 4층 |
| 날짜 적용 | 프리셋 즉시 반영 | 이번 주/이번 달/3개월/직접 → from/to | 버튼 없이 반영되는가? | **다름** — "날짜 적용" submit (`:28`) |
| 월 구분·면책 | 월 헤더, 면책 1회 | `groupBy(month)` + 요일, 면책을 결과 요약 줄로 | 행마다 같은 문구가 반복되는가? | **다름** — 평면 리스트 + 행마다 반복 (`:48`) |
| 비로그인 기본 | 배너 | 토글 대신 결과 위 1줄 배너 | 결과가 항상 보이는가? | **다름** — "내 아티스트" 누르면 결과 대신 로그인 패널 (`:43`) |
| 팔레트 | 토큰 | `#941b38·#ae1c3e·#fcebf0·#8c1c3a·#202c40` → `--semantic-accent*`, `--text-strong` | 브랜드 레드와 같은 톤인가? | **다름** — 별도 버건디/네이비 |
| 로딩 | 행 Skeleton | 3행 Skeleton + 필터 유지 | Skeleton 인가? | **다름** — 텍스트 (`:53`) |

### 3-6. 로그인 (`AuthFlowScreen.tsx:56-106`, `LOGIN_PAGE.css`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 소셜 우선 | 카카오 최상단 | 카카오 48px 최상단, 빨간 Primary 는 쓰지 않음(가이드: 타사 버튼 강조 금지) | 카카오가 가장 먼저·가장 큰가? | **다름** — 이메일 폼 → 빨강 Primary → 카카오 (`:64-101`) |
| 카카오 버튼 규정 | #FEE500 + 심볼 + 85% 레이블 | 심볼 SVG 추가, `--kride-kakao` 사용 | 가이드 구성 요소가 있는가? | **확인 필요** — 텍스트만 (`:101`) |
| 돌아갈 곳 | 한 줄 안내 | screenId → 한글 이름 맵, "로그인하면 ○○으로 돌아가요" | 어디로 가는지 보이는가? | **없음** — `returnTo` 저장만 |
| 보조 링크 | 회원가입·비번 찾기 | `REGISTER_PAGE` 링크 + 비밀번호 찾기 | 링크가 있는가? | **없음** — `href` 0 |
| 문구 | 사용자 언어 | "로그인 정보는 안전하게 보호돼요 · 개인정보 처리방침" | 개발 용어가 없는가? | **다름** — "인증 토큰 … 보안 쿠키" (`:103`) |
| 잔존 CSS | 없음 | `LOGIN_PAGE.css` 의 `#FDBFBC`·`::before "또는 SNS…"` 삭제 | 현재 마크업과 맞는 규칙만 있는가? | **다름** |

---

## 4. Props / State 명세

### 4-1. 내비 (신규 `SiteTabs`, `KrideNav` 대체)
```ts
tabs: [{id:'home',label:'홈',href:'/'},{id:'explore',label:'탐색',href:'/view/TOUR_EXPLORE'},
       {id:'course',label:'코스',href:'/view/ROUTE_PLANNER'},{id:'kpop',label:'K-POP',href:'/view/kpop'},
       {id:'my',label:'마이',href:'/view/MY_PAGE'}]
more (마이 안): 여행봇 · 전국 맛집 · 언어 채팅 · 커뮤니티 · 시간 설정 · 개인정보 설정 · 아티스트 코스(5단계)
props: { active: TabId; variant: 'top' | 'bottom' }   // 750px 이하 bottom, 이상 top
```

### 4-2. 화면별 ViewState
```ts
// 1. 랜딩 홈 (서버 컴포넌트 + 클라이언트 아일랜드)
type HomeIsland = 'auth-checking' | 'guest-banner' | 'resume-card';
props: { counts: { areas: 17; artists: number; eventsThisMonth: number }; popularAreas: {code,name,districts,food,holy}[] }
search: { query: string; kind: 'area' | 'artist' | 'content' }  // → TOUR_EXPLORE?area= | kpop?q= | TOUR_EXPLORE?category=HOLY&content=

// 2. 여행지 탐색
type ExploreState = 'loading' | 'ready' | 'empty-filtered' | 'error';
url: { area, sigungu?, category, arrange, content? }   // router.replace 동기화
card: { thumb, title, categoryLabel, distanceKm?, contentLine?, saved: boolean }
saved: 'local' | 'account'  // 로그인 시 병합 1회

// 3. 동선 만들기
type RouteState = 'idle' | 'generating' | 'ready' | 'error-server' | 'error-timeout' | 'error-login' | 'error-empty';
conditions: { region, purpose, duration }   // 항상 표시, 로딩·오류 중에도 보존
mode: 'basic' | 'ai'                        // segmented, 길 찾기는 결과 액션
actions: { directions, share, save }        // 하단 고정 바
retry: () => void                           // fetchedKeyRef 리셋

// 4. 아티스트
type ArtistListState = 'loading' | 'ready' | 'empty-filtered' | 'error';
props: { q: string /* 즉시 필터 */, filter: 'all' | 'group' | 'solo' | 'saved', visible: number /* 더 보기 */, total: number }
card: { photo?: string; initials: string; name; sub: string /* 그룹·n인 | 솔로 */; saved }

// 5. 팬 일정
type FeedState = 'loading' | 'ready' | 'empty' | 'error' | 'invalid';
filters: { artistId?, geography, countryCode?, range: 'week' | 'month' | 'quarter' | {from,to} }  // 선택 즉시 navigate()
groups: { month: string; count: number; items: Row[] }[]
guestBanner: boolean   // scope 토글 대신

// 6. 로그인
type LoginState = 'idle' | 'email-open' | 'submitting' | 'error';
props: { returnLabel?: string /* screenId → 한글 */, providers: ['kakao','email'], links: ['register','reset'] }
```

---

## 5. 자가 진단 체크리스트 (구현 전 2026-10-20 / 구현 후 빈칸)

| # | 점검 문장 (예/아니오) | 1 랜딩 | 2 탐색 | 3 동선 | 4 아티스트 | 5 팬 일정 | 6 로그인 | 구현 후 |
|---|---|---|---|---|---|---|---|---|
| 1 | Primary 액션 버튼이 화면에 하나뿐인가? | **아니오**(3) | 예 | **아니오** | 예 | 예 | **아니오** | |
| 2 | 첫 화면에 입력/선택할 것이 하나 보이는가? | **아니오** | 예 | **아니오** | 예 | 부분 | 예 | |
| 3 | 탭·타일에 실제 수량이 보이는가? | **아니오** | 부분 | 예 | 부분 | 예 | – | |
| 4 | 최초 로딩이 Skeleton 인가? | – | **아니오** | **아니오** | **아니오** | **아니오** | – | |
| 5 | 재시도·필터 변경 중 조건이 유지되는가? | – | 예 | 부분 | 예 | 예 | 예 | |
| 6 | 오류 시 원인 + Retry 가 있는가? | – | 예 | **아니오** | 예 | 예 | 부분 | |
| 7 | 같은 라벨이 같은 화면으로 가는가? | **아니오** | **아니오** | **아니오** | **아니오** | **아니오** | **아니오** | |
| 8 | 페이지네이션이 넘칠 때만 보이는가? | – | 예 | – | **아니오** | 예 | – | |
| 9 | 390px 헤더 1줄 + 핵심 행동이 첫 화면에? | **아니오** | **아니오** | **아니오** | **아니오** | **아니오** | **아니오** | |
| 10 | aria-label·aria-live·role 이 있는가? | 예 | 예 | 부분 | 예 | 예 | 예 | |
| 11 | 저장이 계정 동기화되거나 로그인 유도가 있는가? | – | **아니오** | – | 예 | 예 | – | |
| 12 | 사용자 언어 문구인가? | 예 | **아니오** | 예 | 부분 | 부분 | **아니오** | |
| 13 | 모바일 하단 탭 또는 1줄 헤더가 있는가? | **아니오** | **아니오** | **아니오** | **아니오** | **아니오** | **아니오** | |
| 14 | 색이 토큰에서만 오는가? | 부분 | **아니오** | **아니오** | **아니오** | **아니오** | **아니오** | |

---

## 6. 갭 요약 → 할 일 (효과 큰 순)

- [ ] **H0 내비 통일** — `KrideNav` 로고·홈 → `/`, 탭 5개 + 750px 이하 `BottomNav`, "코스 만들기" → ROUTE_PLANNER 고정, INTRO 는 "아티스트 코스(5단계)" 로 개명, 나머지는 마이 > 더보기. (`KrideNav.tsx`, `AppShell.tsx`, `KpopNav.tsx`, `kride-unified.css`, `BottomNav.tsx`)
- [ ] **H1 토큰화** — `tour-explore.css`·`fan-events.css`·`artist-catalog.css` 16진수 → 토큰, `LOGIN_PAGE.css` 잔존 삭제, `RouteScreen.tsx` 인라인 → `route-screen.css`, 포커스 링 1종.
- [ ] **H2 상태 패널** — 4화면 텍스트 로딩 → `ScreenSkeleton`/카드 Skeleton, 오류 → `KrideStatePanel`, 동선 재시도 추가.
- [ ] **H3 랜딩 홈** — 히어로 검색 + Primary 1, 하단 CTA 삭제, 카테고리 타일 4 + 인기 지역 4(기존 데이터), 로그인 배너/이어서 하기 아일랜드.
- [ ] **H4 탐색** — 고정 필터 바 + 칩 레일, "서울 맛집 24곳" + 정렬, 카드 2열(썸네일·카테고리·거리), 카드 탭 = 핀, URL 동기화, 저장 서버 동기화.
- [ ] **H5 동선** — 조건 카드 상단 고정, segmented 2개, 시간 설정 위젯 이동, 하단 액션 바, 구간 이동 1줄.
- [ ] **H6 아티스트** — 즉시 검색 + 필터 칩, 원형 그리드 3/6열, 더 보기, 탭 카운트, 목록 카드 간소화.
- [ ] **H7 팬 일정** — 필터 1줄, 비로그인 배너, 월 헤더 + 요일, 면책 1회, 행 Skeleton.
- [ ] **H8 로그인** — 카카오 최상단(심볼 + #FEE500 + 48px), 이메일 접기, returnTo 안내, 회원가입·비번 찾기, 개발 문구 교체.

**검증 방법**: 구현 후 §5 "구현 후" 열을 예/아니오로 채우고 날짜를 적는다. 390px·1200px 스크린샷을 `evidence/after-0n-*.png` 로 남긴다. `npx jest tests --runInBand` + 라벨 변경에 걸리는 `TourExploreScreen.test.tsx`·`RouteScreen.test.tsx`·`FoodHubLanding.test.tsx`·`Sidebar.test.tsx` 갱신.

---

## 7. Before / After

HTML 짝 문서에 화면별로 **Before(소스 재현)** 와 **After(기대 화면 GUI 목업)** 를 나란히 두었다. 목업은 구조와 규칙을 보여주는 것이며 최종 비주얼이 아니다.

| # | Before 근거 | After 핵심 변화 |
|---|---|---|
| 1 | `app/page.tsx` + `marketing.module.css` + `KrideNav.tsx` (배포 문구 일치 확인) | 탭 5 + 하단 탭 · 히어로 검색 1 + Primary 1 · 카테고리 타일 4 · 인기 지역(실제 수) · 로그인 배너 |
| 2 | `TourExploreScreen.tsx:95-300` + `TourPoiCard.tsx` + `tour-explore.css` | 고정 필터 바 · "서울 맛집 24곳" · 지도 미리보기 + 2열 카드 · Skeleton · 저장 동기화 배너 |
| 3 | `RouteScreen.tsx:115-200` + `AppShell.tsx:31` + `RecordTimeComponent.tsx` | 조건 카드 상단 · segmented 2 · 구간 이동 1줄 · 오류 패널 + 재시도 · 하단 액션 바 |
| 4 | `ArtistCatalogScreen.tsx:97-123` + `KpopCards.tsx:108-160` + `artist-catalog.css` (배포 문구 일치 확인) | 탭 + 카운트 · 즉시 검색 + 필터 칩 · 원형 그리드 3열 · 더 보기 |
| 5 | `FanEventFeed.tsx:40-56` + `fan-events.css` (배포 문구 일치 확인) | 필터 1줄 · 비로그인 배너 · 월 헤더 + 요일 · 면책 1회 · 행 Skeleton |
| 6 | `AuthFlowScreen.tsx:56-106` + `pages.css auth-flow-*` | 카카오 최상단 · "또는" + 이메일 접기 · returnTo 안내 · 보조 링크 · 사용자 문구 |

---

## 8. 한계 / 확인 바람

- **라이브 스크린샷 미확보**: 실행 환경의 egress 프록시가 `kmovement.srv1869569.hstgr.cloud:443` CONNECT 를 403 으로 거부했다(`evidence/live-fetch.txt`). 서버 측 텍스트 추출로 `/`, `/view/kpop`, `/view/KPOP_EVENTS`, `/travel/kpop`, `/travel/food` 의 배포 문구가 HEAD 소스와 일치함은 확인했다. Before 목업은 소스 재현이며, 사용자 캡처로 교체 가능.
- **클라이언트 렌더 화면**(`ROUTE_PLANNER`, `TOUR_EXPLORE`, `LOGIN_PAGE`)은 텍스트 추출이 안 돼 배포 빌드가 HEAD 와 같은지 미확인.
- **[기억] 레퍼런스** 12개는 출처 미확인. 교집합 n/N 에서 이들만으로 결정된 표준은 없다.
- **MAIN_PAGE 통합 여부**(H0)는 사용자 결정 필요. 10-06 G4 가 손본 화면이라 되돌리는 것이 아니라 `/` 로 합치는 제안이다.
- 코드는 수정하지 않았다.
