# KMovement 전체 작업지도 및 기능 단계 분리 보고서 · 최소 행동 단위판

> 기준 시점: 2026-10-04 16:16 KST
> 저장소 기준: `feed-mina/KMovement` `origin/main` `1f863f959277becfdeb2e8147027bf1a07c505ec`
> 현재 배포 기록: `prepared-not-deployed`
> 문서 상태: 계획과 검증 계약 작성 완료. 실제 Hostinger 배포, 운영 DNS 변경, AWS 종료, RunPod 실행은 수행하지 않음.

## 최종 목표

KMovement를 한 번에 전부 배포하지 않고, 사용자가 직접 확인할 수 있는 행동 하나씩 Hostinger에 추가한다. 각 행동은 같은 배포 기록 안에 `main SHA + image digest + config revision + target + rollback`을 남기고, 정상·빈 값·오류·모바일·로그 증거가 모일 때만 다음 행동으로 넘어간다.

## 3줄 줄거리

1. 지금은 Hostinger용 웹 이미지·Traefik Compose·실행 런북까지 준비됐지만, 실제 VPS 실행과 주소검색 실화면 검증은 아직 하지 않았다.
2. 첫 기능은 `/holy/submit`의 주소 검색 → 주소 선택 → 좌표 변경 → 지도 마커 이동만 검증하고, 제출·DB 저장은 별도 단계로 남긴다.
3. 이후 기능은 플랫폼 기반 → 공개 읽기 → 인증 → 사용자 쓰기 → 커뮤니티 → 경로·AI → 비동기·고비용 → 운영자 기능 순서로 가장 작은 사용자 행동 하나씩 연다.

## 현재 위치

`전체 목표 → F1 웹 주소검색 → 실배포 승인 직전 → 임시 HTTPS 배포·실화면 검증 미실행`

### 확인된 사실

- 현재 `origin/main`은 `1f863f9`이며 Hostinger 준비 PR #246, 기존 Traefik 연결 PR #247, 한국어 실행 런북이 포함되어 있다.
- 준비 이미지 기록은 `a51c52f` 기반 digest를 사용하며 상태는 `prepared-not-deployed`다.
- 배포 대상은 기존 Traefik 뒤의 Next.js 웹 컨테이너 한 개다. Spring, FastAPI, PostgreSQL, Redis, Celery, RunPod는 F1에 포함하지 않는다.
- `/holy/submit`의 주소 검색·좌표 변환·지도는 Daum 우편번호와 Kakao Maps JavaScript API를 사용한다.
- 제출 버튼은 Spring API와 DB가 필요하므로 F9-A까지 검증 범위 밖이다.
- 현재 코드에는 Spring 컨트롤러, 109개 Flyway 마이그레이션, FastAPI 경로·추천·채팅·Celery·RunPod 진입점, Expo 모바일이 함께 있다. 존재 자체는 운영 배포 완료를 뜻하지 않는다.

### 가설과 검증

- 가설: 기능을 사용자 행동 하나와 의존 서비스 하나 수준으로 쪼개면 장애 원인과 롤백 범위를 한 릴리스 안에서 설명할 수 있다.
- 검증: 각 단계마다 독립 URL/API, 정상·빈 값·오류 조건, 데이터 변경 여부, 롤백 방법이 하나의 완료 기록에 들어가는지 확인한다. 하나라도 섞이면 단계를 다시 나눈다.

## 모든 기능에 반복하는 17개 최소 행동

아래 M01~M17은 모든 기능 단계에서 반복한다. `M09`까지는 배포 준비, `M10`부터는 별도 배포 승인 후 실행이다.

| ID | 한 번에 하는 행동 | 남길 증거 | 통과 기준 |
|---|---|---|---|
| M01 | `git fetch origin --prune` 실행 | fetch 시각 | 원격 오류 없음 |
| M02 | 배포 작업트리 상태 확인 | `git status --porcelain` | 의도하지 않은 변경 없음 |
| M03 | 정확한 `origin/main` SHA 기록 | 40자 SHA | HEAD와 기준 SHA 일치 |
| M04 | 이미지 참조를 digest로 고정 | `image@sha256:...` | 태그 단독 사용 없음 |
| M05 | config revision 기록 | Compose·proxy 파일 커밋 | 배포 파일과 기록 일치 |
| M06 | 이전 digest 또는 최초 제거 절차 기록 | rollback 필드 | 되돌릴 대상이 모호하지 않음 |
| M07 | 해당 기능의 가장 작은 테스트 하나 실행 | 테스트명·결과 | 대상 기능 계약 통과 |
| M08 | 이미지 빌드와 non-root 확인 | revision 라벨·사용자 | SHA 일치, `nextjs` 또는 지정 non-root |
| M09 | Compose 렌더링과 공개 포트 확인 | `config` 출력 요약 | 미치환 변수 없음, 허용 포트만 공개 |
| M10 | 승인된 임시 대상에 한 서비스만 적용 | Compose 프로젝트·시간 | 기존 서비스 재생성 없음 |
| M11 | health와 대표 URL/API 한 개 확인 | HTTP 상태·health | 예상 상태 반환 |
| M12 | 대표 사용자 행동 한 번 수행 | 입력·화면 변화 | 계획한 결과 하나 확인 |
| M13 | 빈 값 한 번 확인 | 빈 상태 캡처·응답 | 오류처럼 보이지 않는 빈 상태 |
| M14 | 실패 조건 한 번 확인 | 상태 코드·안내 문구 | 복구 가능한 오류 표현 |
| M15 | 모바일 폭·키보드·접근성 확인 | 폭·조작 결과 | 잘림·막힘 없음 |
| M16 | Console·Network·서버 로그 확인 | 가린 증거 | 비밀값·쿠키 노출 없음 |
| M17 | 배포 기록을 닫고 다음 단계 결정 | 완료/중단/롤백 판정 | 증거 없는 항목은 미완료 유지 |

## 전체 릴리스 순서

```text
B0 기준점 고정
 → F1 웹 주소검색
 → G1 Spring·DB·Redis 기반
 → F2 모바일 주소검색
 → F3 SDUI 공개 화면
 → F4 맛집 공개 조회
 → F5 성지 공개 조회
 → F6-A 아티스트 → F6-B 이벤트 → F6-C 상품 후보
 → F7 로그인 → 프로필 → 로그아웃
 → F8-A 팔로우 → F8-B 북마크 → F8-C 저장상품
 → F9-A 제보 저장 → F9-B 운영 검수 → F9-C 승인 공개
 → F10-A 커뮤니티 읽기 → F10-B 게시글 → F10-C 댓글/좋아요 → F10-D 신고/검수
 → F11-A 경로 → F11-B 순환코스 → F11-C POI/날씨
 → F12 AI 일정 추천
 → F13 SSE 챗봇
 → F14-A embed → rerank → weather/event → TTS → cleanup
 → F15 고비용 미디어·RunPod
 → F16 관리자·파트너
```

## 기능별 최소 행동

### B0 — 기준점과 비용 경계

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| B0-01 | 최신 `origin/main` SHA를 다시 읽는다 | 40자 SHA 기록 |
| B0-02 | Hostinger 준비 기록의 SHA·digest·target을 읽는다 | 다섯 식별값 표 작성 |
| B0-03 | AWS·EC2·RunPod workflow를 변경하지 않는 목록으로 고정한다 | 제외 목록 명시 |
| B0-04 | 기존 Traefik 프로젝트 이름과 80/443 소유자를 읽기 전용 확인한다 | 기존 프로젝트 증거 |
| B0-05 | KMovement 전용 Compose 프로젝트 이름을 확정한다 | `kmovement-web` 한 개 |
| B0-06 | 운영 DNS와 임시 DNS를 구분한다 | 운영 DNS 변경 없음 |

### F1 — 웹 주소검색·좌표·지도

현재 깊게 검증할 단계다.

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F1-01 | Kakao JavaScript 키 허용 도메인에 임시 HTTPS 호스트를 추가한다 | 도메인 항목 확인 |
| F1-02 | 준비 이미지 digest가 pull 가능한지 확인한다 | pull 성공 |
| F1-03 | 이미지 사용자와 revision 라벨을 읽는다 | `nextjs`, 기록 SHA 일치 |
| F1-04 | Traefik Compose를 렌더링한다 | 서비스 `web` 한 개 |
| F1-05 | host port가 없는지 확인한다 | `ports` 없음, `expose: 3000`만 존재 |
| F1-06 | 기존 Traefik 네트워크와 라우터 이름 충돌을 확인한다 | 충돌 없음 |
| F1-07 | 사용자 승인 후 `kmovement-web`만 `up -d`한다 | 기존 프로젝트 재생성 없음 |
| F1-08 | 컨테이너 health를 확인한다 | `healthy` |
| F1-09 | 임시 HTTPS `/`를 호출한다 | 200 |
| F1-10 | 임시 HTTPS `/holy/submit`을 호출한다 | 200 |
| F1-11 | 주소 검색창을 연다 | Daum 검색 UI 표시 |
| F1-12 | 실제 도로명 주소 하나를 선택한다 | 선택 주소 문자열 변경 |
| F1-13 | 위도·경도를 선택 전후 비교한다 | 초기값과 다른 유효 좌표 |
| F1-14 | 지도 마커 위치를 선택 전후 비교한다 | 선택 위치로 이동 |
| F1-15 | 390px 모바일 폭에서 같은 행동을 반복한다 | 검색·지도·버튼 잘림 없음 |
| F1-16 | Console과 Network를 저장한다 | 키·쿠키를 가린 증거 |
| F1-17 | 제출 버튼을 누르지 않았음을 기록한다 | DB 저장 미검증 표기 |
| F1-18 | 실패 시 KMovement Compose 프로젝트만 내린다 | Traefik·기존 서비스 유지 |
| F1-19 | release record의 false 항목만 증거에 맞게 갱신한다 | 추측 완료 없음 |

### G1 — Spring·PostgreSQL·Redis 플랫폼 게이트

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| G1-01 | Spring production 필수 환경변수 이름만 목록화한다 | 값 미노출 |
| G1-02 | PostgreSQL 전용 볼륨과 백업 위치를 정한다 | 웹 볼륨과 분리 |
| G1-03 | Redis persistence 필요 범위를 정한다 | cache/broker/usage 분리 |
| G1-04 | Spring·DB·Redis 내부 네트워크를 만든다 | host port 비공개 |
| G1-05 | DB 계정의 최소 권한을 만든다 | 애플리케이션 DB로 제한 |
| G1-06 | 빈 DB에 Flyway 109개 적용을 검증한다 | 실패·checksum 불일치 없음 |
| G1-07 | 기존 데이터 스냅샷에서 Flyway 재적용을 검증한다 | 데이터 손실 없음 |
| G1-08 | Spring health를 내부에서 호출한다 | healthy |
| G1-09 | PostgreSQL readiness를 확인한다 | 연결 성공 |
| G1-10 | Redis ping을 확인한다 | PONG |
| G1-11 | 재기동 후 세 서비스 상태를 다시 확인한다 | 자동 복구 |
| G1-12 | DB 백업을 복원해 본다 | 핵심 테이블 건수 일치 |
| G1-13 | 외부 공개 경로를 health와 다음 기능 API로 제한한다 | allowlist 확인 |
| G1-14 | 플랫폼 게이트 기록을 닫는다 | 사용자 기능 완료로 오표기하지 않음 |

### F2 — 모바일 주소검색

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F2-01 | `KAKAO_REST_API_KEY`를 Spring secret로 넣는다 | 앱·로그에 값 없음 |
| F2-02 | 두 글자 미만 검색을 보낸다 | 빈 결과 |
| F2-03 | 정상 키워드를 `/api/v1/address/search`로 보낸다 | 최대 10건 |
| F2-04 | 우편번호·도로명·지번 필드를 대조한다 | UI 계약과 일치 |
| F2-05 | 모바일 모달에서 결과 한 건을 선택한다 | 폼 값 반영 |
| F2-06 | 검색 결과 없음 상태를 확인한다 | 직접 입력 안내 |
| F2-07 | Kakao 공급자 오류를 만든다 | 502와 직접 입력 안내 |
| F2-08 | 모바일 테스트를 루트 CI와 별도로 실행한다 | `AddressSearchModal` 테스트 통과 |

### F3 — 공개 SDUI 한 화면

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F3-01 | guest용 screenId 한 개를 고른다 | 역할·목적 기록 |
| F3-02 | `GET /api/ui/{screenId}` 응답을 저장한다 | 노드·부모 ID 존재 |
| F3-03 | 허용된 data source 한 개만 실행한다 | 선언된 키만 호출 |
| F3-04 | 미등록 컴포넌트가 없는지 검사한다 | registry 누락 없음 |
| F3-05 | loading을 확인한다 | 무한 로딩 없음 |
| F3-06 | empty를 확인한다 | 빈 화면 설명 있음 |
| F3-07 | error를 확인한다 | 재시도 가능 |
| F3-08 | 같은 URL 재열기를 확인한다 | 동일 화면 복원 |
| F3-09 | 다른 역할 노드가 숨겨지는지 확인한다 | 권한 누출 없음 |

### F4 — 맛집 공개 조회

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F4-01 | 지역 목록 한 번 조회 | 지역 ID·이름 |
| F4-02 | 시군구 한 곳 선택 | 요청 파라미터 반영 |
| F4-03 | 첫 페이지 맛집 조회 | 카드 목록 표시 |
| F4-04 | 다음 페이지 이동 | 중복·누락 없음 |
| F4-05 | 빈 지역 조회 | 빈 상태 표시 |
| F4-06 | TourAPI 오류 확인 | 오류와 cache fallback 구분 |
| F4-07 | 이미지·출처·주소 확인 | 잘못된 출처 없음 |

### F5 — 성지 공개 조회

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F5-01 | 승인 상태 데이터만 조회 | pending 미노출 |
| F5-02 | 지역 필터 한 번 적용 | 결과 축소 |
| F5-03 | 작품 필터 한 번 적용 | 연결 콘텐츠 일치 |
| F5-04 | 종류 필터 한 번 적용 | 분류 일치 |
| F5-05 | 성지 상세 주소를 지도 좌표와 비교 | 위치 일치 |
| F5-06 | 이미지 출처 확인 | 원본 링크 유지 |
| F5-07 | 필터 0건 상태 확인 | 검색 초기화 안내 |

### F6 — K-POP 공개 카탈로그

#### F6-A 아티스트

- F6-A01 목록 1페이지 조회
- F6-A02 검색어 한 개 적용
- F6-A03 숫자 ID 상세 열기
- F6-A04 slug 상세 열기
- F6-A05 없는 ID의 404 확인
- F6-A06 승인되지 않은 데이터 미노출 확인

#### F6-B 이벤트

- F6-B01 기간 시작일만 적용
- F6-B02 기간 종료일만 적용
- F6-B03 지역 필터 적용
- F6-B04 이벤트 상세 열기
- F6-B05 종료 이벤트 표시 규칙 확인
- F6-B06 빈 기간 결과 확인

#### F6-C 상품 후보

- F6-C01 후보 검색 조건 한 개 입력
- F6-C02 후보 목록과 근거 표시
- F6-C03 근거 부족 시 빈 후보 확인
- F6-C04 cache miss 확인
- F6-C05 cache hit 확인
- F6-C06 외부 구매 적합성을 보증하지 않는 문구 확인

### F7 — 인증과 프로필

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F7-01 | 임시 도메인을 OAuth callback allowlist에 넣는다 | callback 일치 |
| F7-02 | guest 페이지 진입 | 로그인 강제 루프 없음 |
| F7-03 | 로그인 버튼 클릭 | 공급자 화면 이동 |
| F7-04 | callback code 1회 사용 | 재사용 거부 |
| F7-05 | 사용자 세션 확인 | `/api/auth/me` 정상 |
| F7-06 | 새로고침 | 세션 유지 |
| F7-07 | 만료 토큰 | 재인증 안내 |
| F7-08 | 프로필 필드 한 개 수정 | 재조회 일치 |
| F7-09 | 로그아웃 | 보호 API 거부 |
| F7-10 | 로그에서 token 검색 | 노출 없음 |

### F8 — 사용자 저장 기능

각 기능을 생성 → 중복 생성 → 목록 → 삭제 → 다른 사용자 격리 순서로 반복한다.

- F8-A: 아티스트 follow
- F8-B: 이벤트 bookmark
- F8-C: 상품 saved item

각 하위 단계의 최소 행동은 `01 생성`, `02 동일 요청 재실행`, `03 내 목록 조회`, `04 삭제`, `05 삭제 후 재조회`, `06 다른 사용자 조회 차단`이다.

### F9 — 성지 제보·검수·공개

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F9-A01 | 비로그인 제출 | 401/403 |
| F9-A02 | 로그인 후 최소 필드 제출 | pending 저장 |
| F9-A03 | 같은 출처 URL 재제출 | 중복 규칙 적용 |
| F9-A04 | 제출 직후 공개 조회 | 미노출 |
| F9-B01 | 관리자 pending 목록 조회 | 제출 건 표시 |
| F9-B02 | 거절 사유 입력 | 상태·감사 기록 |
| F9-B03 | 별도 제출 건 승인 | 승인자·시각 기록 |
| F9-C01 | 승인 후 공개 조회 | 공개 목록 표시 |
| F9-C02 | 승인 후 지도 열기 | 주소·좌표 일치 |

### F10 — 커뮤니티

#### F10-A 읽기

- 목록 첫 페이지 → 다음 페이지 → 상세 → 댓글 목록 → 빈 목록 → 삭제된 글 404

#### F10-B 게시글

- 비로그인 생성 거부 → 텍스트 생성 → 이미지 1장 생성 → 허용되지 않은 형식 거부 → 본인 수정 → 타인 수정 거부 → 본인 삭제

#### F10-C 상호작용

- 댓글 생성 → 댓글 수정 → 댓글 삭제 → 좋아요 → 중복 좋아요 → 좋아요 해제 → 사용자 팔로우 → 자기 자신 팔로우 거부

#### F10-D 신고·검수

- 신고 생성 → 중복 신고 → 관리자 queue → 상태 변경 → 콘텐츠 숨김 → 감사 이력 조회

애니메이션 버튼과 RunPod 경로는 F15까지 비활성으로 유지한다.

### F11 — CPU FastAPI 경로 기능

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F11-01 | `/api/health` 호출 | 200 |
| F11-02 | 정상 출발·도착 좌표 입력 | 경로 반환 |
| F11-03 | 지도 polyline 표시 | 순서·좌표 일치 |
| F11-04 | 같은 좌표 입력 | 명확한 오류/빈 경로 |
| F11-05 | 경계 밖 좌표 입력 | 4xx |
| F11-06 | 순환 코스 입력 | 시작·종료 규칙 일치 |
| F11-07 | 시설 조회 | 거리/분류 표시 |
| F11-08 | POI 조회 | 지도 마커 표시 |
| F11-09 | 날씨 공급자 실패 | fallback 표시 |
| F11-10 | timeout | 웹 요청 종료·재시도 안내 |

### F12 — AI 일정 추천

| ID | 최소 행동 | 완료 기준 |
|---|---|---|
| F12-01 | 고정 평가 입력을 저장한다 | 개인정보 없음 |
| F12-02 | 목적·지역·기간을 한 번 입력한다 | 요청 계약 일치 |
| F12-03 | 후보 검색 결과를 저장한다 | 근거 ID 포함 |
| F12-04 | LLM 결과를 후보와 대조한다 | 존재하지 않는 장소 차단/표시 |
| F12-05 | 좌표 보완 순서를 확인한다 | 직접좌표→원본→지오코딩 |
| F12-06 | 일정과 지도 마커 수를 비교한다 | 차이 설명 가능 |
| F12-07 | 빈 응답을 확인한다 | 사용자 안내 |
| F12-08 | 120초 timeout을 확인한다 | 요청 종료 |
| F12-09 | 토큰·비용을 기록한다 | 상한 이내 |
| F12-10 | 같은 평가 입력 회귀 비교 | 이전 기준보다 악화 여부 기록 |

### F13 — SSE 챗봇

- F13-01 인증 없음 401
- F13-02 invalid API key 401
- F13-03 quota 초과 429
- F13-04 정상 질문 연결
- F13-05 첫 토큰 시간 기록
- F13-06 이벤트 순서 확인
- F13-07 `[DONE]` 확인
- F13-08 브라우저 중간 종료
- F13-09 서버 disconnect 정리 확인
- F13-10 재시도 시 중복 답변 없음

### F14 — Celery 작업

task type은 `embed → rerank → weather → event → TTS → cleanup` 순서로 하나씩 연다. 각 type마다 아래 행동을 반복한다.

1. 작업 1건 생성
2. queued 확인
3. running 확인
4. success 결과 확인
5. 고의 실패 확인
6. retry 횟수 확인
7. 같은 idempotency key 재요청
8. revoke 확인
9. worker 재기동 후 상태 확인
10. 결과 만료 확인

### F15 — 고비용 미디어·RunPod

비용 승인 전에는 실행하지 않는다.

| ID | 시작 전 행동 | 통과 기준 |
|---|---|---|
| F15-01 | 일·월 비용 상한 작성 | 숫자와 통화 명시 |
| F15-02 | GPU 자동 종료 조건 작성 | idle timeout 존재 |
| F15-03 | 입력 보존 기간 작성 | 삭제 시점 명시 |
| F15-04 | 결과 보존 기간 작성 | 삭제·다운로드 경계 명시 |
| F15-05 | 동의와 소유권 확인 UI 검증 | 동의 없이는 작업 불가 |
| F15-06 | 중복 방지 키 검증 | 중복 과금 없음 |
| F15-07 | 웹 장애와 worker 장애 격리 | 기본 검색·지도 유지 |
| F15-08 | 별도 사용자 승인 | 승인 전 job 0건 |

### F16 — 관리자·파트너

- F16-01 guest의 admin 403
- F16-02 user의 admin 403
- F16-03 admin의 사용자 목록 조회
- F16-04 역할 변경 전 확인창
- F16-05 역할 변경 후 재조회
- F16-06 SDUI 화면 목록 조회
- F16-07 화면 상세와 query master 연결 확인
- F16-08 성지·커뮤니티 검수 queue 조회
- F16-09 partner dashboard 역할 확인
- F16-10 B2B event 생성과 관리자 review 분리
- F16-11 destructive action 감사 로그
- F16-12 운영자 변경 rollback

## Before / After

| 이전 계획 | 이번 최소 행동 단위판 |
|---|---|
| `F4 맛집 배포`처럼 큰 기능 이름이 중심 | 지역 조회, 첫 페이지, 다음 페이지, 빈 결과, 공급자 오류를 각각 다른 행동으로 분리 |
| 배포와 기능 확인이 한 문단에 섞임 | M01~M17로 기준점·빌드·배포·실화면·오류·롤백을 분리 |
| 단계 완료 문서 필드는 있었지만 실행 순서가 큼 | 모든 행동에 ID·입력·통과 기준·증거를 부여 |
| F1이 준비인지 실배포인지 첫 화면에서 약함 | `prepared-not-deployed`와 실배포 승인선을 명시 |
| 커뮤니티·K-POP·Celery가 하위 기능 묶음 | 읽기/쓰기/상호작용과 task type을 독립 릴리스로 분리 |

## 사용자와 작업 에이전트의 역할

### 사용자가 직접 할 일

현재는 다음 한 가지만 필요하다.

1. F1 실배포를 진행할 때 Kakao Developers에 임시 HTTPS 도메인을 등록하고, 실제 VPS 실행을 승인한다.

그 전까지 코드·문서·CI 준비는 작업 에이전트가 수행할 수 있지만, 실제 Hostinger 변경·운영 DNS·AWS 종료·RunPod 비용 발생은 승인 없이 진행하지 않는다.

### 작업 에이전트에게 그대로 전달할 요청문

> 목표: KMovement의 현재 단계에서 사용자 행동 하나만 배포하고 증거를 남긴다.
> 기준: 실행 직전 `origin/main`을 fetch하고 SHA, image digest, config revision, target, rollback을 같은 기록에 고정한다.
> 범위: 이 보고서에서 지정한 기능 ID 하나와 공통 M01~M17만 수행한다. 다음 기능, 운영 DNS, AWS 종료, RunPod는 범위 밖이다.
> 완료 기준: 정상·빈 값·오류·모바일·Console/Network·rollback 증거를 각각 남기고, 미실행 항목을 완료로 표시하지 않는다.
> 보고: 변경 파일, 실행 명령, 테스트 결과, 배포 여부, 실제 화면 여부, 남은 차단 조건, 다음 기능 ID 하나를 보고한다.

## 완료 증거 묶음

각 기능이 끝날 때 다음 파일 하나를 새로 만든다.

```yaml
featureId: F1-12
gitSha: 40-character-main-sha
image: registry/image@sha256:immutable-digest
configRevision: commit-or-config-digest
target: temporary-host-or-internal-service
rollback: previous-digest-or-remove-new-project
tests:
  contract: passed-or-failed
  build: passed-or-failed
  compose: passed-or-failed
verification:
  happyPath: true-or-false
  emptyState: true-or-false
  errorState: true-or-false
  mobile: true-or-false
  consoleNetwork: true-or-false
deployment: not-run-or-deployed-or-rolled-back
nextFeatureId: one-id-only
```

## 중단 규칙

- SHA·digest·config revision 중 하나라도 불일치하면 배포하지 않는다.
- 실제 사용자 행동 증거가 없으면 기능 완료로 표시하지 않는다.
- 데이터 쓰기 기능은 백업·복구 증거가 없으면 열지 않는다.
- 인증 기능은 token·cookie가 로그에 보이면 즉시 중단한다.
- 유료 AI·GPU 기능은 비용 상한과 자동 종료가 없으면 실행하지 않는다.
- 실패 시 다음 기능으로 넘어가지 않고 현재 Compose 프로젝트 또는 현재 API route만 되돌린다.

## 근거 파일

- `deploy/hostinger/README.md`
- `deploy/hostinger/VPS-DEPLOY-RUNBOOK-KO.md`
- `deploy/hostinger/release-record-20261002-a51c52f.prepared.yml`
- `deploy/hostinger/web.traefik.compose.yml`
- `.github/workflows/hostinger-web-publish.yml`
- `subproject/SDUI/metadata-project/app/holy/submit/page.tsx`
- `subproject/SDUI/kride/apps/mobile/src/components/AddressSearchModal.tsx`
- `subproject/SDUI/SDUI-server/src/main/java/com/domain/demo_backend/global/config/SecurityConfig.java`
- `subproject/SDUI/SDUI-server/src/main/java/com/domain/demo_backend/domain/address/controller/AddressSearchController.java`
- `subproject/SDUI/metadata-project/services/tourApi.ts`
- `subproject/SDUI/metadata-project/services/communityService.ts`
- `subproject/SDUI/SDUI-server/src/main/java/com/domain/demo_backend/domain/kpop/controller/KpopController.java`
- `src/api/fastapi_server.py`

## 이번 문서의 실행 상태

- 완료: 최신 `origin/main`과 기존 Hostinger 준비 기록 확인, 기능 분해, 최소 행동·통과 기준·실패 경계 작성.
- 미실행: 애플리케이션 코드 수정, VPS 변경, 임시 HTTPS 확인, 실제 주소검색 화면, DB 작업, 운영 DNS, AWS 종료, RunPod.
- 다음 행동 하나: F1 실배포를 시작할 때 `F1-01 Kakao 임시 도메인 등록`부터 수행한다.
