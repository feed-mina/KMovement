# KMovement 전체 로직 인수인계

기준: `feed-mina/KMovement` `main` · `0c6e278f1` · 2026-10-02

이 문서는 사용자 화면에서 시작해 SDUI 조립, Spring 업무 처리, FastAPI 추천·채팅, 저장소, 비동기 작업과 배포 경계까지 연결한다. 화면 설명은 실제 운영 캡처가 아닌 코드 기반 재구성이다. 전체 테스트, 운영 데이터, 외부 서비스와 배포 버전은 이번 문서 작성에서 실측하지 않았다.

## 1. 전체 구조

| 경계 | 역할 | 주요 입력 | 주요 출력 |
| --- | --- | --- | --- |
| Next.js 웹 | 화면 번호와 메타데이터를 실제 React 화면으로 조립 | `screenId`, 역할, 상세 ID, 사용자 조작 | SDUI 화면, 지도, 일정, 커뮤니티, 관리자 화면 |
| Expo 모바일 | 같은 화면 계약을 네이티브 컴포넌트로 표현 | 화면 번호, 세션, 딥링크 | 모바일 화면과 네이티브 지도·저장소 |
| Spring Boot | 인증·권한, 화면 트리, 등록 쿼리, 관광·K-POP·커뮤니티 업무 | JWT, 화면 번호, 업무 요청 | UI 트리, 업무 데이터, 작업 레코드 |
| FastAPI | RAG/GraphRAG, 일정·경로·채팅, Celery/RunPod 중계 | 여행 조건, 질문, 작업 요청 | 일정·POI·마커·답변·작업 상태 |
| 데이터·작업 | 서비스 원본, 캐시, 검색, 파일, 비동기 실행 | SQL, 임베딩, 파일, 태스크 | 저장 데이터, 캐시, 검색 후보, 미디어 결과 |

웹의 `/api/**`는 Spring으로, `/kride-api/**`는 FastAPI의 `/api/**`로 전달된다. Spring의 `UiService`는 사용자 역할에 맞는 `ui_metadata` 노드를 골라 부모·자식 트리로 만들고, 웹의 `usePageMetadata`는 선언된 데이터 소스만 호출한다. `renderNodes`는 `componentMap`에 등록된 타입을 실제 컴포넌트로 바꾼다.

## 2. 대표 사용자 흐름

1. 사용자가 기간, 선호 아티스트, 지역, 목적, 예산을 고른다.
2. 선택값은 폼 상태와 브라우저 저장소에 모인다.
3. 일정 생성 요청은 Next.js 중계를 거쳐 FastAPI로 간다.
4. FastAPI는 Chroma 목적 검색과 `models/kride_graph.json`의 아티스트-장소 관계를 조합한다.
5. LLM 일정 결과를 정리하고 직접 좌표 → 원본 POI 매칭 → 주소 지오코딩 순으로 마커를 보완한다.
6. 일정 패널과 지도는 같은 결과를 사용하고, 채팅은 질문·추천·일정 변경 의도에 맞춰 응답한다.
7. 설정된 경우 추천 이력을 Supabase 또는 로컬 JSONL에 best-effort로 저장한다.

## 3. 기능별 계약

### SDUI 화면 조립

- 입력: 화면 번호, 역할, 상세 식별자, 페이지 조건.
- 처리: 역할 필터 → 트리 구성 → 데이터 소스 실행 → 참조 데이터 연결 → 컴포넌트 선택.
- 출력: 화면 노드, 목록/상세 데이터, 폼·액션 함수.
- 실패 분기: 부모 노드가 권한으로 사라지면 자식이 루트로 승격될 수 있고, 미등록 컴포넌트는 표시되지 않는다.
- 근거: `UiController.java`, `UiService.java`, `usePageMetadata.tsx`, `renderNodes.tsx`, `componentMap.tsx`.

### 인증·동적 쿼리

- JWT와 Spring Security가 인증 주체와 역할을 만든다.
- `/api/execute/{sqlKey}`는 `query_master`에 등록된 쿼리만 실행한다.
- 클라이언트는 `userSqno`나 `userId`를 덮어쓸 수 없으며, 허용된 파라미터만 형식·크기 검사를 통과한다.
- 사용자 범위 쿼리와 명령형 쿼리는 공개 Redis 캐시 대상에서 제외된다.

### 관광·성지·맛집

- 지역·시군구·콘텐츠 종류로 `tour_poi`와 외부 TourAPI 결과를 정규화한다.
- 성지 콘텐츠와 일반 관광·음식 조회를 분리한다.
- 사용자 제보는 검수 대기로 저장되고 관리자 승인·반려 흐름을 탄다.

### K-POP·이벤트·상품 분석

- 승인된 아티스트·이벤트·상품만 공개 응답으로 사용한다.
- 팔로우·북마크·상품 저장은 로그인 사용자의 범위로 결합한다.
- 이미지 분석은 동의, 소유권, 중복 방지 키를 검사한 뒤 Celery 작업을 만든다.
- 워커 결과의 이름·링크를 그대로 믿지 않고 승인된 PostgreSQL 카탈로그로 다시 채운다.
- 근거가 부족하면 `INSUFFICIENT_EVIDENCE`, 신뢰도 0, 빈 후보로 닫힌다.

### 커뮤니티·미디어 작업

- 게시글, 이미지, 댓글, 좋아요, 신고, 팔로우와 검수 감사 이력을 관계형 테이블로 관리한다.
- 애니메이션·영상 요청은 작업 레코드와 원격 작업 ID를 연결하고 스케줄러가 상태를 갱신한다.
- 작업 상태는 대기 → 실행 → 성공/실패/취소/만료로 정규화된다.

## 4. 데이터 경계

| 저장소 | 시스템 역할 | 주의 |
| --- | --- | --- |
| PostgreSQL + Flyway | 화면 정의, 등록 쿼리, 사용자·관광·K-POP·커뮤니티·작업 원본 | 109개 마이그레이션과 배포 버전을 함께 확인 |
| Redis | K-POP 공개 조회 캐시, Celery 브로커/결과, 사용량 카운터 | 사용자 데이터와 명령 결과는 공개 캐시에서 제외 |
| ChromaDB | 목적별 장소 벡터 검색 | 컬렉션 존재와 임베딩 버전 필요 |
| 로컬 그래프 / Supabase | 아티스트-장소 관계와 그래프 미러, 추천 이력 | 로컬·원격 최신성 차이 가능 |
| S3 / Supabase Storage / Cloudinary | 분석 원본, 커뮤니티 이미지, 미디어 결과 | 소유권, 만료, 삭제 상태를 작업과 함께 관리 |

## 5. 실행·테스트·배포

```bash
# Spring
cd subproject/SDUI/SDUI-server
./gradlew test

# Web
cd ../metadata-project
npm ci
npm test
npm run build

# AI API
cd ../../..
python -m pytest src/api tests -v

# Mobile
cd subproject/SDUI/kride
pnpm install --frozen-lockfile
pnpm test
```

현재 루트 CI는 Next.js 테스트·빌드와 FastAPI 지정 테스트를 실행한다. Spring은 테스트를 제외한 전체 빌드 후 Celery 관련 두 테스트 클래스만 따로 실행한다. 모바일 테스트는 루트 CI 정의에 포함되지 않는다.

배포 흐름은 EC2 전체 서비스, 프런트 전용, RunPod 미디어/Tora 이미지, Supabase 그래프 적재·갱신으로 나뉜다. 복구 시 배포 SHA, 컨테이너 이미지, Flyway 버전, 활성 환경 변수, 외부 서비스 상태를 같은 시점으로 맞춘다.

## 6. 확인 범위

확인:

- `main`과 `origin/main`의 기준 SHA.
- 웹·모바일·Spring·FastAPI·작업 큐 진입점과 연결 경로.
- 패키지 스크립트, CI, Docker Compose, 테스트 파일과 마이그레이션 파일 수.
- 기존 `handover/KMovement-maintenance.md`의 39개 화면·로직 설명.

미확인:

- 전체 테스트 실행 결과와 로컬 통합 기동.
- 실제 브라우저·모바일 사용자 흐름.
- 운영 PostgreSQL·Redis·Chroma·Supabase 데이터.
- TourAPI, Groq, Kakao, Google, RunPod 등 외부 호출.
- 운영 배포 버전과 사용자 수용.
