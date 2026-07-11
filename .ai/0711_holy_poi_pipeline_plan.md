# 성지 POI 데이터 파이프라인 플랜 (#96-A, 구 #78 · Epic #74 Dev-4)

> 목표: 성지 데이터를 프론트 하드코딩(`lib/data/holySites.ts` 8건)에서
> **DB 기반 검수 파이프라인**(후보 수집 → LLM 정제 → 검수 큐 → 승인분만 서빙)으로 전환.

## 현재 상태 (2026-07-11 조사)

- 프론트: `TourExploreScreen`의 `HOLY` 카테고리 = `HOLY_SITES` 하드코딩(TourAPI 미호출)
- DB: `tour_poi`(V75) 존재 — `source TOURAPI|UGC|CRAWL`, `content_id NULL 허용`으로 성지 대비 설계됨. 단 성지 특화 필드(artist·fandom_info·검수상태) 없음
- 백엔드: `domain/tour`는 TourAPI 프록시만 (`TourService` 주석에 "후속(Dev-4): tour_poi upsert" 명시)

## 아키텍처 (1차)

```
[후보 수집]                [정제]                  [검수]              [서빙]
수동 시드 CSV/JSON  →  LLM 정제 스크립트     →  tour_poi           →  GET /api/v1/tour/holy
UGC 제보(커뮤니티)      (좌표 검증·설명 정규화     (review_status=        (APPROVED만)
(2차: 제한적 크롤)       ·출처 필수)               PENDING 삽입)          프론트 HOLY 카테고리
                                                  ↓ 어드민 검수 API
                                                  APPROVED / REJECTED
```

## 작업 항목

### ① DB — V76 마이그레이션 (**스키마 승인됨 2026-07-11** — 구현은 별도 착수)
`tour_poi`에 성지 확장 컬럼:
```sql
ALTER TABLE tour_poi
  ADD COLUMN artist           VARCHAR(120),
  ADD COLUMN fandom_info      VARCHAR(255),
  ADD COLUMN recommend_reason VARCHAR(500),
  ADD COLUMN source_url       TEXT,                            -- 출처(저작권 추적)
  ADD COLUMN review_status    VARCHAR(12) NOT NULL DEFAULT 'APPROVED',  -- PENDING|APPROVED|REJECTED (기존 TOURAPI 행은 승인 취급)
  ADD COLUMN reviewed_by      VARCHAR(60),
  ADD COLUMN reviewed_at      TIMESTAMP;
CREATE INDEX idx_tour_poi_holy ON tour_poi(source, review_status) WHERE source <> 'TOURAPI';
```
+ 기존 하드코딩 8건을 시드 INSERT(source='CRAWL' 아님 → 'SEED'? → `source` 값은 'UGC'/'CRAWL' 외 'SEED' 추가 허용, VARCHAR라 제약 없음)

### ② 정제 파이프라인 스크립트 (Python, `scripts/holy_pipeline/`)
- 입력: 후보 CSV/JSON(장소명·아티스트·근거 URL)
- 처리: (a) 지오코딩/좌표 검증 (b) LLM으로 fandom_info·recommend_reason 정규화(사실 기반, 출처 필수) (c) 중복 검사(기존 tour_poi 좌표 반경)
- 출력: `review_status='PENDING'`으로 tour_poi INSERT (또는 SQL 파일 생성)
- LLM: 기존 FastAPI(OpenAI) 재사용 or Claude API — **비용 승인 필요**

### ③ 백엔드 API
- `GET /api/v1/tour/holy` — `source<>'TOURAPI' AND review_status='APPROVED'` 목록 (공개)
- `GET/POST /api/v1/admin/tour/holy/review` — 검수 큐 목록·승인/반려 (ROLE_ADMIN)

### ④ 프론트
- `TourExploreScreen` HOLY 분기: API 호출로 전환, 실패 시 `HOLY_SITES` 폴백 유지
- (후속) 어드민 검수 화면 — SDUI `ui_metadata` or `/admin` 도구

### ⑤ 저작권/이용약관 기준 (문서 — 결정은 사업자)
- **수집 대상 한정**: 공개된 사실 정보(장소명·주소·좌표·"어떤 뮤비/화보 촬영지"라는 사실)만. 기사 본문·사진·팬 창작물 복제 금지
- 출처 URL 필수 기록(`source_url`), 표시 시 출처 명기 가능 구조
- 크롤 대상: robots.txt 준수 + 약관상 크롤 금지 사이트 제외. 1차는 **수동 시드 + UGC 제보** 위주로 저작권 리스크 최소화, 대규모 크롤은 법률 검토 후 2차

## 단계별 배포

| 단계 | 내용 | 의존 |
|---|---|---|
| 1차 | V76 + 시드 8건 이관 + `GET /holy` + 프론트 API 전환 | 스키마 승인 |
| 2차 | 정제 스크립트 + 검수 API/화면 + UGC 제보 연계 | LLM 비용 승인 |
| 3차 | 제한적 크롤(법률 검토 후) | 사업자 결정 |

## AC (#96-A)
- [ ] 성지 POI가 DB(tour_poi)에서 서빙되고 좌표·출처 포함
- [ ] 검수 큐(PENDING→APPROVED) 동작
- [ ] 저작권 기준 문서화(본 문서 §⑤)
