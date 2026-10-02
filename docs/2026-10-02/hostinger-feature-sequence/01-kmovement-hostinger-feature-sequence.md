# KMovement Hostinger 순차 기능 배포 지도

> 기준 시점: 2026-10-02 18:26 KST
> 분석 기준: `origin/main` `25024f4d817eaf4d0919b8c184ba86949d3195bb`
> 문서 상태: 배포 순서 확정안. 애플리케이션 코드 수정과 실제 Hostinger 배포는 이 문서 작업에 포함하지 않음.

## 한 줄 결론

현재 진행 중인 **웹 주소검색 → 주소 선택 → 좌표/지도 표시** 검증이 끝나면, KMovement의 나머지 기능은 `플랫폼 게이트 → 공개 읽기 → 인증 → 사용자 쓰기 → 커뮤니티 → 경로 계산 → AI → 비동기·고비용 작업 → 운영자 기능` 순서로 하나씩 배포한다.

각 단계는 앞 단계와 다른 `main SHA + image digest + config revision + target + rollback digest`를 갖고, 기능 증거가 없으면 다음 단계로 넘어가지 않는다.

## 범위

### 이 문서가 정하는 것

- 첫 웹 기능 다음에 배포할 KMovement 기능 순서
- 단계마다 추가되는 컨테이너·외부 의존성·비밀값의 범위
- 사용자 화면, API, 데이터, 로그, 롤백의 통과 기준
- AWS·RunPod 비용 의존 기능을 뒤로 미루는 경계

### 이 문서가 실행하지 않는 것

- Hostinger VPS 접속과 컨테이너 배포
- 운영 DNS 전환
- AWS 종료 또는 데이터 삭제
- RunPod 실행
- 애플리케이션 코드 변경
- 현재 진행 중인 웹 전용 배포 PR의 병합

## 분리 원칙

1. **한 배포에는 대표 기능 하나만 둔다.** 같은 컨테이너에 다른 코드가 있어도 외부에 열고 검증하는 기능은 하나다.
2. **플랫폼 게이트와 사용자 기능을 구분한다.** Spring·Postgres·Redis 기동은 기능 완료가 아니다.
3. **읽기 기능을 쓰기 기능보다 먼저 연다.** 데이터 손상과 인증 문제의 영향 범위를 줄인다.
4. **외부 API는 공급자별로 나눈다.** Daum/Kakao 주소, TourAPI, OAuth, FastAPI/LLM을 한 단계에 섞지 않는다.
5. **동기 요청을 비동기 작업보다 먼저 검증한다.** SSE·Celery·미디어 작업은 기본 API가 안정된 뒤 연다.
6. **고비용 경로는 마지막까지 닫아 둔다.** RunPod·영상·의상 분석은 명시적인 비용 승인 전 배포하지 않는다.
7. **날짜는 식별자가 아니다.** SHA와 digest가 일치해야 같은날 배포 묶음이다.

## 전체 진행 순서

```text
현재: 웹 주소검색
  ↓
G1 백엔드 플랫폼 게이트
  ↓
F2 모바일 주소검색
  ↓
F3 SDUI 공개 화면
  ↓
F4 전국 맛집
  ↓
F5 K-컬처 성지
  ↓
F6 K-POP 공개 카탈로그
  ↓
F7 로그인·프로필
  ↓
F8 사용자 저장 기능
  ↓
F9 성지 제보·검수
  ↓
F10 커뮤니티 읽기 → 쓰기 → 상호작용 → 운영 검수
  ↓
F11 기본 경로 계산
  ↓
F12 AI 일정 추천
  ↓
F13 KRIDE 스트리밍 챗봇
  ↓
F14 Celery 백그라운드 작업
  ↓
F15 고비용 미디어·RunPod (보류)
  ↓
F16 관리자·파트너 운영 화면
```

## 단계별 배포 계약

### F1 — 현재 병렬 작업: 웹 주소검색

- 사용자 기능: `/holy/submit`에서 주소검색 → 주소 선택 → 좌표 변환 → 지도 마커 표시
- 배포 컴포넌트: Next.js web + reverse proxy
- 외부 의존성: Daum 우편번호, Kakao Maps JavaScript API
- 제외: 제출, 로그인, Spring, DB 저장, FastAPI
- 통과 증거: 임시 HTTPS, 페이지 200, 실제 주소·좌표·마커 변화, 데스크톱/모바일 폭, 콘솔·네트워크 기록
- 실패 시: Hostinger 웹 프로젝트만 롤백하고 운영 DNS와 AWS는 유지

### G1 — Spring 플랫폼 게이트

이 단계는 기능이 아니라 이후 기능의 공통 기반이다.

- 추가 컴포넌트: Spring Boot, PostgreSQL, Redis
- 내부 검증: Flyway 적용 목록, DB/Redis health, Spring health, 비밀값 비노출, 컨테이너 재기동
- 외부 공개: health와 다음 단계에서 지정한 API만 reverse proxy allowlist로 공개
- 통과 증거: migration checksum, 핵심 테이블 건수, Redis ping, Spring health, rollback 복원
- 중단 조건: Flyway 불일치, 기본 데이터 손실, production profile의 필수 비밀값 누락

`application-prod.yml`은 datasource, Redis, JWT, Kakao, FastAPI, AWS S3, GCP 값을 함께 참조한다. 따라서 “Spring 컨테이너가 켜짐”과 “각 외부 서비스가 준비됨”을 구분해야 한다.

### F2 — 모바일 주소검색

- 사용자 기능: 모바일 주소 입력에서 키워드 검색, 결과 선택, 실패 시 직접 입력
- API: `GET /api/v1/address/search`
- 코드 경계: `AddressSearchController` → `AddressSearchService` → Kakao Local REST API
- 계약: 2자 미만 빈 결과, 최대 10건, 정상 결과의 우편번호·도로명, 외부 실패 502, REST 키 비노출
- 데이터 쓰기: 없음
- 통과 증거: 정상·빈 결과·공급자 오류·네트워크 오류·직접입력 네 경우
- 다음 단계: SDUI 공개 화면

### F3 — SDUI 공개 화면 메타데이터

- 사용자 기능: `/view/{screenId}`가 공개 화면 메타데이터를 받아 렌더링
- API: `GET /api/ui/{screenId}` 및 공개 조회에 필요한 `/api/execute/**`
- 코드 경계: `app/view/[...slug]/page.tsx` → 화면 controller registry → `UiController` → `UiService`
- 데이터: UI 메타데이터와 역할 기반 필터 결과
- 통과 증거: guest 화면 1개 로드, loading/empty/error/ready, 금지 역할 컴포넌트 미노출, 재열기 결과 동일
- 실패 시: 정적 마케팅 화면은 유지하고 `/view` 경로만 닫는다.

### F4 — 전국 맛집 공개 조회

- 사용자 기능: 지역 선택 → 음식점 목록 → 다음 페이지
- API: `/api/v1/tour/areas`, `/api/v1/tour/restaurants`, 필요 시 `/api/v1/tour/poi`
- 코드 경계: `services/tourApi.ts` → `TourController` → `TourService` → TourAPI
- 외부 의존성: `TOUR_API_KEY`
- 데이터 쓰기: 없음. 캐시는 마지막 성공 응답만 사용하고 공급자 실패와 구분한다.
- 통과 증거: 지역/시군구, 빈 결과, 페이지 이동, 공급자 오류, 캐시 fallback, 출처·이미지 표시
- 다음 단계: K-컬처 성지 공개 조회

### F5 — K-컬처 성지 공개 조회

- 사용자 기능: 지역·작품·종류 필터로 승인된 성지 조회
- API: `/api/v1/tour/holy`, `/api/v1/tour/holy/contents`
- 데이터: 승인된 DB 성지와 작품/아티스트 연결
- 통과 증거: 승인분만 노출, 필터 조합, 주소·지도 좌표, 이미지 출처, 전국 시드
- 실패 시: 맛집 단계는 유지하고 성지 탭만 숨긴다.

### F6 — K-POP 공개 카탈로그

한꺼번에 열지 않고 아래 세 번으로 나눈다.

1. **F6-A 아티스트 목록·상세**: `/api/v1/kpop/artists`, `/artists/{id|slug}`
2. **F6-B 이벤트 목록·상세**: `/api/v1/kpop/events`, `/events/{id}`
3. **F6-C 상품 후보 읽기**: `/api/v1/kpop/product-candidates`

- 공통 의존성: PostgreSQL, 선택적 Redis catalog cache
- 통과 증거: 공개 승인 데이터만 노출, 검색/지역/기간, slug·숫자 ID, 캐시 miss/hit, 빈 결과
- 제외: follow, bookmark, saved item, 분석 job

### F7 — 로그인과 프로필

- 사용자 기능: 로그인 → callback → JWT/session → 새로고침 후 사용자 상태 → 로그아웃
- 외부 의존성: Kakao OAuth, 필요 시 Google/Firebase 설정
- API 경계: `/api/kakao/**`, `/api/auth/**`, `/api/auth/update-profile`
- 통과 증거: 임시 도메인 callback allowlist, guest/expired/valid token, refresh 실패, 로그아웃, 프로필 갱신
- 중단 조건: callback이 기존 AWS로 돌아감, token이 로그에 노출됨, guest가 인증 API를 호출 가능

### F8 — 사용자 저장 기능

인증 검증 후 다음 세 번으로 나눈다.

1. **F8-A 아티스트 follow**
2. **F8-B 이벤트 bookmark**
3. **F8-C 상품 saved item**

- 통과 증거: 생성·중복 요청의 멱등성·조회·삭제·다른 사용자 격리
- 롤백: API route만 닫고 기존 저장 데이터는 삭제하지 않는다.

### F9 — 성지 제보와 운영 검수

1. **F9-A 제보 저장**: 로그인 사용자 POST `/api/v1/tour/holy/submissions`
2. **F9-B 운영자 검수**: admin review 화면과 승인/거절
3. **F9-C 승인 결과 공개**: 승인된 항목만 F5 조회에 나타남

- 데이터: 제출자, 출처 URL, 주소·좌표, 검수 상태
- 통과 증거: 비로그인 거부, 중복 출처, 승인 전 비공개, 승인 후 공개, 거절 사유, 감사 기록

### F10 — 커뮤니티

아래 네 단계는 각각 별도 배포와 문서를 갖는다.

1. **F10-A 읽기**: 게시글 목록·상세·댓글 목록(GET 공개)
2. **F10-B 게시글 쓰기**: 생성·수정·삭제와 이미지 저장
3. **F10-C 상호작용**: 댓글, 좋아요, 팔로우, 신고
4. **F10-D 운영 검수**: moderation queue와 상태 변경

- 외부 의존성: 이미지 저장 공급자, 알림은 처음에는 끔
- 통과 증거: 페이지네이션, 소유권, 파일 형식·크기, 중복 좋아요, 신고, 차단/숨김, 사용자 간 격리
- 제외: animation/RunPod는 F15까지 닫아 둔다.

### F11 — 기본 경로 계산

- 사용자 기능: 출발/도착 또는 시작점 입력 → 경로·순환 코스·주변 POI
- FastAPI API: `/api/route`, `/api/course`, `/api/facilities`, `/api/pois`, `/api/weather`
- 배포 컴포넌트: FastAPI CPU 서비스. Spring 챗봇·Celery는 아직 제외
- 통과 증거: health, 정상 좌표, 경계 좌표, 경로 없음, timeout, 지도 선/순서, 외부 데이터 fallback
- 다음 단계: AI 일정 추천

### F12 — AI 일정 추천

- 사용자 기능: 조건 입력 → 일정 추천 → 지도/목록 표시
- API: Next.js `/api/kride/recommend/itinerary` → FastAPI `/api/recommend/itinerary`
- 의존성: Graph/RAG 데이터와 선택한 LLM 공급자. RunPod는 사용하지 않는다.
- 통과 증거: 고정 평가 입력, 120초 timeout, 장소 해석 실패 표시, 비용/토큰 기록, 빈 응답, partial result
- 중단 조건: 비용 상한 부재, 평가셋 회귀, 개인 데이터가 프롬프트/로그에 노출

### F13 — KRIDE 스트리밍 챗봇

- 사용자 기능: 질문 → SSE 상태/답변 → 종료·재시도
- 경로: web proxy → Spring `/api/v1/kride/chat/stream` → FastAPI/RAG
- 계약: 인증, AI usage gate, API key, 일일 quota, 180초 stream, disconnect 정리
- 통과 증거: 첫 토큰, 순서, `[DONE]`, invalid key 401, quota 429, 중간 종료, 재연결

### F14 — Celery 백그라운드 작업

다음 순서로 한 task type씩 연다.

1. embed
2. rerank
3. weather/event
4. TTS
5. cleanup

- 컴포넌트: Redis broker/result, Celery worker, 필요 시 beat/maintenance
- API: `/jobs/celery/*`, `/jobs/celery/{taskId}`, stream
- 통과 증거: queued/running/success/failure/retry/revoke, 중복 job, 재기동 후 상태, queue 길이, 결과 만료
- 제외: video와 outfit analysis

### F15 — 고비용 미디어·RunPod

- 기능: 영상, 애니메이션, K-pop outfit analysis
- 현재 상태: 비용 문제로 **보류**
- 시작 조건: 월/일 비용 상한, 자동 중단, 입력·결과 보존 기간, fallback, 사용자 승인
- 원칙: Hostinger 기본 서비스와 분리된 worker/queue로 유지하고 장애가 웹·검색을 멈추지 않게 한다.

### F16 — 관리자·파트너 운영 기능

- 사용자 기능: admin dashboard, SDUI 편집, community/holy review, partner dashboard, B2B event
- 배포 시점: 사용자 기능과 데이터 흐름이 안정된 뒤 마지막
- 통과 증거: role별 접근, guest/user 403, 감사 로그, destructive action 확인, 수정 후 재조회, 운영자 rollback

## 기능별 완료 문서 계약

각 단계가 끝날 때 다음 한 장을 남긴다.

| 필드 | 내용 |
|---|---|
| 기능 | 한 단계의 대표 사용자 행동 하나 |
| 화면 | 배포된 페이지/컴포넌트와 실제 URL |
| API | 호출 경로와 공개/인증/관리자 구분 |
| 데이터 | 읽기/쓰기 테이블·캐시·외부 API |
| 배포 묶음 | main SHA, image digest, config revision, target |
| 검증 | 정상·빈 값·오류·모바일·로그 |
| 비용 | 유료 API/GPU/스토리지 사용 여부와 상한 |
| 롤백 | rollback digest와 데이터 보존 여부 |
| 상태 | 구현/정적검사/배포/실화면 확인을 각각 표시 |
| 다음 | 다음에 열 기능 하나 |

## 공통 배포 게이트

다음 중 하나라도 실패하면 다음 기능으로 넘어가지 않는다.

- 원격 `main` SHA와 실행 이미지 revision 불일치
- digest 대신 `latest`만 기록
- compose 미치환 변수 또는 비밀값 로그 노출
- 80/443 외 내부 포트 공개
- migration checksum 불일치 또는 복원 미검증
- 기능 정상·빈 값·오류 중 하나라도 미검증
- 임시 도메인에서만 통과하고 rollback digest가 없음
- AWS/RunPod를 사용하지 않는다는 현재 비용 경계 위반

## 코드 근거

- `subproject/SDUI/metadata-project/next.config.ts:11-17,51-61` — production의 Spring/FastAPI 주소와 rewrite
- `subproject/SDUI/metadata-project/app/holy/submit/page.tsx:23-42` — 웹 주소검색·좌표 변환과 제출 저장의 분리
- `subproject/SDUI/metadata-project/app/view/[...slug]/page.tsx:13-15` — screen controller/SDUI 화면 분기
- `subproject/SDUI/metadata-project/services/tourApi.ts:56-96` — 맛집·성지·지역 공개 조회
- `subproject/SDUI/metadata-project/services/communityService.ts:94-218` — 커뮤니티 읽기·쓰기·상호작용·animation 경로
- `subproject/SDUI/SDUI-server/.../SecurityConfig.java:91-137` — 공개/인증/관리자 API 경계
- `subproject/SDUI/SDUI-server/.../TourController.java:30-89` — POI·성지·지역·맛집 API
- `subproject/SDUI/SDUI-server/.../KpopController.java:67-350` — 공개 카탈로그, 사용자 저장, 분석 job의 분리
- `subproject/SDUI/SDUI-server/.../KrideChatController.java:41-78` — 동기/SSE 챗봇과 usage gate
- `src/api/fastapi_server.py:621-2246` — health, 경로, 추천, 챗봇, RunPod, Celery API

## 다음 행동

현재 진행 중인 F1의 실제 배포·기능 검증이 통과하면 **G1 Spring 플랫폼 게이트만** 다음 작업으로 연다. G1에서 사용자 기능을 여러 개 공개하지 않고, health·migration·DB/Redis 복구 증거를 먼저 만든다.
