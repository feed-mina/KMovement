# KRIDE 6개 화면 UI 벤치마킹 스펙 정의서

- 작성일: 2026-10-06 · 작성: ui-benchmarking-analyst (mina-core 스킬, 교집합 방식)
- 대상 브랜치: `codex/travel-path-readiness-20261006` (HEAD `12f884d4c`) · 웹앱: `subproject/SDUI/metadata-project` (Next.js 16 App Router + SDUI 메타데이터)
- 입력 스크린샷 6장: `evidence/before-01 ~ 06` (사용자 제공, 2026-10-06 캡처)
- 짝 문서: `kride-six-screens-ui-benchmark.html` (Before 스크린샷 ↔ After 기대 화면 GUI 목업)
- 표기 규칙: 레퍼런스 뒤 `[확인]` 은 2026-10-06 웹 검색으로 출처를 확인한 항목, `[기억]` 은 확인하지 않은 항목. 코드 근거는 `파일:줄`.

> 이 문서는 **스펙과 체크리스트**다. 코드는 고치지 않았다. "구현까지" 요청이 오면 §6 할 일 순서대로 진행하면 된다.

---

## 0. 추론한 입력 (확인 바람)

기획서가 없어 스크린샷과 코드에서 Primary Goal 과 데이터 특성을 먼저 추론했다. 다르면 이 표만 고치면 된다.

| # | 화면 (screenId) | Primary Goal (한 줄) | 보조 행동 | 데이터 특성 |
|---|---|---|---|---|
| 1 | 코스 만들기 오류 (`KRIDE_FOCUS`) | 추천 실패 후 **다시 시도해 코스를 받는다** | 조건 바꾸기 · 홈으로 | 1회성 생성 요청(120초 타임아웃, 자동 재시도 없음 `useKrideItinerary.ts:11-12`), 비용 발생, 되돌리기 불필요 |
| 2 | 아티스트 선택 (`KRIDE_INTRO2`) | **1~5명 아티스트를 고르고 다음 단계로 간다** | 이전 단계 · 탐색으로 나가기 | 정적 목록 30건(DB `query_master.kride_artist_list`), 다중 선택, 상한 5 · 하한 1 |
| 3 | 홈 (`MAIN_PAGE`) | **여행(코스 만들기)을 시작한다** | K-POP 탐색 · 시간 설정 · 로그인 · 커뮤니티 · 언어 채팅 | 정적 카드 7장(역할별 노출), 로그인 전/후 분기 |
| 4 | 마이페이지 (`MY_PAGE`) | **저장한 항목과 계정 정보를 확인한다** | 내 목록 · 홈 · 로그아웃 | 계정 1건 + 저장 카운트 3종, 파괴적 행동(로그아웃) 포함 |
| 5 | 내 목록 (`KPOP_SAVED_ITEMS`) | **저장한 아티스트/이벤트/상품을 다시 본다** | 탭 전환 · 상세 보기 · 저장 해제 | 수십 건, 5개씩 서버 페이징, 탭 3종, 비어 있을 확률 높음 |
| 6 | 언어 채팅 (`AI_ENGLISH_CHAT_PAGE` 등) | **AI 와 영어/일본어로 대화 연습을 한다** | 언어 전환 · 응답 중단 · 대화 종료 | 스트리밍 응답(`/api/kride/chat/stream`), 세션 단위, 429 제한 |

설계를 가르는 축: ① 실패 시 **입력값 보존** 여부(1·6) ② **상한이 있는 다중 선택**(2) ③ **로그인 전/후 분기**(3·4·5) ④ **빈 목록이 기본값**인 화면(5) ⑤ **스트리밍/부분 실패**(6).

---

## 1. 레퍼런스 선정 (화면당 3~4개, 같은 회사 제품 중복 없음, 국내 1개 이상)

| # | 화면 | 레퍼런스 | 왜 골랐나 |
|---|---|---|---|
| 1 | 생성 실패 복구 | Google Maps 경로 계산 실패 `[확인]` · ChatGPT 응답 실패/재생성 `[기억]` · 카카오맵 길찾기 실패 `[기억]` · Shopify Polaris Empty/Error state `[확인]` | "경로를 못 찾음" 과 "서버 오류" 를 다른 문구로 분리하는 대표 사례 |
| 2 | 상한 있는 다중 선택 온보딩 | Spotify 아티스트 선택(5명 이상) `[확인]` · Pinterest 관심사 5개 선택 `[확인]` · Weverse/멜론 아티스트 팔로우 `[기억]` · Netflix 프로필 취향 선택 `[기억]` | 선택 카운터 · 하한/상한 안내 · 이니셜 폴백 아바타의 교집합이 뚜렷함 |
| 3 | 소비자 앱 홈 | Airbnb 홈 `[기억]` · 토스 홈 `[기억]` · Trip.com/Klook 홈 `[기억]` · 당근 홈 `[기억]` | 여행·금융·커머스 3도메인 섞음. Primary 1개 + 보조 타일 그리드의 교집합 |
| 4 | 마이페이지 | 토스 마이 `[기억]` · Airbnb 프로필 `[기억]` · 쿠팡 마이쿠팡 `[기억]` · GitHub Settings(Danger Zone) `[기억]` | 프로필 헤더 → 숫자 타일 → 설정 목록 → 위험 구역 분리 순서 |
| 5 | 저장 목록 (빈 상태가 기본) | Instagram 저장됨 `[기억]` · Airbnb 위시리스트 `[확인]` · 쿠팡 찜 `[기억]` · GitHub Primer Blankslate `[확인]` | 탭 + 카운트 + 첫 방문 Empty 의 "둘러보기" 행동 1개 |
| 6 | AI 대화 연습 | ChatGPT `[기억]` · Duolingo Max 대화(릴리) `[확인]` · Speak `[기억]` · 말해보카 `[기억]` | 말풍선 좌/우 · 하단 고정 입력창 · 추천 질문 칩 · 마지막 메시지 재전송 |

확인 출처: Spotify newsroom "taste onboarding" / uxcel teardown(5명 이상 선택) · Pinterest 온보딩 5개 관심사(appcues goodux) · Polaris Empty state(Primary CTA 1개, 동사+명사 라벨) · Primer Blankslate(primary + secondary 링크, "Learn more" 금지) · Google Maps "We could not calculate directions…"(seroundtable) · Duolingo Video Call(릴리에게 "다시 말해줘/천천히" 요청 가능, apps.apple.com).

---

## 2. 4축 분해 → 교집합 표준 (2/3 이상이 같은 선택을 한 항목만 "표준")

### 2-1. 오류 복구 (화면 1)
| 축 | 표준 (n/N) | 선택지(교집합 아님) |
|---|---|---|
| Layout | 원인 한 줄 + 복구 버튼 1개 + 보조 링크 1~2개 (4/4) · 사용자가 넣은 조건을 그대로 보여줌 (3/4) | ChatGPT 는 실패한 메시지 자체를 말풍선으로 남김 |
| Interaction | Retry 는 **입력값 보존 상태로 같은 요청 재전송** (4/4), 전체 새로고침 없음 (4/4) | 카카오맵은 대중교통/도보 등 대안 탭 제안 |
| State | "결과 없음" 과 "서버 오류" 가 **다른 문구** (4/4) · 연속 실패 시 안내 변경 (2/4 → 선택지) | — |
| Edge | 오프라인 감지 문구 (3/4) · 재시도 중 버튼 비활성 + 스피너 (4/4) | — |

### 2-2. 상한 다중 선택 (화면 2)
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 제목 아래 **선택 수/상한 카운터** (4/4) · 상단 단계 진행 표시 (3/4) · 검색창 (3/4) | Pinterest 는 그리드 위에 선택 칩 요약 |
| Interaction | 탭 1회로 토글 (4/4) · 상한 도달 시 나머지 비활성/흐림 + 토스트 (3/4) · CTA 는 **하한 충족 전 비활성 + 선택 수 표기** "다음 (2)" (3/4) | Spotify 는 하단 CTA 가 화면 고정(sticky) |
| State | 이미지 없음 → **이니셜 폴백**, 브랜드 톤 배경 (4/4) · 목록 로딩 Skeleton 원형 (3/4) · 목록 실패 시 Retry (3/4) | — |
| Edge | 긴 이름 2줄 말줄임 (3/4) · 모바일 3열, 데스크톱 5~6열 (3/4) · 선택 결과 세션 보존 (3/4) | — |

### 2-3. 홈 (화면 3)
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | **히어로(Primary) 1개** → 상황 카드(오늘/최근) → 기능 타일 그리드 (4/4) · 로그인은 상단 아바타/버튼, 큰 카드 아님 (4/4) | 토스는 "이어서 하기" 를 최상단에 둠 |
| Interaction | 타일은 전체가 탭 영역 (4/4) · "이어하기" 진입점 (3/4) | — |
| State | 메타데이터 로딩 Skeleton 카드 (4/4) · 로드 실패 시 재시도 배너 (3/4) | — |
| Edge | 모바일 1열, 데스크톱 2~3열 (4/4) · 배지(PREMIUM/NEW) 는 색만으로 구분하지 않음 (3/4) | — |

### 2-4. 마이페이지 (화면 4)
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 아바타+이름+이메일 헤더 → **숫자 타일(저장/찜 n개)** → 설정 목록 → 로그아웃/탈퇴 하단 (4/4) | GitHub 는 Danger Zone 을 빨간 테두리 섹션으로 |
| Interaction | 로그아웃은 ghost/텍스트 + 확인 1단계 (3/4) · 탈퇴는 별도 화면 + 입력 확인 (4/4) · 로그아웃이 **Primary 색이 아님** (4/4) | — |
| State | 프로필 로딩 Skeleton (4/4) · 로그아웃 실패 토스트 + 재시도 (3/4) | — |
| Edge | 긴 이메일 말줄임 (3/4) · 소셜 로그인 제공자 배지 (3/4) | — |

### 2-5. 저장 목록 (화면 5)
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | 탭에 **카운트** (4/4) · 카드/썸네일 목록 (4/4) · 페이지 헤더가 다른 페이지와 같은 패턴 (4/4) | Instagram 은 컬렉션 폴더 |
| Interaction | 저장 해제 즉시 반영 + Undo 토스트 (3/4) · 페이지네이션은 **항목이 한 페이지를 넘을 때만** 노출 (4/4) | — |
| State | 첫 방문 Empty = 아이콘 + 왜 비었는지 + "둘러보기" Primary 1개 (4/4) · 로딩 = 카드 Skeleton (4/4) · 오류 = 원인 + Retry (4/4) | — |
| Edge | 제목 2줄 말줄임 (4/4) · 모바일 2열 (3/4) · 비공개 항목 배지 (2/4 → 선택지) | — |

### 2-6. AI 대화 연습 (화면 6)
| 축 | 표준 (n/N) | 선택지 |
|---|---|---|
| Layout | AI 좌측 / 사용자 우측 말풍선 (4/4) · **입력창 하단 고정** (4/4) · 설명/번역은 말풍선 안 접기 (3/4) | Duolingo 는 "천천히/다시" 버튼 |
| Interaction | Enter 전송, Shift+Enter 줄바꿈 (4/4) · 전송은 글자 있을 때만 활성 (4/4) · 첫 화면 **추천 질문 칩** 3~4개 (3/4) · 종료는 확인 모달 (3/4) | — |
| State | 응답 중 타이핑 인디케이터 (4/4) · 실패한 메시지 옆 "다시 보내기", 입력값 보존 (4/4) · 스트리밍 중단 버튼 (3/4) | — |
| Edge | 긴 답변 자동 스크롤 + "새 메시지" 점프 (3/4) · 429 제한 시 남은 시간 안내 (3/4) · 모바일 키보드 올라와도 입력창 보임 (4/4) | — |

---

## 3. 갭 분석 (업계 표준 vs 현재 코드) — 있음 / 없음 / 다름

### 3-0. 모든 화면에 걸친 갭 (가장 먼저)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 (예/아니오) | 현재 |
|---|---|---|---|---|
| 전역 로딩 | 레이아웃 자리를 지키는 Skeleton | `Skeleton.css` 를 `index.css` 에 import, 화면별 Skeleton 형태 분기 | 최초 로딩에 Skeleton 이 **보이는가**? | **없음** — `components/utils/Skeleton.tsx` 가 쓰는 `.skeleton-box` 스타일은 `app/styles/Skeleton.css` 에만 있고 어디서도 import 되지 않음(`app/styles/index.css` 19개 import 중 없음). `SduiScreen.tsx:24`, `AuthFlowScreen.tsx:123`, `KrideFocusScreen.tsx:162` 의 전체 Skeleton 이 빈 div 로 렌더됨 |
| 공용 상태 컴포넌트 | Empty / Error / Loading 패널 공용 | `KrideStatePanel` 하나(라이트/다크 `tone` prop)로 통일 | 화면마다 다른 마크업으로 상태를 만들지 않는가? | **없음** — 공용 EmptyState/ErrorState 없음. `RaiStatePanel`(`KridePrimitives.tsx:106-125`)은 다크 전용. `PersonalSaved.tsx:64`, `LanguageChatScreen.tsx:18` 은 클래스 없는 `<p>`/`<div role="alert">` 직접 작성. `app/error.tsx`, `app/loading.tsx` 없음 |
| 테마 일관성 | 토큰 한 벌 | `tokens.css` 의 `--kride-*`/`--surface-*` 만 사용 | 하드코딩 색이 없는가? | **다름** — `KRIDE_CHAT.css:13-25` 별도 `--kc-*` 다크 팔레트, `kride-unified.css` 언어 채팅에 `#e50914`/`#f5f1ea` 하드코딩, `KRIDE.css:150-163` 가 FOCUS 만 강제 다크 |
| 고정 요소 겹침 | 고정 버튼 간 z-index/위치 규칙 | 하단 고정 영역을 하나(CTA 바)로 합치고 개인정보 버튼은 그 안/푸터로 | 우하단에서 버튼이 겹치지 않는가? | **없음** — `PrivacySettingsButton.tsx:5-16` (fixed, z 9998) 이 `.kride-next-btn-br`(fixed 1.5rem) 과 `FocusFooterBar` 위에 겹침(스크린샷 1·2 에서 확인) |
| 홈 진입점 | "홈" 은 한 곳 | `KrideNav` 홈 링크와 `FocusFooterBar` 홈 링크를 같은 경로로 | 홈 버튼 두 개가 같은 화면으로 가는가? | **다름** — `KrideNav.tsx:5` 홈 → `/`(마케팅 페이지), `FocusFooterBar.tsx` 홈 → `/view/MAIN_PAGE` |

### 3-1. 코스 만들기 오류 (`components/plugins/travel/KrideFocusScreen.tsx`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 재시도 방식 | 입력값 보존 + 같은 요청 재전송 | `useKrideItinerary` 에 `retry()` 노출(`calledRef` 리셋), 버튼은 재시도 중 비활성 | 재시도 후 고른 조건이 보존되는가? | **다름** — `KrideFocusScreen.tsx:181` `window.location.reload()` 로 전체 새로고침. 훅은 one-shot(`useKrideItinerary.ts:80,92`) |
| 오류 구분 | 결과 없음 ≠ 서버 오류 | HTTP 4xx(결과 없음) / 5xx·timeout(서버) / offline 세 갈래 문구 | 제목과 설명이 같은 원인을 말하는가? | **다름** — 제목은 "코스를 못 찾았어요"(결과 없음 뉘앙스) 인데 설명은 모든 non-ok 응답을 "추천 서버에 문제가 있어요" 로 매핑(`useKrideItinerary.ts:55`) |
| 조건 표시 | 실패 화면에 내가 넣은 조건 칩 | 선택 아티스트·지역·일정 칩 + "조건 바꾸기" ghost 버튼 | 실패 화면에서 조건을 볼 수 있는가? | **없음** — `RaiStatePanel` 에 children 버튼 1개만 |
| 보조 행동 | 둘러보기/문의 링크 | "인기 코스 둘러보기", "문의하기" 텍스트 링크 | Primary 1개 + 보조 링크가 있는가? | **다름** — Primary 1개는 맞으나 보조 경로 없음 |
| 레이아웃 | 카드 중앙 정렬, 하단 바에 가리지 않음 | `max-width:560px; margin:auto; padding-bottom: 하단바 높이` | 카드가 하단 바에 잘리지 않는가? | **없음** — 스크린샷 1 에서 카드가 좌측 정렬·하단 바에 잘림. `.page-wrap.KRIDE_FOCUS` 강제 다크(`KRIDE.css:150-163`) 로 INTRO 라이트 테마와 단절 |
| 연속 실패 | n회 실패 후 안내 변경 | 3회 실패 시 문구 변경 + 30초 쿨다운 | (선택지) | 없음 |

### 3-2. 아티스트 선택 (`SDUI V53/V56` + `SelectionCard.tsx` + `CardImage.tsx`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 선택 카운터 | "2 / 5 선택" 상시 표시 | 제목 옆 카운터 + CTA 라벨 "다음 · 2명 선택됨" | 현재 선택 수가 화면에 보이는가? | **없음** — 부제 "최대 5명까지" 만(V53 `intro2_sub`), 카운터 없음. 상한 도달 시 `kride-warning` 토스트만(`SelectionCard.tsx:22-28`) |
| 하한 | 1명 미만이면 CTA 비활성 | `minCount=1` 유지하되 **숨김이 아닌 비활성 + 이유 문구** | 0명일 때 왜 못 가는지 보이는가? | **다름** — `KrideNextButton.tsx:8-11` 은 `minCount` 미만이면 버튼을 **숨김**(isVisible). 사용자는 다음 버튼이 왜 없는지 모름 |
| 폴백 아바타 | 이니셜 + 브랜드 톤 | `bg-[var(--kride-primary-soft)] text-[var(--kride-primary)]`, 2글자 | 이미지 없는 카드가 브랜드 톤인가? | **다름** — `CardImage.tsx:27-28` `bg-gray-800 text-white` 네이비. 30명 중 12명이 이미지 없음(`lib/kride/artistImages.ts:2-10` 화이트리스트 25개 ↔ V56 CASE 는 13명만 imageUrl, 일부 `.png` 경로 오기) |
| 상단 진행 | 단계 바 + 뒤로 | 5칸 진행 바, "이전"은 좌측 | 진행 상태가 시각적으로 보이는가? | **다름** — 텍스트 "2/5단계" 만(`AppShell.tsx:29-30`), 바 없음. "이전 단계" 가 우상단 |
| CTA 위치 | 하단 고정 바 | sticky bottom bar(이전 / 다음) | 다음 버튼이 다른 고정 요소와 겹치지 않는가? | **없음** — 우하단 플로팅(`.kride-next-btn-br`) 이 개인정보 설정 버튼과 겹침 |
| 목록 상태 | 로딩 Skeleton / 실패 Retry | SDUI 그룹에 `loading`/`error` 슬롯 | 아티스트 쿼리 실패 시 안내가 있는가? | **없음** — SDUI 그룹(`ref_data_id='artists'`) 실패 시 그냥 빈 그리드 |
| 검색 | 10개 이상이면 검색창 | 상단 검색 + 선택 칩 요약 | (선택지, 30건이라 권장) | 없음 |

### 3-3. 홈 (`MAIN_PAGE` SDUI, `pages.css:2857+`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| Primary 1개 | 히어로 1개 | "K-RIDE 시작하기" 만 filled, K-POP 은 타일로 | 빨간 filled CTA 가 하나인가? | **다름** — "여행 시작하기"(V51) 와 "K-POP 탐색하기"(V89) 둘 다 히어로 + filled. "로그인 하러가기" 도 큰 빨간 블록(V8:114-131) → Primary 3개 |
| 로그인 안내 | 상단 아바타/버튼, 한 줄 배너 | 로그인 전: 히어로 아래 1줄 배너, 후: 아바타 | 로그인 후에 로그인 카드가 사라지는가? | **확인 필요** — V93 이 `allowed_roles=NULL` 로 모두에게 노출하도록 바꿈. 스크린샷 3·4 가 같은 세션이면 로그인 후에도 노출됨 |
| 로딩 | Skeleton 카드 | `usePageMetadata.loading` 을 `SduiScreen` 에 연결 | 메타데이터 로딩 중 Skeleton 이 보이는가? | **없음** — `SduiScreen.tsx:24` 는 auth/guard 중만 Skeleton, 메타데이터 `loading` 플래그는 무시(`usePageMetadata.tsx:121-155`) |
| 오류 | 재시도 배너 | `MetadataProvider` 에 error 노출 + 배너 | 메타데이터 실패 시 화면이 안내하는가? | **없음** — `MetadataProvider.tsx:64-76` 에 error 상태 없음 |
| 시간 카드 | 값이 있으면 값 표시 | "오후 7:00 · 성수 팝업" + 변경 | 설정된 시간이 카드에 보이는가? | **다름** — 질문형 문구 + 펼치기(`RecordTimeComponent.tsx:73,93`) 고정 |
| 배지 | 색+텍스트 | PREMIUM 텍스트 배지 유지 | 색만으로 구분하지 않는가? | 있음 (`pages.css:3916-3918` 텍스트 `::after`) |

### 3-4. 마이페이지 (`components/screens/AuthFlowScreen.tsx:108-169`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 헤더 | 아바타 + 이름 + 이메일 + 제공자 배지 | 이니셜 아바타 48px, 카카오 배지 | 첫 화면에서 누구인지 한눈에 보이는가? | **다름** — 제목 "마이페이지" + 설명문, 정보는 아래 dl 표(`:136-153`) |
| 숫자 타일 | 저장 n개 타일 | 3 타일(아티스트/이벤트/상품) → 내 목록 탭 딥링크 | 저장 수가 보이는가? | **없음** — `.my-saved-shortcuts` 버튼 3개에 카운트 없음(`:135`) |
| 액션 위계 | Primary 는 비파괴 행동, 로그아웃은 텍스트 | 로그아웃 ghost + 확인 1단계, 탈퇴 별도 | 빨간 Primary 가 파괴적 행동이 아닌가? | **다름** — `:161` 로그아웃이 `auth-flow-button primary`(빨강 filled). 확인 단계 없음. "내 목록 보기"·"홈으로"·바로가기 3개·로그아웃 = 6개 버튼 |
| 실패 처리 | 로그아웃 실패 토스트 | `handleLogout` catch → 토스트 + 재시도 | 로그아웃 실패 시 안내가 있는가? | **없음** — 에러 처리 없음 |
| 로딩 | Skeleton | 카드 모양 Skeleton | 로딩 중 레이아웃이 유지되는가? | **없음** — `:123` `<Skeleton/>` 이지만 CSS 미import(§3-0) |
| 긴 문자열 | 이메일 말줄임 | `auth-profile-row dd` 에 ellipsis | 긴 이메일에서 표가 깨지지 않는가? | 확인 필요(`pages.css:4389-4545` 에 말줄임 규칙 없음) |

### 3-5. 내 목록 (`components/plugins/kpop/PersonalSaved.tsx:37-72`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 페이지 스타일 | 마이페이지와 같은 카드/헤더 패턴 | `auth-flow-card` 와 같은 토큰·여백·버튼 변형 재사용 | 마이페이지와 같은 룩인가? | **다름** — 스크린샷 5 는 맨 텍스트. 소스상 `.personal-saved` 카드 규칙은 `kride-unified.css`(커밋 dca274c2e) 에 있으나 탭은 맨 `<button>`(`border:1px solid currentColor`), h2/p/"프로필로" 링크 무스타일. 스크린샷에 "이벤트 찾아보기" 버튼이 없어 **배포 빌드가 dca274c2e 이전일 가능성** |
| 탭 카운트 | 탭에 n | "아티스트 3 · 이벤트 0 · 상품 1" | 탭만 보고 어디에 뭐가 있는지 아는가? | **없음** |
| 첫 방문 Empty | 아이콘 + 왜 + 둘러보기 1개 | `.kride-empty` 에 아이콘·이유·Primary | Empty 에 아이콘과 이유가 있는가? | **다름** — 문구 + 링크만(`:65`). "빈 목록입니다" 는 왜 비었는지 설명 없음 |
| 페이지네이션 | 넘칠 때만 | `total > pageSize` 조건 | 0건일 때 "1페이지 · 5개씩" 이 숨는가? | **다름** — `:68-69` 항상 노출(스크린샷 5 에서 0개인데 표시) |
| 로딩 | 카드 Skeleton | 3장 Skeleton | Skeleton 인가? | **다름** — `<p role="status">목록을 불러오는 중…</p>`(`:64`) |
| 오류 | 원인 + Retry | 공용 ErrorPanel | Retry 가 있는가? | 있음(`:64`) — 단 무스타일 |
| 저장 해제 | 즉시 + Undo | 토스트 "저장 취소됨 · 되돌리기" | Undo 가 있는가? | **없음** |

### 3-6. 언어 채팅 (`components/screens/LanguageChatScreen.tsx`)
| 평가 영역 | 업계 표준 | 추천 구현 | 점검 기준 | 현재 |
|---|---|---|---|---|
| 말풍선 | 좌/우 분리 | `.language-message[data-role]` 로 정렬·색 분기 | AI 와 내 메시지가 한눈에 구분되는가? | **확인 필요** — 스크린샷 6 은 대화 전. `kride-unified.css` 의 `.language-message` 에 역할별 정렬 규칙이 있는지 확인 안 됨 |
| 입력창 위치 | 하단 고정 | `position:sticky; bottom:0` + 모바일 `env(safe-area-inset-bottom)` | 대화가 길어져도 입력창이 보이는가? | **없음** — 스레드 아래에 일반 흐름 |
| 전송 활성 | 글자 있을 때만 | 유지 + 비활성 상태 대비 개선 | 비활성 이유가 보이는가? | 있음(`disabled={busy||!input.trim()}`) — 단 비활성 색(연분홍)과 활성 색 대비가 약함 |
| 추천 질문 | 첫 화면 칩 3~4개 | "길 묻기 · 카페 주문 · 굿즈 줄 서기" | 빈 화면에 시작 행동이 있는가? | **다름** — 텍스트 예시 1줄만("예: How can I order coffee?") |
| 대화 종료 | 확인 모달 | `confirm` 또는 모달 + "기록이 사라져요" | 종료 전 확인이 있는가? | **없음** — `confirm(` 0회, 전송 버튼 바로 옆 |
| 실패 메시지 | 말풍선 옆 다시 보내기 | 실패 말풍선 + 재전송(입력값 보존) | 실패 시 입력이 남아 있는가? | **다름** — `send(last,true)` 재전송은 있으나 무스타일 `<div role="alert">` |
| 설명/번역 | 말풍선 안 접기 | `<details>한국어 설명</details>` | 설명이 답변과 같은 말풍선에 있는가? | 확인 필요 |
| 시험 운영 안내 | 상단 작은 배너 | info 배너 | 안내가 입력 전에 보이는가? | **다름** — 화면 맨 아래 문장 |
| 색 | 토큰 | `--kride-*` | 하드코딩 없는가? | **다름** — `#e50914`, `#f5f1ea` 직접 사용 |

---

## 4. Props / State 명세

### 4-1. 공용 상태 패널 (신규, 모든 화면이 씀)
```ts
// components/fields/kride/atoms/KrideStatePanel.tsx (제안)
props: {
  kind: 'empty-first' | 'empty-filtered' | 'loading' | 'error' | 'forbidden' | 'offline';
  tone?: 'light' | 'dark';            // FOCUS 만 dark, 나머지 light
  title: string;
  description?: string;               // 원인 한 줄. kind='error' 면 필수
  icon?: ReactNode;                   // 기본: kind 별 이모지/일러스트
  primaryAction?: { label: string; onClick: () => void; busy?: boolean }; // 화면당 1개
  secondaryLinks?: { label: string; href: string }[];                   // 최대 2개
  context?: ReactNode;                // 사용자가 넣은 조건 칩 등
}
```

### 4-2. 화면별 ViewState (유니온으로 두어 빠진 상태가 보이게)
```ts
// 1. KRIDE_FOCUS
type FocusState = 'auth-checking' | 'generating' | 'success'
  | 'error-no-route' | 'error-server' | 'error-timeout' | 'error-offline' | 'requires-login' | 'candidates-unavailable';
props: { retry: () => void /* calledRef 리셋 */, retrying: boolean, failCount: number, conditions: Chip[] }

// 2. KRIDE_INTRO2
type ArtistStepState = 'loading' | 'ready' | 'error' | 'max-reached';
props: { selected: string[], min: 1, max: 5, onToggle, query: string /* 검색 */ }
nextButton: { disabled: selected.length < min, label: `다음 · ${selected.length}명 선택됨` }  // 숨김 대신 비활성

// 3. MAIN_PAGE
type HomeState = 'auth-checking' | 'metadata-loading' | 'ready' | 'metadata-error';
props: { isLoggedIn, resumeCourse?: { id, title }, todayAppointment?: { time, place } }

// 4. MY_PAGE
type ProfileState = 'loading' | 'ready' | 'logging-out' | 'logout-error' | 'redirect-login';
props: { counts: { artists: number; events: number; products: number }, provider: 'kakao' | 'email' }

// 5. KPOP_SAVED_ITEMS
type SavedState = 'auth-checking' | 'loading' | 'success' | 'empty-first' | 'error' | 'forbidden';
props: { kind, counts: Record<Kind, number>, items, page, pageSize: 5, total, onUnsave(id) /* + Undo */ }
pagination: { visible: total > pageSize }

// 6. AI_*_CHAT_PAGE
type ChatState = 'auth-checking' | 'idle-empty' | 'streaming' | 'ready' | 'error-last' | 'rate-limited' | 'ended';
props: { suggestions: string[], onEndConfirm: () => Promise<boolean>, retryLast, stop, remainingCooldown?: number }
```

---

## 5. 자가 진단 체크리스트 (구현 전 2026-10-06 / 구현 후 빈칸)

| # | 점검 문장 (예/아니오) | 1 오류 | 2 아티스트 | 3 홈 | 4 마이 | 5 내 목록 | 6 채팅 | 구현 후 (2026-10-06, 화면 1~6 순) |
|---|---|---|---|---|---|---|---|---|
| 1 | Primary 액션 버튼이 화면에 하나뿐인가? | 예 | 예 | **아니오**(3개) | **아니오**(로그아웃이 Primary) | 예 | 예 |  예 · 예 · 예(V124) · 예(로그아웃 ghost) · 예 · 예 |
| 2 | 첫 방문 Empty 에 안내 문구와 시작 행동 1개가 있는가? | – | – | – | – | **부분**(이유 없음) | **아니오**(예시 1줄) |  – · – · – · – · 예(아이콘+이유+둘러보기) · 예(추천 칩 3개) |
| 3 | 필터/탭 결과 없음에 "초기화/둘러보기" 가 있는가? | – | – | – | – | 예(링크) | – |  – · – · – · – · 예 · – |
| 4 | 최초 로딩이 Skeleton 이고 레이아웃이 튀지 않는가? | **아니오**(CSS 미import) | **아니오** | **아니오** | **아니오** | **아니오**(텍스트) | **아니오**(텍스트) |  예 · 부분(화면 전체만) · 예 · 예 · 예(카드 3장) · 부분(텍스트 유지) |
| 5 | 갱신/재시도 중 기존 데이터·입력값이 유지되는가? | **아니오**(reload) | – | – | – | 예 | 예 |  예(retry, 조건 보존) · – · – · – · 예 · 예 |
| 6 | 오류 시 원인 한 줄 + Retry 가 있고 원인별 문구가 다른가? | **부분**(문구 1종) | **아니오** | **아니오** | **아니오** | 예 | 예 |  예(4종 문구) · **아니오**(SDUI 그룹 미구현) · 예(재시도 배너) · 예(로그아웃 실패) · 예 · 예(실패 말풍선) |
| 7 | 긴 문자열에 말줄임 + 전체 보기가 있는가? | – | 확인 필요 | – | 확인 필요 | 확인 필요 | – |  – · 확인 필요 · – · 예(이메일 anywhere) · 예(2줄 clamp) · – |
| 8 | 페이지네이션이 넘칠 때만 보이는가? | – | – | – | – | **아니오** | – |  – · – · – · – · 예(6개 이상만) · – |
| 9 | 375px 에서 가로 스크롤 없이 핵심 행동이 가능한가? | 확인 필요 | 확인 필요 | 확인 필요 | 예(560px 카드) | 확인 필요 | 확인 필요 |  확인 필요(브라우저 미검증) · 확인 필요 · 확인 필요 · 예 · 확인 필요 · 확인 필요 |
| 10 | 아이콘 버튼 aria-label, 상태 변화 aria-live/role 이 있는가? | 예(role) | 부분 | 부분 | 예 | 예(role) | 예(role) |  예 · 예(status/aria-describedby) · 예 · 예 · 예 · 예 |
| 11 | 파괴적 행동(로그아웃·대화 종료·저장 해제)에 확인 또는 Undo 가 있는가? | – | – | – | **아니오** | **아니오** | **아니오** |  – · – · – · 예(확인 1단계) · 예(Undo 토스트) · 예(종료 확인) |
| 12 | 선택 수/상한/하한이 화면에 상시 보이는가? | – | **아니오** | – | – | – | – |  – · 예("n / 5 선택") · – · – · – · – |
| 13 | 고정 요소(CTA·개인정보·하단 바)가 서로 겹치지 않는가? | **아니오** | **아니오** | 예 | 예 | 예 | 확인 필요 |  예(카드 중앙·하단 여백) · 예(sticky 바, 개인정보 버튼 메뉴 이동) · 예 · 예 · 예 · 예 |
| 14 | 색이 토큰에서만 오는가? | **아니오** | 부분 | 예 | 예 | 부분 | **아니오** |  예(상태 카드 토큰) · 부분 · 예 · 예 · 예 · 예(language-chat.css 토큰화) |

스크립트 점검(`scripts/ui-diff-check.js`, `evidence/ui-diff-check.txt`): 8개 파일 중 빈 상태 흔적 ✅ 2개, 로딩 ✅ 6개, 오류 ✅ 4개, 말줄임 ✅ 1개, 반응형 ✅ 0개. ❓ 는 누락 확정이 아니라 "해당 파일에서 못 찾음" 이며 위 표에서 상위 컴포넌트까지 보고 판정했다.

---

## 6. 갭 요약 → 할 일 (효과 큰 순)

- [x] **G0 Skeleton CSS 연결** — `app/styles/index.css` 에 `@import "./Skeleton.css"` 1줄. 화면 1·3·4 의 전체 로딩이 즉시 보이게 됨. (근거 §3-0)
- [x] **G1 공용 `KrideStatePanel`** — `RaiStatePanel` 을 `tone` prop 으로 확장해 라이트 지원, `PersonalSaved.tsx:64-65`·`LanguageChatScreen.tsx:18`·`KrideFocusScreen.tsx:175` 가 같은 컴포넌트를 쓰게. `app/error.tsx` 추가.
- [x] **G2 오류 재시도를 reload 에서 훅 retry 로** — `useKrideItinerary.ts` 에 `retry()` 추가(`calledRef.current=false` 후 재호출), `KrideFocusScreen.tsx:181` 교체. 조건 칩 + "조건 바꾸기" 추가. 오류 종류별 문구(`toUserMessage` 4xx/5xx/timeout/offline).
- [x] **G3 아티스트 단계** — 선택 카운터 + CTA 라벨에 선택 수, `KrideNextButton` 숨김 → 비활성, `CardImage` 폴백을 브랜드 톤 이니셜로, 하단 sticky 바(이전/다음), 12명 이미지 보충 또는 V56 경로 오기(.png) 수정.
- [x] **G4 홈 Primary 1개** — K-POP 카드를 타일로 강등, 로그인 카드를 1줄 배너로, `SduiScreen` 에 `loading`/`error` 연결, `KrideNav` 홈 경로를 `FocusFooterBar` 와 통일.
- [x] **G5 마이페이지 위계** — 헤더(아바타·이름·이메일·제공자), 숫자 타일 3개(카운트 API 필요), 로그아웃 ghost + 확인, 탈퇴 분리, 로그아웃 실패 토스트.
- [x] **G6 내 목록 스타일 통일** — `auth-flow-*` 토큰 재사용, 탭 카운트, Empty 아이콘·이유, 페이지네이션 `total > 5` 조건, Skeleton 3장, 저장 해제 Undo. 배포 빌드가 dca274c2e 를 포함하는지 먼저 확인.
- [x] **G7 언어 채팅** — 말풍선 좌/우, sticky 입력창, 추천 질문 칩 3개, 종료 확인 모달, 실패 말풍선 + 다시 보내기, 시험 운영 안내를 상단 배너로, 색 토큰화.
- [x] **G8 고정 요소 정리** — `PrivacySettingsButton` 을 푸터/더보기로 이동하거나 하단 CTA 바 안에 배치.

**검증 방법**: 구현 후 §5 표의 "구현 후" 열을 예/아니오로 채우고 날짜를 적는다. 스크린샷은 `evidence/after-0n-*.png` 로 같은 폴더에 남긴다.

---

## 7. Before / After

HTML 짝 문서 `kride-six-screens-ui-benchmark.html` 에 화면별로 **Before(사용자 스크린샷)** 와 **After(기대 화면 GUI 목업)** 를 나란히 두었다. 목업은 구조와 규칙을 보여주는 것이며 최종 비주얼이 아니다. 각 목업 아래 작은 글씨가 적용 규칙이다.

| # | Before | After 핵심 변화 |
|---|---|---|
| 1 | `evidence/before-01-course-error.png` | 조건 칩 보존 · 원인별 문구 · Retry 1개 + 보조 링크 · 카드 중앙 · 하단 바와 분리 |
| 2 | `evidence/before-02-course-artist-step.webp` | 진행 바 · "2 / 5 선택" 카운터 · 검색 · 브랜드 톤 이니셜 · sticky 이전/다음 |
| 3 | `evidence/before-03-home.png` | 히어로 1개 · "지난 코스 이어하기" · 오늘의 약속 값 표시 · 2×2 기능 타일 |
| 4 | `evidence/before-04-mypage.png` | 아바타 헤더 · 숫자 타일 3개 · 설정 목록 · 로그아웃/탈퇴 하단 텍스트 |
| 5 | `evidence/before-05-saved-list.png` | 카드 레이아웃 · 탭 카운트 · 아이콘 Empty + "이벤트 둘러보기" · Skeleton |
| 6 | `evidence/before-06-language-chat.png` | 말풍선 좌/우 · 접히는 한국어 설명 · 실패 말풍선 · 추천 칩 · sticky 입력창 |

---

## 8. 구현 기록 (2026-10-06, G0 → G8)

테스트: `npx jest tests --runInBand` 98 스위트 · 568 테스트 통과. 린트는 변경 파일 기준 신규 오류 0 (기존 오류 3건은 그대로: `AnalyticsProvider` setReady-in-effect, `PersonalSaved` ref 접근 2건). 브라우저 실화면 검증은 하지 않았다 (CLAUDE.md "브라우저 자동 실행 금지" · 백엔드 DB 마이그레이션 V123/V124 적용 필요).

| 할 일 | 한 일 | 파일 |
|---|---|---|
| G0 | `Skeleton.css` import + 화면 전체용 `ScreenSkeleton`(제목 줄 + 카드 3장) · `/view` 라우트 `loading.tsx` | `app/styles/index.css`, `components/utils/ScreenSkeleton.tsx`, `app/view/loading.tsx` |
| G1 | 공용 `KrideStatePanel`(kind 6종, tone light/dark, Primary 1 + ghost 1 + 링크 2, 오류는 role=alert) + `KrideStateChips` · `RaiStatePanel` 에 `tone` prop · 루트 `app/error.tsx` | `components/fields/kride/atoms/KrideStatePanel.tsx`, `app/styles/kride-state.css`, `KridePrimitives.tsx`, `app/error.tsx` |
| G2 | `useKrideItinerary` 에 `retry()`·`errorKind`(no-route/server/timeout/offline/login/candidates)·`failCount` · FOCUS 오류 카드: 원인별 제목, 조건 칩, 다시 시도(새로고침 없음) + 조건 바꾸기 + 보조 링크 2, 3회 연속 실패 시 30초 잠금 · 카드 중앙·하단 바 여백 | `useKrideItinerary.ts`, `KrideFocusScreen.tsx`, `kride-unified.css` |
| G3 | `KRIDE_SELECTION_COUNTER` 컴포넌트("n / 5 선택") + V123 행 추가 · `KrideNextButton` 숨김→비활성+이유, 라벨에 선택 수 · `CardImage` 폴백 브랜드 톤 2글자 이니셜 · 다음 버튼 sticky 바 · V56 의 .png 경로 정정 + 존재하는 jpg 6개 추가 매핑 | `KrideSelectionCounter.tsx`, `KrideNextButton.tsx`, `CardImage.tsx`, `register.ts`, `V123__kride_intro2_counter_and_artist_images.sql` |
| G4 | V124: K-POP 카드 → 흰 타일, 로그인 카드 → 한 줄 배너(sort 6) · `SduiScreen` 메타데이터 로딩 Skeleton / 실패 시 재시도 패널 (`MetadataProvider`→`usePageMetadata`→`useSduiScreen` 에 isError/refetch 배관) · `KrideNav` 홈 → `/view/MAIN_PAGE` | `V124__main_page_primary_hierarchy.sql`, `pages.css`, `SduiScreen.tsx`, `MetadataProvider.tsx`, `usePageMetadata.tsx`, `useSduiScreen.ts`, `KrideNav.tsx` |
| G5 | 아바타 헤더(이니셜·ID·이메일·제공자 배지) · 저장 숫자 타일 3개(`/me/saved/{kind}?page=1` totalCount) → 내 목록 탭 · 설정 목록 3행 · 로그아웃 텍스트 + 확인 1단계("네, 로그아웃") + 실패 문구·재시도 · 탈퇴 문의 링크 분리 | `AuthFlowScreen.tsx`, `pages.css` |
| G6 | 카드 레이아웃(마이페이지 토큰) · 탭 카운트(방문한 탭의 totalCount 기억, 추가 요청 없음) · Empty = 아이콘+이유+"둘러보기" · 카드 Skeleton 3장 · 오류 패널 · 페이지네이션/페이지 문구는 6개 이상일 때만 · 삭제 후 "되돌리기" 토스트(POST 재저장) · 로그인 전 forbidden 패널 | `PersonalSaved.tsx`, `personal-saved.css` |
| G7 | 말풍선 좌/우(`data-role`) · 입력창 sticky + Enter 전송/Shift+Enter 줄바꿈 · 추천 질문 칩 3개(언어별) · 종료 확인 단계 · 실패 말풍선 + 다시 시도(입력값 보존) · 타이핑 인디케이터 · 시험 운영 안내 상단 배너 · 색 토큰화(`language-chat.css`, `kride-unified.css` 의 옛 규칙 제거) | `LanguageChatScreen.tsx`, `language-chat.css` |
| G8 | 개인정보 설정 버튼을 더보기 메뉴 항목으로 · 메뉴 항목이 마운트되면 Provider 에 등록되어 떠 있는 버튼은 스스로 숨음(메뉴 없는 셸에선 폴백 유지) | `PrivacySettingsButton.tsx`, `AnalyticsProvider.tsx`, `KrideNav.tsx` |

### 하지 않은 것 / 확인 바람
- **아티스트 이미지 12명 보충**: 실제 사진 파일은 만들 수 없어 브랜드 톤 이니셜 폴백으로 대체했다. `public/artists/` 에 jpg 를 넣고 `lib/kride/artistImages.ts` 화이트리스트에 파일명을 추가하면 자동으로 표시된다.
- **SDUI 그룹(아티스트 목록) 자체의 로딩/실패 안내**: DynamicEngine 리피터 수준 변경이 필요해 보류. 화면 전체 Skeleton/오류 패널까지만 적용.
- **언어 채팅 "한국어 설명 접기"**: 스트리밍 텍스트에서 설명 구간을 안정적으로 나눌 수 없어 보류.
- **내 목록 탭 카운트**: 방문하지 않은 탭은 숫자 없이 표시된다(추가 요청으로 기존 테스트의 fetch 순서가 깨지지 않도록). 카운트 전용 API 가 생기면 3개 동시 표시로 바꾸면 된다.
- **회원 탈퇴**: 서버 `/api/auth/non-user` 는 이메일 재입력이 필요한 흐름이라 화면은 "회원 탈퇴 문의" 링크로만 분리했다.
- **DB 마이그레이션 V123·V124**: `ui_metadata`/`query_master` 행 수정만(DDL 없음). 배포 후 Redis 화면 캐시 갱신이 필요하다.
- **375px·실화면**: 브라우저로 열어 보지 않았다. `npm run dev` 후 6개 화면을 §5 표 9번 기준으로 확인하면 된다.
