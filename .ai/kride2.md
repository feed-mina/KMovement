                                                                                          │ Plan to implement                                                                                                                                          │
│                                                                                                                                                            │
│ 계획: 가이드 문서 DB 업데이트 + 페이지 버그 수정 + 프론트엔드 통합 테스트                                                                                  │
│                                                                                                                                                            │
│ Context                                                                                                                                                    │
│                                                                                                                                                            │
│ K-Ride MSA 3-서비스 구조에서 DB가 4개(PostgreSQL/Neo4j/Supabase/ChromaDB)로 역할이                                                                         │
│ 분리되어 있다. 이 구조를 가이드 문서에 반영하고, pages에 존재하는 런타임 버그를                                                                            │
│ 수정한 뒤 FastAPI ↔ Next.js 통합 테스트를 작성한다.                                                                                                        │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ DB 역할 분리 (핵심 전제)                                                                                                                                   │
│                                                                                                                                                            │
│ ┌────────────┬───────────────────┬──────────────────┬─────────────────────────────────────────┐                                                            │
│ │     DB     │       위치        │    접근 주체     │                  용도                   │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ PostgreSQL │ AWS EC2           │ Spring Boot 전용 │ users, ui_metadata, query_master        │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ Neo4j Aura │ Cloud             │ FastAPI 전용     │ Region/POI/Artist 그래프                │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ Supabase   │ Cloud             │ FastAPI 전용     │ artist, poi, artist_poi 테이블 + 이미지 │                                                            │
│ ├────────────┼───────────────────┼──────────────────┼─────────────────────────────────────────┤                                                            │
│ │ ChromaDB   │ FastAPI 서버 로컬 │ FastAPI 전용     │ POI 임베딩 4컬렉션                      │                                                            │
│ └────────────┴───────────────────┴──────────────────┴─────────────────────────────────────────┘                                                            │
│                                                                                                                                                            │
│ Next.js(Vercel)는 DB에 직접 접근하지 않고 API만 호출한다.                                                                                                  │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 1단계: 가이드 문서 업데이트                                                                                                                                │
│                                                                                                                                                            │
│ 파일: D:/kride-project/.ai/fastapi_rag_llm_guide.md                                                                                                        │
│                                                                                                                                                            │
│ 섹션 0 (MSA 폴더 구조) 내 "각 서비스 역할 요약" 표 바로 아래에                                                                                             │
│ "DB 역할 분리" 섹션 삽입:                                                                                                                                  │
│                                                                                                                                                            │
│ ### DB 역할 분리 (혼동 금지)                                                                                                                               │
│                                                                                                                                                            │
│ | DB | 위치 | 접근 주체 | 테이블/노드 |                                                                                                                    │
│ |----|------|----------|------------|                                                                                                                      │
│ | PostgreSQL | AWS EC2 | Spring Boot 전용 | users, ui_metadata, query_master |                                                                             │
│ | Neo4j Aura | Cloud | FastAPI 전용 | Region, POI, Artist, 관계 |                                                                                          │
│ | Supabase | Cloud | FastAPI 전용 | artist, poi, artist_poi, 이미지 |                                                                                      │
│ | ChromaDB | FastAPI 서버 로컬 | FastAPI 전용 | POI 임베딩 4컬렉션 |                                                                                       │
│                                                                                                                                                            │
│ > Next.js(Vercel)는 DB에 직접 접근하지 않는다.                                                                                                             │
│ > Spring Boot가 PostgreSQL을 읽어 ui_metadata를 내려주고,                                                                                                  │
│ > FastAPI가 Neo4j/Supabase/ChromaDB를 읽어 AI 추천을 내려준다.                                                                                             │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 2단계: 페이지 버그 수정 (통합 테스트 전제 조건)                                                                                                            │
│                                                                                                                                                            │
│ 모든 파일 경로: D:/kride-project/subproject/SDUI/kride/                                                                                                    │
│                                                                                                                                                            │
│ movies/page.tsx                                                                                                                                            │
│                                                                                                                                                            │
│ - 버그 1: useQuery import 누락 → import { useQuery } from "@tanstack/react-query" 추가                                                                     │
│ - 버그 2: line 39 ARTIST_LIST undefined → [] 로 교체                                                                                                       │
│ - 버그 3: line 57 pageData={{ artistList: ARTIST_LIST }} → pageData={{ artistList: artistList }}                                                           │
│                                                                                                                                                            │
│ latest/page.tsx                                                                                                                                            │
│                                                                                                                                                            │
│ - 버그 1: useQuery import 누락 → 추가                                                                                                                      │
│ - 버그 2: line 29 REGION_LIST undefined → [] 로 교체                                                                                                       │
│ - 버그 3: line 47 pageData={{ regionList: REGION_LIST }} → pageData={{ regionList: regionList }}                                                           │
│                                                                                                                                                            │
│ focus/page.tsx                                                                                                                                             │
│                                                                                                                                                            │
│ - 버그 1: useQuery import 누락 → 추가                                                                                                                      │
│ - 버그 2: isLoading 중복 선언 → line 65 것을 isItineraryLoading, line 82 것을 isMetaLoading                                                                │
│ - 버그 3: MOCK_ITINERARY[safeDuration] undefined → data?.itinerary ?? []                                                                                   │
│ - 버그 4: MAP_MARKERS undefined → data?.mapData?.markers ?? []                                                                                             │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 3단계: Jest 설정 보완                                                                                                                                      │
│                                                                                                                                                            │
│ 파일: D:/kride-project/subproject/SDUI/kride/jest.config.ts                                                                                                │
│                                                                                                                                                            │
│ moduleNameMapper에 추가:                                                                                                                                   │
│ "^next/navigation$": "<rootDir>/src/__tests__/__mocks__/next-navigation.ts",                                                                               │
│ "^next/dynamic$":    "<rootDir>/src/__tests__/__mocks__/next-dynamic.ts",                                                                                  │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 4단계: Mock 파일 신규 생성                                                                                                                                 │
│                                                                                                                                                            │
│ src/__tests__/__mocks__/next-navigation.ts                                                                                                                 │
│ export const useRouter = () => ({ push: jest.fn(), replace: jest.fn() });                                                                                  │
│ export const usePathname = () => "/";                                                                                                                      │
│ export const useSearchParams = () => new URLSearchParams();                                                                                                │
│                                                                                                                                                            │
│ src/__tests__/__mocks__/next-dynamic.ts                                                                                                                    │
│ const dynamic = (_fn: any, _opts?: any) => {                                                                                                               │
│   const Comp = () => null;                                                                                                                                 │
│   Comp.displayName = "DynamicMock";                                                                                                                        │
│   return Comp;                                                                                                                                             │
│ };                                                                                                                                                         │
│ export default dynamic;                                                                                                                                    │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 5단계: 통합 테스트 파일 3개 생성                                                                                                                           │
│                                                                                                                                                            │
│ 테스트 전략                                                                                                                                                │
│                                                                                                                                                            │
│ - fetch mock: jest.fn() — URL별로 분기해서 SDUI API / FastAPI 응답 구분                                                                                    │
│   - /api/ui/* → { data: [] } (SDUI 메타데이터 없음 → fallback UI)                                                                                          │
│   - */api/artists → { artists: [...] } (FastAPI)                                                                                                           │
│   - */api/regions → { regions: [...] } (FastAPI)                                                                                                           │
│   - */api/recommend/itinerary → { itinerary: [...], mapData: {...} } (FastAPI)                                                                             │
│ - QueryClientProvider 래퍼로 각 테스트 격리                                                                                                                │
│ - Zustand store: useOnboardingStore.setState() 로 초기값 설정                                                                                              │
│                                                                                                                                                            │
│ src/__tests__/integration/movies-page.test.tsx                                                                                                             │
│                                                                                                                                                            │
│ 테스트 항목:                                                                                                                                               │
│ 1. FastAPI /api/artists 응답 → 아티스트 이름 렌더링                                                                                                        │
│ 2. 아티스트 0개 선택 시 "다음 →" 버튼 disabled                                                                                                             │
│ 3. fetch가 올바른 FastAPI URL로 호출됨                                                                                                                     │
│                                                                                                                                                            │
│ src/__tests__/integration/latest-page.test.tsx                                                                                                             │
│                                                                                                                                                            │
│ 테스트 항목:                                                                                                                                               │
│ 1. FastAPI /api/regions 응답 → 지역 이름 렌더링                                                                                                            │
│ 2. 지역 0개 선택 시 "다음 →" 버튼 disabled                                                                                                                 │
│ 3. fetch가 올바른 FastAPI URL로 호출됨                                                                                                                     │
│                                                                                                                                                            │
│ src/__tests__/integration/focus-page.test.tsx                                                                                                              │
│                                                                                                                                                            │
│ 테스트 항목:                                                                                                                                               │
│ 1. duration=null → /browse redirect                                                                                                                        │
│ 2. isItineraryLoading=true → "일정 생성 중..." 텍스트                                                                                                      │
│ 3. FastAPI /api/recommend/itinerary 응답 → ItineraryPanel 렌더링                                                                                           │
│ 4. fetch POST body에 store 값(duration/artists/regions)이 포함됨                                                                                           │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 수정/생성 파일 목록 (총 10개)                                                                                                                              │
│                                                                                                                                                            │
│ ┌──────────────────────────────────┬───────────────────────────┬─────────────────────────────────────────────┐                                             │
│ │               파일               │           작업            │                    위치                     │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ fastapi_rag_llm_guide.md         │ DB 분리 섹션 추가         │ D:/kride-project/.ai/                       │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ movies/page.tsx                  │ 버그 3개 수정             │ subproject/SDUI/kride/src/app/(afterLogin)/ │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ latest/page.tsx                  │ 버그 3개 수정             │ 동일                                        │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ focus/page.tsx                   │ 버그 4개 수정             │ 동일                                        │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ jest.config.ts                   │ moduleNameMapper 2개 추가 │ subproject/SDUI/kride/                      │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ __mocks__/next-navigation.ts     │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ __mocks__/next-dynamic.ts        │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ integration/movies-page.test.tsx │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ integration/latest-page.test.tsx │ 신규                      │ src/__tests__/                              │                                             │
│ ├──────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────┤                                             │
│ │ integration/focus-page.test.tsx  │ 신규                      │ src/__tests__/                              │                                             │
│ └──────────────────────────────────┴───────────────────────────┴─────────────────────────────────────────────┘                                             │
│                                                                                                                                                            │
│ ---                                                                                                                                                        │
│ 실행 검증                                                                                                                                                  │
│                                                                                                                                                            │
│ cd D:/kride-project/subproject/SDUI/kride                                                                                                                  │
│                                                                                                                                                            │
│ # 통합 테스트만 실행                                                                                                                                       │
│ npx jest src/__tests__/integration/ --verbose                                                                                                              │
│                                                                                                                                                            │
│ # 전체 테스트 실행                                                                                                                                         │
│ npm test                                                                                                                                                   │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

● 먼저 관련 파일들을 읽겠습니다.      
  1단계: 가이드 문서                                                                                                                                                                                                                                                                                                        
  - .ai/fastapi_rag_llm_guide.md — "각 서비스 역할 요약" 표 바로 아래 DB 역할 분리 섹션 삽입                                                                                                                                                                                                                                  2단계: 페이지 버그 수정                                                                                                                                     

  ┌─────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  
  │      파일       │                                                              수정 내용                                                               │  
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ movies/page.tsx │ useQuery import 추가 / ARTIST_LIST → [] / ARTIST_LIST → artistList                                                                   │  
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ latest/page.tsx │ useQuery import 추가 / REGION_LIST → [] / REGION_LIST → regionList                                                                   │  
  ├─────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
  │ focus/page.tsx  │ useQuery import 추가 / isLoading 중복 → isItineraryLoading/isMetaLoading / MOCK_ITINERARY[...] → data?.itinerary ?? [] / MAP_MARKERS │  
  │                 │  → data?.mapData?.markers ?? []                                                                                                      │  
  └─────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  

  3단계: Jest 설정

  - jest.config.ts — next/navigation, next/dynamic mapper 추가

  4단계: Mock 파일

  - __mocks__/next-navigation.ts — useRouter, usePathname, useSearchParams
  - __mocks__/next-dynamic.ts — dynamic() stub

  5단계: 통합 테스트

  - integration/movies-page.test.tsx — 3개 테스트 (artists 렌더링 / disabled 버튼 / fetch URL)
  - integration/latest-page.test.tsx — 3개 테스트 (regions 렌더링 / disabled 버튼 / fetch URL)
  - integration/focus-page.test.tsx — 4개 테스트 (redirect / loading 텍스트 / ItineraryPanel / POST body)

  실행 명령

  cd D:/kride-project/subproject/SDUI/kride
  npx jest src/__tests__/integration/ --verbose
  
  
  ⎿  Wrote 273 lines to src\api\test_contract.py
     """
     test_contract.py
     ================
     FastAPI ↔ Spring Boot 계약(Contract) 테스트

     두 서버가 모두 실행 중일 때 실행하는 E2E 스타일 테스트.
     각 서버의 응답 스키마가 Next.js 프론트엔드가 기대하는 형태와 일치하는지 검증.

     사전 조건:
       - FastAPI  포트 8000 실행: uvicorn src.api.fastapi_server:app --port 8000
     … +263 lines (ctrl+o to expand)

● 완료됐습니다. 구조와 실행 방법을 정리합니다.

  ---
  생성된 테스트 파일 3개

  아키텍처 전제

  FastAPI ↔ Spring Boot는 직접 통신하지 않습니다. Next.js가 각각 독립적으로 호출합니다.

  Next.js → /api/*  ──proxy──▶  Spring Boot :8080  (UI 메타데이터)
  Next.js → ${KRIDE_API_BASE}/api/*  ──▶  FastAPI :8000  (AI 추천)

  그래서 "연결 테스트"는 3계층으로 구성했습니다.

  ---
  1. FastAPI 단독 테스트 (src/api/test_fastapi.py)

  - TestClient 사용 — 서버 실행 없이 실행 가능
  - Neo4j/Supabase/ChromaDB/Groq 전부 stub으로 대체
  - health / artists / regions / itinerary / recommend_ai 5개 엔드포인트, 총 18개 테스트

  cd D:/kride-project
  pytest src/api/test_fastapi.py -v

  ---
  2. Spring Boot UiController 테스트 (...domain/ui/controller/UiControllerOnboardingTest.java)

  - @MockBean UiService — DB 없이 실행 가능
  - INTRO2 (아티스트 화면) / INTRO3 (지역 화면) / FOCUS (일정 화면) 검증
  - Next.js DynamicEngine 필수 필드(componentId, componentType, sortOrder) 스키마 체크
  - 총 12개 테스트

  cd D:/kride-project/subproject/SDUI/SDUI-server
  ./gradlew test --tests "UiControllerOnboardingTest"

  ---
  3. Cross-service 계약 테스트 (src/api/test_contract.py)

  - 두 서버가 모두 실행 중일 때만 동작 (꺼져 있으면 자동 skip)
  - 온보딩 3페이지 플로우 전체 검증: movies / latest / focus
  - 응답 스키마가 Next.js가 기대하는 형태와 일치하는지 확인

  # 두 서버 실행 후:
  cd D:/kride-project
  pytest src/api/test_contract.py -v -m contract

✻ Crunched for 9m 29s

───────────────────────────────────────────────────────────────────────────────────

● Cross-service 계약 테스트 (두 서버 모두 실행 중일 때)

● Write(src\api\test_contract.py)
  ⎿  Wrote 273 lines to src\api\test_contract.py
     """
     test_contract.py
     ================
     FastAPI ↔ Spring Boot 계약(Contract) 테스트

     두 서버가 모두 실행 중일 때 실행하는 E2E 스타일 테스트.
     각 서버의 응답 스키마가 Next.js 프론트엔드가 기대하는 형태와 일치하는지 검증.

     사전 조건:
       - FastAPI  포트 8000 실행: uvicorn src.api.fastapi_server:app --port 8000
     … +263 lines (ctrl+o to expand)

● 완료됐습니다. 구조와 실행 방법을 정리합니다.

  ---
  생성된 테스트 파일 3개

  아키텍처 전제

  FastAPI ↔ Spring Boot는 직접 통신하지 않습니다. Next.js가 각각 독립적으로 호출합니다.

  Next.js → /api/*  ──proxy──▶  Spring Boot :8080  (UI 메타데이터)
  Next.js → ${KRIDE_API_BASE}/api/*  ──▶  FastAPI :8000  (AI 추천)

  그래서 "연결 테스트"는 3계층으로 구성했습니다.

  ---
  1. FastAPI 단독 테스트 (src/api/test_fastapi.py)

  - TestClient 사용 — 서버 실행 없이 실행 가능
  - Neo4j/Supabase/ChromaDB/Groq 전부 stub으로 대체
  - health / artists / regions / itinerary / recommend_ai 5개 엔드포인트, 총 18개 테스트

  cd D:/kride-project
  pytest src/api/test_fastapi.py -v

  ---
  2. Spring Boot UiController 테스트 (...domain/ui/controller/UiControllerOnboardingTest.java)

  - @MockBean UiService — DB 없이 실행 가능
  - INTRO2 (아티스트 화면) / INTRO3 (지역 화면) / FOCUS (일정 화면) 검증
  - Next.js DynamicEngine 필수 필드(componentId, componentType, sortOrder) 스키마 체크
  - 총 12개 테스트

  cd D:/kride-project/subproject/SDUI/SDUI-server
  ./gradlew test --tests "UiControllerOnboardingTest"

  ---
  3. Cross-service 계약 테스트 (src/api/test_contract.py)

  - 두 서버가 모두 실행 중일 때만 동작 (꺼져 있으면 자동 skip)
  - 온보딩 3페이지 플로우 전체 검증: movies / latest / focus
  - 응답 스키마가 Next.js가 기대하는 형태와 일치하는지 확인

  # 두 서버 실행 후:
  cd D:/kride-project
  pytest src/api/test_contract.py -v -m contract

 uvicorn src.api.fastapi_server:app --port 8000
터미널 창을 하나 더 열어 uvicorn src.api.fastapi_server:app --port 8000 (또는 해당 프로젝트의 FastAPI 실행 명령)을 실행하여 FastAPI 서버를 켜주세요.
Spring Boot가 바라보는 DB에 UI 메타데이터(INTRO2 등)를 채워 넣어주세요.
그 후 다시 pytest 명령어를 실행하면 모든 테스트가 PASSED 되는 것을 확인하실 수 있습니다!

 
J

의존성 문제를 해결하기 위한 라이브러리 재설치 코드
작성해줘

---

## metadata-project 페이지 경로 구조 (2026-05-15 조회)

**위치:** `subproject/SDUI/metadata-project/app/`

```
app/
├── api/
│   ├── auth/
│   │   └── update-profile/      # 프로필 업데이트 API Route
│   └── kakao/
│       └── callback/            # Kakao OAuth 콜백 처리
├── view/
│   └── [...slug]/               # 모든 화면의 단일 진입점 (CommonPage)
│       └── page.tsx
├── styles/                      # CSS 파일
├── type/                        # TypeScript 타입 정의
├── layout.tsx                   # Root 레이아웃
└── globals.css
```

**라우팅 전략:**
- 모든 화면은 `/view/[screenId]` 단일 경로를 통해 진입
- `next.config.ts`에서 `/` → `/view/MAIN_PAGE` redirect 설정
- `screenId`를 기반으로 Spring Boot `/api/ui/{screenId}` 호출 → DB에서 메타데이터 조회
- `DynamicEngine`이 메타데이터를 해석해 화면을 동적 렌더링

**주요 screen_id 목록 (SDUI-server 테스트 기준):**
- `MAIN_PAGE` — 메인 화면
- `LOGIN_PAGE` — 로그인
- `INTRO2` — 온보딩: 아티스트 선택
- `INTRO3` — 온보딩: 지역 선택
- `FOCUS` — 온보딩: 일정 생성

