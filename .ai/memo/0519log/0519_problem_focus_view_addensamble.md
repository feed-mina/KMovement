# 0519 — FOCUS 뷰 문제 + 앙상블 모델 도입 계획

## 현재 문제 요약

### 1. `/api/artists` 가 POI 반환
- Supabase `nodes` 테이블에서 `id LIKE 'artist_%'` 조회 시 아티스트가 아닌 POI 메타데이터가 섞여 나옴
- FALLBACK_ARTISTS가 5명뿐 → INTRO2의 20명과 불일치
- **수정:** FALLBACK_ARTISTS를 20명으로 확장, Supabase 쿼리 검증 추가

### 2. Neo4j DatabaseNotFound (수정 완료, 재시작 필요)
- `.env`: `NEO4J_DATABASE=` (빈값으로 변경)
- `neo4j_client.py`: `db = os.environ.get("NEO4J_DATABASE", "") or None`
- 재시작 후 디버그 로그에서 `artist_pois: N건` 확인 필요

### 3. FOCUS 일정 빈 결과
- Neo4j 연결 실패 → 0건 POI → Groq LLM에 빈 컨텍스트 → 빈 일정
- Neo4j 수정 후 POI 데이터가 정상 반환되면 해결 예상

---

## 앙상블 모델 도입 계획

### 아키텍처: Stacking (메타 러너)

```
[Before]
Neo4j → ─┐
ChromaDB → ─── union(중복제거) ─── Groq LLM ─── itinerary JSON
          ┘

[After]
Neo4j → ──────┐
ChromaDB → ───── ensemble_client.rank_pois() ─── top-K POIs ─── Groq LLM ─── itinerary
Co-occ → ─────┘   (LightGBM feature + predict)
```

### Level-0 (Base Models) — 3개

| # | 모델 | 소스 파일 | 출력 |
|---|------|----------|------|
| 1 | **Neo4j Graph** | `src/api/neo4j_client.py` → `get_artist_pois()` + `get_region_pois()` | 관계 기반 POI + hit=1/0 |
| 2 | **ChromaDB Vector** | `src/api/rag_client.py` → `search_pois_by_purpose()` | similarity score (0~1) |
| 3 | **Co-occurrence Jaccard** | `src/ml/build_poi_recommender_v2.py` → `models/poi_cooccurrence_v2.pkl` | jaccard score |

### Level-1 (Meta Learner) — LightGBM Ranker

**Feature vector (8차원):**

| Feature | 설명 | 범위 |
|---------|------|------|
| `neo4j_hit` | Neo4j에서 반환된 POI 여부 | 0/1 |
| `neo4j_artist_count` | 해당 POI와 연결된 선택 아티스트 수 | 0~N |
| `chroma_similarity` | ChromaDB 코사인 유사도 | 0~1 |
| `jaccard_score` | Co-occurrence Jaccard 점수 | 0~1 |
| `category_match` | 사용자 목적과 POI 카테고리 일치 | 0/1 |
| `region_match` | 선택 지역과 POI 주소 일치 | 0/1 |
| `distance_km` | 선택 지역 중심에서의 거리 | 0~∞ |
| `budget_fit` | 예산 범위 내 여부 | 0/1 |

**학습 데이터:** AI-Hub 여행로그 (`tn_visit_area_info_*.csv`)
- Positive: 같은 TRAVEL_ID 내 함께 방문한 POI
- Negative: 같은 지역의 미방문 POI (랜덤 샘플링)

### 신규/수정 파일

| 파일 | 역할 | 상태 |
|------|------|------|
| `src/ml/build_ensemble_ranker.py` | LightGBM 학습 → `models/ensemble_ranker.pkl` | 신규 |
| `src/api/ensemble_client.py` | 추론 래퍼 (pkl 로드 + rank_pois) | 신규 |
| `src/api/fastapi_server.py` | itinerary에 앙상블 통합 | 수정 |
| `src/api/fastapi_server.py` | FALLBACK_ARTISTS 20명 확장 | 수정 |
| `src/api/supabase_client.py` | get_all_artists() 검증 강화 | 수정 |

### 구현 순서

1. `/api/artists` 수정 — FALLBACK_ARTISTS 20명 확장
2. `build_ensemble_ranker.py` — LightGBM 학습 스크립트
3. `ensemble_client.py` — 추론 래퍼
4. `fastapi_server.py` — itinerary 앙상블 통합
5. 문서 업데이트

### 검증

```bash
# 1. 앙상블 모델 학습
python src/ml/build_ensemble_ranker.py
# → models/ensemble_ranker.pkl 생성

# 2. FastAPI 재시작 후
curl -s http://localhost:8000/api/artists   # 20명 반환
curl -s http://localhost:8000/api/health     # 서버 상태

# 3. FOCUS 일정 생성 테스트
# 디버그 로그: [K-Ride] ensemble ranked: N건
```
