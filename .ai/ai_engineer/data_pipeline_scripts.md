# K-Ride AI 데이터 파이프라인 스크립트 분석

> 원본 출처: `.ai/kride.txt` 종합 탐색 보고서 (2026-05-11)

---

## 1. GraphRAG (지식 그래프) 현황

| 항목 | 수치 |
|------|------|
| 전체 노드 수 | 39,109개 |
| POI 노드 | 39,089개 (관광지, 촬영지 등) |
| 아티스트 노드 | 20개 (드라마/가수 등) |
| 전체 관계(엣지) 수 | 175개 (FILMING_AT 관계) |
| 커뮤니티 수 | 38,934개 (대부분 독립 장소, 드라마 연결 장소가 핵심 커뮤니티) |

그래프 파일 위치:
- `models/kride_graph.graphml` — Gephi, Cytoscape 등 시각화 도구용
- `models/kride_graph.json` — 노드 속성(커뮤니티 번호 포함) JSON

> ⚠️ 주의: `models/kride_graph.json` 파일 직접 참조 방식은 데이터 증가 시 서버 메모리 부담 증가.
> 개선 방향: [DB 쿼리 → 필요한 서브 그래프 추출 → NetworkX 계산] 방식으로 전환 필요.

---

## 2. PostgreSQL POI 현황 (로컬 PG16, port 5434)

| 카테고리 | 건수 |
|---------|------|
| 음식점 (food) | 813,631건 |
| K-Culture (kculture) | 23,184건 (촬영지·성지) |
| 편의시설 (facility) | 21,645건 |
| 관광지 (tourism) | 15,905건 |
| **합계** | **~874,000건+** |

등록 아티스트: 20명  
아티스트-POI 연결 수: 178개 (일부 장소가 여러 드라마에 등장)

---

## 3. ChromaDB (벡터 데이터베이스) 현황

저장 위치: 프로젝트 루트 `chroma_db/` 폴더

```
chroma_db/
├── chroma.sqlite3                              ← 메타데이터 저장소
└── [4개 UUID 폴더들]
    ├── bb6eff76-c6ad-4ed4-9115-736a86d8536c/   ← HNSW 벡터 인덱스
    │   ├── data_level0.bin
    │   ├── header.bin
    │   ├── index_metadata.pickle
    │   ├── length.bin
    │   └── link_lists.bin
    ├── bc46fb1b-56b4-4bab-b383-956cd92faba8/
    ├── d779f5e7-3653-4996-a086-d4b58e7e4d4c/
    └── f7a85494-ff0d-4fc4-987a-ee7c4acf7729/
```

- 4개의 HNSW 벡터 인덱스 (각각 별도 컬렉션)
- SQLite3 메타데이터 저장소
- 임베딩 모델: `intfloat/multilingual-e5-small` (384차원, 한/영/일 지원)

---

## 4. RAG/LLM 기술 스택

| 계층 | 구성 | 파일 |
|------|------|------|
| LLM 백엔드 | Groq API (openai/gpt-oss-120b 또는 llama-3.3-70b-versatile) | `rag_groq_pipeline.py` |
| 임베딩 모델 | intfloat/multilingual-e5-small (384차원) | `scripts/*.py` |
| 벡터DB (선택 1) | ChromaDB (HNSW 로컬) | `load_chroma_from_colab.py` |
| 벡터DB (선택 2) | PostgreSQL pgvector (IVFFlat 인덱스) | `load_pgvector_from_colab.py` |
| 지식 그래프 | Neo4j Aura (클라우드) | `.ai/Neo4j-*.txt` |
| 실험 추적 | MLflow (SQLite 백엔드) | `rag_*_pipeline.py` |
| 다국어 | 한/영/일 지원 | `test_rag_pipeline.py` |

---

## 5. scripts/ 폴더 — 스크립트 목록 및 역할

### 5-1. RAG 파이프라인

#### `rag_groq_pipeline.py` (474줄)
- Groq API 기반 RAG 파이프라인 (응답 시간 1~2초)
- 10개 샘플 POI로 ChromaDB 컬렉션 생성
- 다국어(한/영/일) 임베딩 유사도 테스트
- RAG 기반 한국 여행 추천
- 벡터 검색 평가: Recall@1, avg_similarity
- 실행: `python scripts/rag_groq_pipeline.py`

#### `rag_pgvector_pipeline.py` (407줄)
- PostgreSQL pgvector 기반 RAG (874K POI 전체 인덱싱)
- pgvector 연산자: `embedding <=> vector`
- 벡터 검색 평가: 평균 유사도, 검색 시간
- 파라미터: `TOP_K=5`

#### `setup_pgvector.py` (52줄)
- PostgreSQL에 pgvector 확장 활성화
- `poi` 테이블에 `embedding(vector(384))` 컬럼 추가
- 임베딩 상태 확인 (있음/없음 통계)
- 선제 조건: `load_pgvector_from_colab.py` 실행 필요

#### `load_chroma_from_colab.py` (127줄)
- Colab 임베딩 결과 → 로컬 ChromaDB 로드
- 입력: `data/poi_embeddings.npy`, `data/poi_metadata.parquet`
- 배치 삽입 (1,000개씩)
- ChromaDB 컬렉션 `kride_poi_full` 생성
- 검색 테스트 (BTS, 전통시장 등)

#### `load_pgvector_from_colab.py` (152줄)
- Colab 임베딩 결과 → PostgreSQL pgvector 로드
- pgvector 문자열 포맷 변환 후 `poi` 테이블 `embedding` 컬럼 업데이트 (배치)
- IVFFlat 인덱스 생성 (검색 가속)
- 로드 시간: 수분 소요

---

### 5-2. 데이터 수집

#### `collect_durunubi_data.py` (392줄)
두루누비(한국 둘레길) 데이터 수집 — 3 Phase 구성:
- Phase 1: 두루누비 공공 API (routeList, courseList)
- Phase 2: durunubi.kr 웹 크롤링 (이미지)
- Phase 3: 데이터 병합 & JSON/CSV 저장

출력 경로: `e:/krider/kride-project/data/durunubi`  
생성 파일: `routes_YYYYMMDD_HHMMSS.json/csv`, `courses_YYYYMMDD_HHMMSS.json/csv`

#### `collect_durunubi_v2.py`
- 재시도 로직 강화 (`max_retries=3`)
- 딜레이 강화 (`API_DELAY=2.0초`)
- 403 에러 처리 (지수 백오프)
- `PAGE_SIZE` 감소 (100 → 50)

#### `crawl_trail_images.py`
- Selenium WebDriver로 두루누비 road-walk.do에서 540개 이미지 크롤링
- 추출: 트레일 이름, 이미지(src/data-src), 상세 ID (onclick 정규식)

#### `download_celeb_images.py`
- 아이돌/배우 프로필 이미지 DuckDuckGo에서 다운로드
- 카테고리: kpop_groups (BTS, BLACKPINK, Stray Kids 등 24개), kpop_solo (IU, Zico, Rose 등), actors (Lee Min Ho, Song Hye Kyo 등), content (Squid Game, The Glory 등)
- 출력: `e:/krider/kride-project/images`

---

### 5-3. 유틸리티

#### `export_poi_for_colab.py` (74줄)
- PostgreSQL → CSV 내보내기 (Colab 임베딩용)
- 출력: `data/poi_for_embedding.csv` (~150MB)
- 스트리밍 커서로 대용량 처리, ST_Y/ST_X로 lat/lon 변환

#### `test_rag_pipeline.py` (502줄)
- Ollama + RAG 파이프라인 테스트 (MLflow 추적)
- 8단계: 패키지 설치 → Ollama 확인 → LLM 대화 → 임베딩 → ChromaDB → 벡터 검색 → RAG 추천(3개 언어) → PostgreSQL 테스트
- 이전 Ollama 응답 시간: ~46초 (Groq로 전환 후 1~2초)

---

## 6. src/ 폴더 구조

```
src/
├── dl/          딥러닝: build_weather_lstm.py, build_consume_model_v2.py 등
├── ml/          머신러닝: build_safety_model.py, build_poi_recommender_v2.py 등
├── preprocessing/  전처리 스크립트
├── db/          데이터베이스 관련
├── api/         FastAPI 서버 (fastapi_server.py, test_fastapi.py 등)
├── app/         Streamlit 앱
└── report/
    └── check_rag_status.py  ← RAG/GraphRAG 상태 확인 (유일)
```

`check_rag_status.py` 역할:
1. GraphRAG: `models/kride_graph.json` 로드 → 노드/엣지/커뮤니티 계산
2. VectorDB: `./chroma_db` 컬렉션별 임베딩 문서 수 확인
3. Relational DB: artist, artist_poi, poi 카테고리 통계

---

## 7. notebooks/ 폴더

| 파일 | 크기 | 내용 |
|------|------|------|
| `01_ollama_rag_tutorial.ipynb` | 33KB | Ollama + RAG 입문 튜토리얼 (STEP 0: 패키지 설치 → STEP 1: Ollama 연결 → STEP 2+: 임베딩, ChromaDB, RAG) |
| `colab_embed_poi.py` | 3B | 비어있거나 매우 짧음 |
| `neo4j_data_loader.ipynb` | 15KB | Neo4j 데이터 로더 |

---

## 8. Firebase 하이브리드 전략

Neo4j 도입 후에도 Firebase를 완전히 대체하지 않는 하이브리드 구조 채택:

| 역할 | 서비스 |
|------|--------|
| 인증 (Login) | Firebase Auth (유지) |
| 이미지 저장 | Firebase Storage (유지) |
| 비즈니스 데이터 (영화, 인맥, 추천) | Neo4j로 전환 |

---

## 9. 아키텍처 개선 권장 사항 (kride.txt 기록)

1. **DB 파편화 해소**: 현재 [PostgreSQL + ChromaDB + Local JSON/GraphML] 3분산 → Supabase(PostgreSQL)로 통합 검토
2. **파일 기반 GraphRAG 탈피**: `models/kride_graph.json` 직접 참조 → DB 쿼리 기반 동적 서브 그래프 추출로 전환
3. **벡터 용량**: 87만 건 전체 임베딩(1536차원) = 5~6GB → Supabase Pro 플랜 필요 ($25/월)
