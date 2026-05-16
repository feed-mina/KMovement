# K-Ride 구현 단계 완료 현황

> 원본 출처: `.ai/kride.txt` (2026-05-11 기준 정리)

---

## Phase 0 — 기반 세팅 (완료)

SDUI 기반 Next.js 프로젝트 초기 설정 완료.

---

## Phase 1 — SDUI 엔진 통합 (완료)

| 항목 | 상태 |
|------|------|
| 1-1. DynamicEngine 복사 및 K-Ride 액션 적용 | ✅ |
| 1-2. componentMap 등록 | ✅ |
| 1-3. Zustand 온보딩 스토어 | ✅ |
| 1-4. screenMap 등록 | ✅ |
| 1-5. ConditionalHeader + layout.tsx | ✅ |

---

## Phase 2 — 컴포넌트 구현 (완료)

- Level 2 Atoms 11개 구현
- Level 3 복합 컴포넌트 6개 구현

---

## Phase 3 — 화면 구현 (완료)

구현 완료 화면: `browse` / `movies` (INTRO2) / `latest` (INTRO3) / `intro4` / `intro5`

---

## Phase 4 — My-List + Focus 화면 (완료)

| 항목 | 내용 |
|------|------|
| `my-list/page.tsx` | 온보딩 요약 + AI 배너, `duration===null` 시 `/browse` redirect |
| `focus/page.tsx` | 60/40 지도+일정 패널, `duration===null` 시 redirect |

---

## Phase 5 — 보안 + PWA (완료)

| 항목 | 내용 |
|------|------|
| `src/middleware.ts` | 9개 경로 accessToken 쿠키 인증 보호 |
| `public/manifest.json` | PWA 매니페스트 |
| `next.config.ts` | next-pwa 조건부 적용 |

---

## SDUI DB SQL (완료)

- `V40__kride_screens.sql` — 이미 완성되어 있었음

---

## Jest 테스트 작성 (완료)

| 파일 | 내용 |
|------|------|
| `jest.config.ts` | ts-jest, jsdom, setupFilesAfterEnv |
| `onboarding-store.test.ts` | Intro1~5 + My-list 스토어 로직 전체 |
| `ItineraryPanel.test.tsx` | Focus duration별 날짜 구조 |
| `SelectionCard.test.tsx` | 5개 초과 방지, 토글 해제 |
| `DualRangeSlider.test.tsx` | 경계값, 슬라이더 범위 제한 |

---

## 개발 서버 실행 방법

```bash
# 의존성 설치 (jest, testing-library, next-pwa 추가됨)
cd D:/kride-project/subproject/SDUI/kride
npm install

# 테스트 실행
npm test

# 개발 서버
npm run dev
```

> **주의**: next-pwa는 `NODE_ENV=production`에서만 서비스 워커 활성화.
> 개발 환경에서는 `manifest.json`만 동작, SW는 비활성화.

---

## K-Ride 2.0 전체 기술 스택 요약

### 프론트엔드
- Next.js 15 (App Router) + TypeScript
- Zustand (온보딩 상태 관리)
- SDUI DynamicEngine (DB 기반 화면 렌더링)
- next-pwa (PWA 지원)
- Firebase Auth + Storage (인증·이미지)

### 백엔드
- Spring Boot (EC2, port 8080) — SDUI 화면 메타데이터 API
- FastAPI (로컬, port 8000) — RAG 파이프라인 + AI 추천 API

### AI/ML
| 계층 | 구성 |
|------|------|
| LLM | Groq API (llama-3.3-70b-versatile) |
| 임베딩 | intfloat/multilingual-e5-small (384차원) |
| 벡터DB | ChromaDB 로컬 또는 PostgreSQL pgvector |
| 지식 그래프 | Neo4j AuraDB (클라우드) |
| 실험 추적 | MLflow (SQLite 백엔드) |

### 인프라
- Neon PostgreSQL (클라우드 배포 선택지)
- Google Colab (임베딩 GPU 처리)
- HuggingFace Hub (모델 파일 업로드 예정)

---

## Firebase → Neo4j 하이브리드 전략

Neo4j 도입 후에도 Firebase를 부분 유지:

| 역할 | 서비스 | 이유 |
|------|--------|------|
| 인증 (Login/Signup) | Firebase Auth 유지 | 이미 안정화, 마이그레이션 비용 불필요 |
| 이미지 저장 | Firebase Storage 유지 | 파일 업로드 안정성 |
| 비즈니스 데이터 (아티스트-POI 관계, 추천) | Neo4j 전환 | 복잡한 관계 쿼리 성능 |
| 대규모 POI (81만 건) | PostgreSQL 유지 | 좌표 기반 검색, 카테고리 필터 최적화 |

GraphRAG 연계 플로우:
1. 사용자 질의 → Neo4j에서 아티스트-장소 관계 탐색
2. 장소 ID/좌표 → PostgreSQL에서 주변 맛집·상세 정보 조회
3. 정보 → Groq LLM에 전달 → 최종 답변 생성

---

## 현재 미완료 사항 (Phase 6 이후)

| 항목 | 상태 |
|------|------|
| FOCUS 화면 FastAPI 연동 (`GOTO_FOCUS` 액션) | ⏳ 미구현 |
| V44/V45 Flyway 마이그레이션 배포 | ⏳ 사용자 직접 실행 필요 |
| FastAPI EC2 배포 | ⏳ 미완료 |
| HuggingFace Hub 모델 업로드 | ⏳ 미실행 |
| 전국 여행로그 AI Hub 신청 | ⏳ 미신청 |
