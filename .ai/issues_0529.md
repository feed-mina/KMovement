# 미해결 이슈 — 2026-05-29

## 범위
구글 캘린더 OAuth 연동 + BTS 광화문 이벤트 프로젝트 점검

---

## 1. 구글 캘린더 OAuth — redirect_uri_mismatch

### 현상
- **페이지**: https://yerin.duckdns.org/view/SET_TIME_PAGE → "구글 캘린더 연결하기"
- **에러**: `400 오류: redirect_uri_mismatch` — "액세스 차단됨: 이 앱의 요청이 잘못되었습니다"

### 원인
앱이 보내는 `redirect_uri`와 Google Cloud Console에 등록된 **승인된 리디렉션 URI**가 불일치

| 항목 | 값 |
|------|-----|
| 앱 설정 (`application.yml`) | `${GOOGLE_REDIRECT_URI:https://yerin.duckdns.org/view/GOOGLE_CALLBACK}` |
| 백엔드 콜백 엔드포인트 | `GET /api/google/callback` (GoogleOAuthController.java) |
| OAuth 흐름 | Google → 프론트 `/view/GOOGLE_CALLBACK` → code 추출 → 백엔드 `/api/google/callback` 전달 |

### 관련 파일
| 파일 | 역할 |
|------|------|
| `SDUI-server/.../google/controller/GoogleOAuthController.java` | OAuth 콜백 처리 (`/api/google/callback`) |
| `SDUI-server/.../google/service/GoogleOAuthService.java` | `buildAuthorizationUrl()` — redirect_uri 포함 |
| `SDUI-server/src/main/resources/application.yml:92-94` | `google.oauth.*` 설정 |
| `metadata-project/app/view/[...slug]/page.tsx:59-66` | `GOOGLE_CALLBACK` 스크린 — code → 백엔드 전달 |
| `metadata-project/components/constants/screenMap.ts:21` | `/GOOGLE_CALLBACK` 스크린 매핑 |

### 해결 방법
**Google Cloud Console 설정 변경 (코드 수정 불필요)**

1. [Google Cloud Console](https://console.cloud.google.com) → **API 및 서비스** → **사용자 인증 정보**
2. OAuth 2.0 클라이언트 ID 선택
3. **승인된 리디렉션 URI**에 추가:
   ```
   https://yerin.duckdns.org/view/GOOGLE_CALLBACK
   ```
4. 저장 (반영까지 최대 5분)

### 우선순위: HIGH
- 시간 설정 기능의 핵심 연동
- 코드 변경 없이 Google Console 설정만으로 해결 가능

---

## 2. BTS 광화문 이벤트 프로젝트 점검

### 개요
`subproject/SDUI/bts-event/` — BTS 2026 광화문 이벤트 전용 Next.js 앱
- **배포**: https://bts-gwanghwamun.vercel.app
- **백엔드**: EC2 (`yerin.duckdns.org`) Spring Boot API 연동

### 2-1. 프론트엔드 컴포넌트 현황

| 카테고리 | 컴포넌트 | 파일 |
|---------|---------|------|
| 지도 | 카카오맵 | `components/Map/KakaoMap.tsx` |
| 지도 | Leaflet맵 | `components/Map/LeafletMap.tsx` (143줄) |
| 지도 | 레이어 필터 | `components/Map/LayerFilter.tsx` (☕🔋🏥🚇) |
| AI 채팅 | 게스트 채팅 | `components/Chat/GuestChat.tsx` (5회 제한, KO/EN/JA) |
| 커뮤니티 | 팬 보드 | `components/Board/FanBoard.tsx` |
| 커뮤니티 | 포스트 카드 | `components/Board/PostCard.tsx` |
| 커뮤니티 | 작성 모달 | `components/Board/WriteModal.tsx` |
| 커뮤니티 | 댓글 | `components/Board/CommentSection.tsx` |
| 이벤트 | 응원 모드 | `components/CheerMode.tsx` |
| 이벤트 | 라이브 PIP | `components/LivePip.tsx` |
| 상태 | 날씨/교통 | `components/StatusCard.tsx` (220줄) |
| 안내 | 교통 공지 | `components/NoticeModal.tsx` (272줄) |
| 안내 | 정보 패널 | `components/InfoPanel.tsx` (CCTV/TOPIS) |
| 안내 | 막차 안내 | `components/LastTrainModal.tsx` |
| 공유 | 카카오톡 | `components/Share/KakaoShare.tsx` |
| 공유 | LINE | `components/Share/LineShare.tsx` |
| 후원 | 후원 모달 | `components/SupportModal.tsx` (74줄) |
| 다국어 | 언어 전환 | `components/LangToggle.tsx` (KO/EN/JA) |
| SDUI 엔진 | DynamicEngine | `engine/DynamicEngine.tsx` (225줄) |
| SDUI 엔진 | 컴포넌트 맵 | `engine/componentMap.tsx` (17개 등록) |
| SDUI 엔진 | 메타데이터 | `engine/MetadataProvider.tsx` |

### 2-2. 백엔드 연동

| 파일 | 역할 |
|------|------|
| `ChatService.java:62` | AI Gwanghwamun Guide 시스템 프롬프트 + `createGuestReply(message, lang)` |
| `V36__add_bts_event_screen.sql` | `BTS_EVENT_MAIN` 스크린 메타데이터 (424줄, 17개 컴포넌트) |
| `SecurityConfig.java` | CORS 허용 목록에 `bts-gwanghwamun.vercel.app` 포함 |

### 2-3. 확인 필요 이슈

#### G1 — CORS 설정 확인
- **현재**: `SecurityConfig.java`에 `bts-gwanghwamun.vercel.app` 등록 확인 필요
- **확인**: Vercel 배포 후 API 호출이 정상 동작하는지 테스트
- **우선순위**: HIGH

#### G2 — 게스트 채팅 API 연결 확인
- **엔드포인트**: `POST /api/ai/guest/chat`
- **현재**: `bts-event/lib/api.ts` → `NEXT_PUBLIC_API_BASE` (EC2 백엔드)
- **확인**: Vercel → EC2 API 호출 시 인증/CORS 문제 없는지 테스트
- **관련**: `SecurityConfig.java`에서 `/api/ai/guest/**`는 `permitAll()` 설정
- **우선순위**: HIGH

#### G3 — 채팅 초과 시 리다이렉트 URL
- **현재**: `GuestChat.tsx:22-26`에서 5회 초과 시 SDUI 앱으로 리다이렉트
  ```
  https://yerin.duckdns.org/view/AI_ENGLISH_CHAT_PAGE
  https://yerin.duckdns.org/view/AI_JAPANESE_CHAT_PAGE
  https://yerin.duckdns.org/view/AI_KOREAN_CHAT_PAGE
  ```
- **확인**: `yerin.duckdns.org` → 현재 운영 URL(`yerin.duckdns.org`)로 변경 필요 여부
- **우선순위**: MEDIUM

#### G4 — Vercel 환경변수 설정
- **필요 환경변수**:
  - `NEXT_PUBLIC_KAKAO_APP_KEY` — 카카오맵 SDK 키
  - `NEXT_PUBLIC_API_BASE` — 백엔드 URL (`https://yerin.duckdns.org`)
- **확인**: Vercel 프로젝트 Settings에서 올바른 값 설정 여부
- **우선순위**: HIGH

#### G5 — 백엔드 Docker 이미지 미빌드
- **현재**: `ec2-fix-frontend.yml` 워크플로우는 프론트엔드만 빌드, 백엔드는 기존 이미지 pull
- **영향**: 코드 리뷰 수정분(B1~B7, K1~K6)이 백엔드에 미반영
- **해결**: `Deploy K-Ride services to EC2` 워크플로우 실행 필요 (`workflow_dispatch`)
- **우선순위**: CRITICAL

#### G6 — 카카오톡 공유 OG 이미지
- **현재**: `KakaoShare.tsx:31-42`에서 OG 이미지 URL 하드코딩
- **확인**: OG 이미지 URL이 유효한지, Kakao 개발자 도구에서 캐시 갱신 필요 여부
- **우선순위**: LOW

---

## 우선순위 정리

### CRITICAL
| # | 이슈 | 조치 |
|---|------|------|
| G5 | 백엔드 Docker 이미지 미빌드 | `Deploy K-Ride services to EC2` 워크플로우 실행 |

### HIGH
| # | 이슈 | 조치 |
|---|------|------|
| 구글 캘린더 | redirect_uri_mismatch | Google Cloud Console에 리디렉션 URI 추가 |
| G1 | BTS CORS 설정 확인 | SecurityConfig CORS 목록 검증 |
| G2 | 게스트 채팅 API 연결 | Vercel → EC2 API 호출 테스트 |
| G4 | Vercel 환경변수 | `NEXT_PUBLIC_API_BASE` 등 확인 |

### MEDIUM
| # | 이슈 | 조치 |
|---|------|------|
| G3 | 채팅 리다이렉트 URL | `yerin.duckdns.org` → 운영 URL 변경 검토 |

### LOW
| # | 이슈 | 조치 |
|---|------|------|
| G6 | 카카오톡 공유 OG 이미지 | URL 유효성 + 캐시 갱신 확인 |

---

## 참조 문서
- `.ai/code_review_0527.md` — 코드 리뷰 전체 이슈 (K1~K6, F1~F7, B1~B7) **[수정 완료]**
- `.ai/feature/bts-event/plan.md` — BTS 이벤트 아키텍처 설계 (472줄)
- `.ai/feature/bts-event/issues.md` — BTS 이벤트 기존 이슈 트래킹 (187줄)
