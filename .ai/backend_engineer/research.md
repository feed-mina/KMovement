# K-Ride Backend 분석

> 분석일: 2026-05-16
> 최종 수정: 2026-05-19
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
| V44 | intro1_hero.png → .svg 수정 | ✅ 배포 |
| V45 | INTRO4 서브타이틀 단일선택 문구 | ✅ 배포 |
| V46 | INTRO1/2/3 레이아웃 개선 (sticky 헤더, region_grid → grid-cols-4, TYPEWRITER_TEXT) | ✅ 배포 |
| V47 | INTRO3 title TEXT 복원, INTRO4 sticky/z-50 수정 | ✅ 배포 |

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

---

## 6. 데이터 클라이언트 ↔ 실제 DB 구조 불일치 분석 — 2026-05-19 [완료]

### Supabase 실제 테이블 구조

| 테이블 | 용도 | 주요 컬럼 |
|--------|------|----------|
| `nodes` | POI + Artist 혼합 저장 | `id` (poi_*, artist_*), `metadata` (jsonb: name, lat, lon, address, category 등) |
| `edges` | 관계 저장 | `source` (poi_*), `target` (artist_*), `relation_type` ("FILMING_AT") |

- ~~`artist`, `poi`, `artist_poi` 테이블은 존재하지 않음~~ (코드가 잘못 참조하고 있었음 → 수정 완료)

### Neo4j 실제 그래프 구조

| 항목 | 값 |
|------|------|
| 관계 방향 | `(POI)-[:FILMING_AT]->(Artist)` (POI→Artist) |
| Artist 식별 | `a.id = "artist_1"`, `a.name = "선재 업고 튀어"` (name 기반 매칭 필요) |
| Region 노드 | ❌ 존재하지 않음 (마이그레이션 미실행) → `p.address CONTAINS` 로 대체 |

### 적재된 아티스트 목록

**드라마 (artist_1~20, 기존):**
artist_1~20: 선재 업고 튀어, 눈물의 여왕, 도깨비, 이태원 클라쓰, 갯마을 차차차, 이상한 변호사 우영우, 킹더랜드, 응답하라 1988, 빈센조, 무빙, 우리들의 블루스, 스물다섯 스물하나, 환혼, 나의 아저씨, 폭싹 속았수다 등

**K-pop (artist_21~40, 2026-05-19 추가):**
방탄소년단(BTS), 블랙핑크(BLACKPINK), 세븐틴(SEVENTEEN), 슈퍼주니어(SUPER JUNIOR), 트와이스(TWICE), 동방신기(TVXQ), BTOB, 소녀시대(Girls' Generation), 엑소(EXO), 레드벨벳(Red Velvet), NCT, 에이핑크(Apink), 오마이걸(OH MY GIRL), 샤이니(SHINee), 마마무(MAMAMOO), 아이유(IU), TXT, 스트레이키즈(Stray Kids), Itzy(ITZY), 아이브(IVE)

---

## 7. K-pop 아티스트 데이터 적재 — 2026-05-19 [진행 중]

### 데이터 소스

`kcisa_media_locations_2023.csv` (프로젝트 루트, 1,963행, 134개 K-pop 아티스트)
- 컬럼: 미디어타입, 아티스트, 장소명, 장소타입, 장소설명, 영업시간, 주소, 위도, 경도 등
- 위도/경도 포함 → 지오코딩 불필요

### 적재 파이프라인 실행 결과

| 단계 | 결과 | 상태 |
|------|------|------|
| PostgreSQL 적재 (`load_kcisa_kpop_data.py`) | artist 20건(id=21~40), POI 787건, link 883건 | ✅ 완료 |
| 그래프 빌더 1차 실행 | Artist 20 + Edge 99 (POI 누락 — `kpop` category 필터 버그) | ✅ 완료 (버그 발견) |
| 그래프 빌더 category 수정 | `WHERE category IN ('tourism','kculture','kpop')` | ✅ 완료 |
| 그래프 빌더 2차 실행 | 39,624노드, 816엣지 (K-pop POI 495건 포함) | ✅ 완료 |
| 기존 JSON Colab 마이그레이션 | 1,962건 (구 JSON, 드라마만) | ✅ 완료 |
| Delta JSON 추출 | Artist 20 + POI 495 + Edge 641 = 1,156건 | ✅ 완료 |
| Delta Colab 마이그레이션 | delta 파일로 K-pop만 추가 | ✅ 완료 |
| 인코딩 수정 | `fix_kpop_encoding.py` 로컬→Neo4j+Supabase upsert | ✅ 완료 |
| .env Neo4j 인스턴스 갱신 | `a1880d39` 인스턴스로 변경 | ✅ 완료 |

### 빌더 버그: K-pop POI category 누락

`kride_graph_builder.py`가 `WHERE category IN ('tourism', 'kculture')`만 조회.
`load_kcisa_kpop_data.py`는 `category='kpop'`으로 적재 → 빌더에서 제외됨.

수정: `'kpop'` 추가 → 2차 빌드에서 POI 495건 + Edge 641건 정상 포함.

### Delta 마이그레이션 전략

전체 3.9만건 재실행 대신 K-pop 추가분만 별도 마이그레이션.

| 파일 | 경로 | 내용 |
|------|------|------|
| 전체 JSON (구) | `dataset/models/kride_graph.json` | 39,109노드 (May 4, 드라마만) |
| 전체 JSON (신) | `models/kride_graph.json` | 39,624노드 (May 19, 드라마+K-pop) |
| **Delta JSON** | `models/kride_graph_delta.json` | **515노드 + 641엣지** (K-pop만) |

### PostgreSQL에서 K-pop POI가 787건인데 Delta에 495건인 이유

787건 중 일부(292건)는 기존 `kculture`/`tourism` POI와 이름이 같아 `load_kcisa_kpop_data.py`에서 기존 POI ID를 재사용.
→ 그래프 빌더가 기존 노드로 이미 포함 → Delta에서 제외 (정상 동작)

---

## 8. 확장 모듈 파일 맵 — 2026-05-19

### 챗봇 서비스 (`subproject/NLP/chatbot/`)

| 파일 | 역할 | 핵심 클래스/함수 |
|------|------|----------------|
| `config.py` | 공통 설정 | `CHROMA_PATH`, `PDF_COLLECTION`, `RERANKER_MODEL`, `GROQ_MODEL` |
| `pdf_ingest.py` | PDF → ChromaDB 인덱싱 | `ingest()` — PyPDFLoader → 청크 → 임베딩 → upsert |
| `reranker.py` | CrossEncoder 래퍼 | `Reranker.rerank(query, passages)` |
| `reranker_comparison.py` | MiniLM vs BGE 벤치마크 | `run_comparison()` → `.ai/memo/reranker_comparison.md` |
| `multi_query.py` | Groq 쿼리 변형 | `generate_query_variants(query)` → [원본, 변형1, 변형2, 변형3] |
| `chatbot_chain.py` | RAG 파이프라인 | `chat(message, session_id)` → {reply, sources, pois} |
| `chatbot_server.py` | FastAPI :8001 | `/chat`, `/chat/reset`, `/health` |

### ML 모듈 (`src/ml/`)

| 파일 | 역할 | 핵심 함수 |
|------|------|----------|
| `feature_engineering.py` | 8-feature 벡터 | `compute_features(poi, ...)` → np.ndarray(8,) |
| `build_ensemble_ranker.py` | 학습 + 비교 | `main()` → LightGBM vs XGBoost → `models/ensemble_ranker.pkl` |

### 추론 래퍼 (`src/api/`)

| 파일 | 역할 | 핵심 함수 |
|------|------|----------|
| `ensemble_client.py` | 앙상블 랭킹 | `rank_pois(neo4j_pois, chroma_pois, ...)` → top-K POI |

### ChromaDB 컬렉션 현황

| 컬렉션 | 용도 | 데이터 수 |
|--------|------|----------|
| `kride_poi_kculture` | K-Culture POI | 기존 |
| `kride_poi_food` | 음식 POI | 기존 |
| `kride_poi_nature` | 자연 POI | 기존 |
| `kride_poi_history` | 역사 POI | 기존 |
| **`kride_pdf_knowledge`** | **관광 PDF 지식** | **4,636 chunks (신규)** |

### 리랭커 비교 결과 요약

- **MiniLM** (`cross-encoder/ms-marco-MiniLM-L-6-v2`): 22M params, 평균 3.5초/쿼리 (CPU)
- **BGE-M3** (`BAAI/bge-reranker-v2-m3`): 560M params, 평균 96초/쿼리 (CPU, 27배 느림)
- **채택: MiniLM** — CPU 환경 기준. GPU 서버 배포 시 BGE-M3 전환 고려.

### 앙상블 학습 결과 요약

- 데이터: 3,873 샘플 (200 쿼리) — 더미 데이터 (ChromaDB POI 경로 불일치)
- **LightGBM 우승** → `models/ensemble_ranker.pkl`
- NDCG@5/10 = 1.0, MAP@5 = 1.0, Recall@5 = 0.88 (더미 데이터라 양 모델 동점)
- 실제 데이터 재학습 시 유의미한 차이 예상

---

## 9. 단위 테스트 현황 — 2026-05-20

### 테스트 파일 맵

| 파일 | 테스트 수 | 커버 대상 |
|------|----------|----------|
| `tests/test_fastapi.py` | 36 | FastAPI 엔드포인트 (health, artists, regions, recommend, itinerary, weather) + 앙상블 통합 |
| `tests/test_chatbot_server.py` | 25 | Reranker, MultiQuery, ChatbotChain, ChatbotServer (:8001) |
| `tests/test_ensemble.py` | 28 | haversine, compute_features(8-feature), rank_pois, NDCG/Recall/MAP 메트릭 |
| `tests/test_pdf_ingest.py` | 14 | build_chunk_id, load_pdfs, chunk_documents, ingest 파이프라인 |
| `src/api/test_fastapi.py` | 23 | FastAPI 서버 (stub 기반, 독립) |
| `src/api/test_contract.py` | 14 | FastAPI ↔ Spring Boot 계약 테스트 (서버 필요) |

**총 103개 단위 테스트, 전체 통과 (2026-05-20)**

### 테스트 실행 방법

```bash
# 전체 (서버 없이 실행 가능)
pytest tests/ -v

# 개별
pytest tests/test_chatbot_server.py -v
pytest tests/test_ensemble.py -v
pytest tests/test_pdf_ingest.py -v

# 계약 테스트 (FastAPI:8000 + Spring Boot:8080 실행 필요)
pytest src/api/test_contract.py -v -m contract
```

### 테스트 기법 요약

| 기법 | 설명 | 사용처 |
|------|------|--------|
| **TestClient (ASGI 직접 호출)** | HTTP 서버 없이 메모리 내 앱 함수 직접 호출 | test_fastapi, test_chatbot_server |
| **MagicMock** | 외부 API(Groq, Neo4j 등) 가짜 객체로 대체 | 전체 |
| **Stub** | 미설치 패키지를 빈 모듈로 등록 (import 에러 방지) | chromadb, neo4j, sentence_transformers |
| **patch()** | 특정 함수/변수를 테스트 중 임시 교체 | HAS_AI, HAS_ENSEMBLE 등 |
| **fixture** | 테스트 전후 상태 초기화 (autouse) | ensemble_client._model_data 리셋 |

### 서버 코드 Fallback 패턴 (테스트에서 확인된 동작)

| 엔드포인트 | 실패 시 동작 |
|-----------|------------|
| `GET /api/artists` | `HAS_AI=False` 또는 예외 → FALLBACK_ARTISTS(30명) 반환 |
| `GET /api/regions` | `HAS_AI=False` 또는 예외 → FALLBACK_REGIONS(17개) 반환 |
| `POST /api/recommend/itinerary` | Groq 실패 → `{"itinerary": []}` 빈 일정 반환 |
| `POST /api/recommend/itinerary` | 앙상블 실패 → union 방식 fallback |
| `POST /api/recommend/ai` | Neo4j/ChromaDB 개별 실패 → 나머지 소스로 결과 반환 |
