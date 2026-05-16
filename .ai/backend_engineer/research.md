# K-Ride Backend 분석

> 분석일: 2026-05-16
> 원본 참조: `src/api/fastapi_server.py`, `.ai/fastapi_rag_llm_guide_6번부터.md`, `.ai/api_troubleshooting_guide.md`

---

## 1. FastAPI 엔드포인트 현황

| 엔드포인트 | 메서드 | 역할 | 상태 |
|-----------|--------|------|------|
| `/api/recommend/ai` | POST | 온보딩 기반 POI 추천 리스트 반환 | ✅ 구현됨 |
| `/api/recommend/itinerary` | POST | 일정 JSON + 지도 마커 생성 | ✅ 구현됨 |

### 요청 형식 (`/api/recommend/itinerary`)
```json
{
  "duration": "당일치기",
  "artists": ["BTS", "BLACKPINK"],
  "regions": ["서울"],
  "purposes": ["kculture", "food"],
  "budget": { "min": 500000, "max": 2000000 }
}
```

### 응답 형식
```json
{
  "itinerary": [
    {
      "day": 1,
      "morning": { "places": [{"name": "...", "address": "...", "tip": "..."}] },
      "afternoon": { "places": [...] }
    }
  ],
  "mapData": { "markers": [{"name": "...", "lat": 37.55, "lon": 126.98}] },
  "source_pois": [...]
}
```

---

## 2. 추천 파이프라인 상세

### 데이터 소스별 역할

| 소스 | 데이터 | 쿼리 방식 |
|------|--------|----------|
| Neo4j | 아티스트 촬영지 POI (1,073건) | Cypher 쿼리, 아티스트명 매칭 |
| Neo4j | 지역 POI | 지역명 기반 쿼리 |
| ChromaDB | 목적(purpose) 벡터 임베딩 | `intfloat/multilingual-e5-small` 임베딩, 코사인 유사도 검색 |
| Groq LLM | 일정 생성 | POI 리스트 → 자연어 일정 JSON |

### 파이프라인 흐름
```
1. 아티스트별 Neo4j 촬영지 조회 → POI 리스트 A
2. 지역별 Neo4j POI 조회 → POI 리스트 B
3. 목적(purposes)별 ChromaDB 벡터 유사도 검색 → POI 리스트 C
4. A + B + C 합산 + 중복제거 (POI ID 기준)
5. Groq LLM에 POI 리스트 + 여행 조건 전달 → 일정 JSON 생성
6. 응답: itinerary + mapData.markers
```

---

## 3. Spring Boot SDUI 엔드포인트

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/ui/{screenId}` | 화면 메타데이터 트리 반환 (Redis 캐시 1hr) |
| `POST /api/auth/login` | JWT 로그인 |
| `GET /api/query/{sqlKey}` | query_master 동적 SQL 실행 결과 |

### SDUI K-Ride 화면 (Flyway 적용 현황)
| Migration | 내용 | 상태 |
|-----------|------|------|
| V40 | KRIDE_INTRO1~5, MY_LIST, FOCUS 화면 메타데이터 | ✅ 배포 |
| V41 | query_master + DATA_SOURCE 3개 (artistList, regionList, purposeList) | ✅ 배포 |
| V42 | KRIDE_NEXT_BTN 조건부 버튼 | ✅ 배포 |
| V43 | 레이아웃 업데이트 (artist_grid 3열, region_grid chip) | ✅ 배포 |
| V44 | intro1_hero.png → .svg 수정 | ⏳ 미배포 (.ai/ 폴더에 있음) |
| V45 | INTRO4 서브타이틀 단일선택 문구 | ⏳ 미배포 (.ai/ 폴더에 있음) |

---

## 4. Next.js 프록시 설정

`subproject/SDUI/metadata-project/next.config.ts`:
- `/api/*` → `http://localhost:8080` (SDUI Spring Boot)
- FastAPI용 프록시 규칙 아직 없음 (FOCUS 연동 시 추가 필요)

---

## 5. 알려진 문제

| 문제 | 원인 | 상태 |
|------|------|------|
| FOCUS 화면 데이터 비어있음 | `GOTO_FOCUS` 액션에서 FastAPI 미호출 | ⏳ 미해결 |
| FastAPI 로컬에서만 동작 | EC2 미배포 | ⏳ 미해결 |
| V44/V45 미배포 | migration 폴더 이동 필요 | ⏳ 사용자 직접 실행 필요 |
