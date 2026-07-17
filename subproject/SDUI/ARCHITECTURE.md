# K-RIDE SDUI — 아키텍처 문서

> 서버 주도 UI(Server-Driven UI) 시스템의 **아키텍처 다이어그램 · ERD · 렌더링 플로우 · 기술 스택**을 한곳에 정리한 문서입니다.
> 개요·기능 설명은 [README.md](README.md)를 참고하세요.

구성 요소:

| 레이어 | 위치 | 스택 |
|--------|------|------|
| 백엔드 | `SDUI-server/` | Spring Boot 3 (Java 17) |
| 웹 프론트 | `metadata-project/`, `kride/` | Next.js 14 (React 18) |
| 모바일 | `kride/apps/mobile/` | Expo 51 (React Native 0.74) |
| 공유 엔진 | `kride/packages/core/` | 플랫폼 중립 SDUI 엔진 (웹·모바일 공유) |
| AI 챗봇 | 외부 FastAPI | RAG + LLM (`kridechat` 도메인이 프록시) |

---

## 1. 시스템 아키텍처 다이어그램

```mermaid
graph TB
    subgraph Clients["클라이언트"]
        Web["웹 (Next.js)<br/>metadata-project · kride"]
        Mobile["모바일 (Expo / React Native)<br/>kride/apps/mobile"]
    end

    subgraph Shared["공유 SDUI 엔진 — @kride/core"]
        Engine["DynamicEngine<br/>트리 순회 · Repeater · visibility · modal"]
        Prim["Primitive 계약<br/>Box / Txt / Btn"]
        Hooks["hooks · store<br/>usePageHook · useUiScreen · zustand"]
    end

    Web -->|webPrimitives + web componentMap| Engine
    Mobile -->|rnPrimitives + mobile componentMap| Engine
    Engine --- Prim
    Engine --- Hooks

    subgraph Backend["백엔드 — SDUI-server (Spring Boot 3)"]
        UiCtl["UiController → UiService<br/>flat rows → 재귀 트리"]
        QuerySvc["QueryMasterService<br/>동적 SQL 실행"]
        Auth["AuthController · KakaoController<br/>JWT · OAuth2"]
        Community["community 도메인<br/>게시글 · 좋아요 · 신고 · 팔로우"]
        Chat["kridechat 도메인<br/>FastAPI 프록시 · SSE"]
    end

    Web -->|"GET /api/ui/{screenId}"| UiCtl
    Mobile -->|"GET /api/ui/{screenId}"| UiCtl
    Web -->|"/api/v1/community/**"| Community
    Web -->|"/api/v1/kride/chat/** (SSE)"| Chat

    subgraph Data["데이터 계층"]
        Redis[("Redis<br/>UI 트리 · SQL 캐시 (TTL 1hr)")]
        PG[("PostgreSQL<br/>ui_metadata · query_master · users · community")]
    end

    UiCtl --> Redis
    UiCtl --> PG
    QuerySvc --> Redis
    QuerySvc --> PG
    Auth --> PG
    Community --> PG

    subgraph External["외부 서비스"]
        FastAPI["FastAPI<br/>RAG + LLM (GPT-4o)"]
        Kakao["Kakao OAuth · 알림"]
        S3["AWS S3 · Supabase<br/>이미지 스토리지"]
        Firebase["Firebase<br/>푸시 알림"]
    end

    Chat -->|SSE 스트리밍| FastAPI
    Auth --> Kakao
    Community --> S3
    Backend --> Firebase
```

---

## 2. ERD (Entity Relationship Diagram)

> SDUI 메타데이터 테이블(`ui_metadata` / `query_master`)과 도메인 테이블(users, community 등)의 관계입니다.
> 실제 스키마는 `SDUI-server/src/main/resources/db/migration/V*.sql` (Flyway)에서 관리됩니다.

```mermaid
erDiagram
    ui_metadata {
        bigserial ui_id PK
        varchar   screen_id "화면 식별 키"
        varchar   component_id
        varchar   component_type "React 컴포넌트 매핑"
        varchar   label_text
        int       sort_order
        varchar   ref_data_id "데이터 바인딩 키"
        varchar   data_sql_key FK "→ query_master.sql_key"
        varchar   group_id
        varchar   parent_group_id "자식 트리 계층"
        varchar   group_direction "ROW / COLUMN"
        varchar   action_type "액션 핸들러 라우팅"
        varchar   css_class
        varchar   is_visible
    }
    query_master {
        varchar sql_key PK
        text    query_text "실행 SQL (:param 바인딩)"
        varchar return_type
        varchar required_role "RBAC (V15)"
        varchar description
    }
    users {
        bigserial user_sqno PK
        varchar   user_id
        varchar   role "GUEST / USER / ADMIN / PREMIUM"
        varchar   email
        varchar   social_type "kakao 등"
        varchar   verify_yn
        varchar   del_yn
    }
    content {
        bigserial content_id PK
        bigint    user_sqno FK
        varchar   title
    }
    diary {
        bigserial diary_id PK
        bigint    user_sqno FK
        jsonb     selected_times
        jsonb     daily_slots
    }
    community_post {
        bigserial post_id PK
        bigint    author_sqno FK "→ users"
        varchar   title
        text      content
        bigint    like_count
        bigint    report_count
        varchar   del_yn
    }
    post_image {
        bigserial post_image_id PK
        bigint    post_id FK
        varchar   storage_url
        int       sort_order
    }
    post_like {
        bigserial post_like_id PK
        bigint    post_id FK
        bigint    user_sqno FK
    }
    post_report {
        bigserial post_report_id PK
        bigint    post_id FK
        bigint    reporter_sqno FK
        varchar   reason_code
    }
    user_follow {
        bigserial follow_id PK
        bigint    follower_sqno FK
        bigint    followee_sqno FK
    }

    ui_metadata }o--|| query_master : "data_sql_key → sql_key"
    ui_metadata ||--o{ ui_metadata : "parent_group_id (self)"
    users ||--o{ content : writes
    users ||--o{ diary : writes
    users ||--o{ community_post : authors
    community_post ||--o{ post_image : has
    community_post ||--o{ post_like : receives
    community_post ||--o{ post_report : receives
    users ||--o{ post_like : gives
    users ||--o{ post_report : files
    users ||--o{ user_follow : "follows (follower/followee)"
```

> **별도 DB (FastAPI / Supabase)** — `user_route_history`, `bicycle_paths`, `bicycle_routes`(PostGIS)는 AI 라우팅용 Supabase DB에 있으며 Flyway가 아닌 별도로 관리됩니다. (`db_schema.sql` 참고)

---

## 3. SDUI 렌더링 플로우

### 3-1. 메타데이터 → 화면 렌더링 파이프라인

```mermaid
sequenceDiagram
    participant C as 클라이언트 (웹/모바일)
    participant P as MetadataProvider / useUiScreen
    participant S as Spring UiController
    participant R as Redis (TTL 1hr)
    participant DB as PostgreSQL

    C->>P: URL 진입 (screenId)
    P->>S: GET /api/ui/{rolePrefix}_{screenId}
    S->>R: 캐시 조회
    alt Cache Hit
        R-->>S: UI 트리 반환
    else Cache Miss
        S->>DB: ui_metadata 조회 (역할 필터링)
        DB-->>S: flat rows
        S->>S: flat rows → 재귀 트리 변환
        S->>R: TTL 1hr 캐시 저장
    end
    S-->>P: UI 트리 JSON
    P->>C: @kride/core DynamicEngine 렌더링
    Note over C: componentMap 매핑 + ref_data_id 데이터 바인딩<br/>웹=webPrimitives · 모바일=rnPrimitives
```

### 3-2. 컴포넌트 순회 & 액션 라우팅 (엔진 내부)

```mermaid
flowchart TD
    Start["DynamicEngine: 메타데이터 트리"] --> Node{"노드 타입?"}
    Node -->|group + ref_data_id 배열| Repeat["Repeater<br/>배열 요소 수만큼 복제"]
    Node -->|group| Wrap["레이아웃 래퍼<br/>ROW / COLUMN"]
    Node -->|leaf| Map["componentMap[component_type]"]
    Repeat --> Bind
    Wrap --> Node
    Map --> Bind["데이터 바인딩<br/>formData > rowData > pageData"]
    Bind --> Vis{"is_visible?"}
    Vis -->|false| Skip["렌더 스킵"]
    Vis -->|true| Render["컴포넌트 렌더 (primitives)"]
    Render --> Evt{"이벤트 발생?"}
    Evt -->|action_type| Hook["usePageHook (액션 라우터)"]
    Hook -->|"LOGIN_SUBMIT · LOGOUT · REGISTER ..."| UA["useUserActions"]
    Hook -->|그 외| BA["useBusinessActions"]
    UA --> API["백엔드 API 호출"]
    BA --> API
```

### 3-3. 웹·모바일 공유 코어 (플랫폼 주입 구조)

```mermaid
flowchart LR
    subgraph core["@kride/core (플랫폼 중립)"]
        DE["DynamicEngine"]
        BC["createBaseComponentMap(primitives)"]
    end
    subgraph web["웹 (Next.js)"]
        WP["webPrimitives (div/span/button)"]
        WM["web componentMap"]
    end
    subgraph mob["모바일 (Expo)"]
        RP["rnPrimitives (View/Text/Pressable)"]
        RM["mobile componentMap<br/>MAP_VIEW → react-native-maps"]
    end
    WP --> DE
    WM --> DE
    RP --> DE
    RM --> DE
    DE --> BC
    Note["같은 순회·Repeater·visibility·modal 로직을<br/>웹과 모바일이 공유 — 계약은 primitives·componentMap 주입"]
```

---

## 4. 기술 스택 (Tech Stack)

### 백엔드 — `SDUI-server` (Spring Boot 3, Java 17)

| 분류 | 기술 |
|------|------|
| Core | Spring Boot 3.1.4, Spring Web / WebFlux, Spring AOP |
| 인증/인가 | Spring Security, JWT (jjwt 0.11.5), OAuth 2.0 (Kakao) |
| 데이터 접근 | Spring Data JPA, MyBatis 3.0.3, PageHelper, PostgreSQL |
| 마이그레이션 | Flyway (V1 ~ V52+) |
| 캐시 | Spring Data Redis (UI 트리 · SQL 결과 캐시) |
| 실시간 | WebSocket (STOMP), SSE (챗봇 스트리밍) |
| 외부 연동 | AWS S3 (SDK v2), Google Cloud Document AI, Firebase Admin, 나이스 SMS(nurigo), 메일 |
| 회복탄력성 | Resilience4j (서킷 브레이커) |
| 문서화 | springdoc-openapi (Swagger UI) |
| 테스트 | JUnit 5, Spring Security Test, H2, embedded-redis |

### 웹 프론트 — `metadata-project` · `kride`

| 분류 | 기술 |
|------|------|
| Core | Next.js 14 (App Router), React 18, TypeScript 5 |
| 상태 관리 | Zustand, TanStack Query (React Query) |
| 지도 | Leaflet, react-leaflet |
| 스타일 | Tailwind CSS, daisyUI |
| PWA | next-pwa (Service Worker, 홈화면 설치) |
| 테스트 | Jest + React Testing Library, Playwright (E2E), MSW |

### 모바일 — `kride/apps/mobile` (Expo)

| 분류 | 기술 |
|------|------|
| Core | Expo SDK 51, React Native 0.74, expo-router (파일 기반 라우팅) |
| 스타일 | NativeWind 4.1.x (Tailwind for RN) |
| 상태/데이터 | TanStack Query, Zustand |
| 지도 | react-native-maps |
| 저장소 | expo-secure-store, AsyncStorage |

### 공유 엔진 — `kride/packages/core`

| 분류 | 기술 |
|------|------|
| 엔진 | 플랫폼 중립 DynamicEngine · componentMap · screenMap |
| hooks | usePageHook · useUiScreen · useBusinessActions (router 어댑터 주입) |
| store | zustand (onboarding-store 등) |
| 계약 | Primitive(Box/Txt/Btn) · ComponentRegistry 주입 |

### 인프라 & DevOps

| 분류 | 기술 |
|------|------|
| 웹 배포 | Vercel |
| 백엔드 배포 | AWS EC2 + GitHub Actions |
| 로컬 인프라 | Docker Compose (PostgreSQL 5433, Redis 6379, backend 8080) |
| AI 서비스 | FastAPI (RAG + LLM), 별도 배포 |

---

_생성: SDUI 아키텍처 정리 · Mermaid 다이어그램은 GitHub에서 자동 렌더링됩니다._
