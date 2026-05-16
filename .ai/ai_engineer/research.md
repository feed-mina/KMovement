# K-Ride AI 파이프라인 분석

> 분석일: 2026-05-16
> 원본 참조: `.ai/agent.md`, `.ai/project_status_and_plan.md`, `.ai/new_research.md`

---

## 1. 데이터 현황 (2026-04-27 기준)

### DB 적재 완료 데이터 (로컬 PG16, port 5434)

| 카테고리 | 데이터 | 건수 | 범위 |
|---------|--------|------|------|
| 맛집 POI | 소상공인 상가 | 803,096건 | ✅ 전국 |
| TourAPI 음식 | contentTypeId=39 | 10,535건 | ✅ 전국 17개 시도 |
| K-Culture 촬영지 | TourAPI | 1,073건 | ✅ 전국 |
| 문화시설 | 박물관/한옥/테마파크 등 | 18,252건 | ✅ 전국 |
| 자전거도로 | data.go.kr | 20,262건 | ✅ 전국 16개 시도 |
| 자전거보관소 | 공공데이터 | 18,277건 | ✅ 전국 |
| 사고다발지 | bicycle + pedestrian CSV | 381 시군구 | ✅ 전국 |
| 날씨 ASOS | 전국 관측소 | 73,426건 | ✅ 전국 67개 관측소 |
| **합계** | — | **~960,000건+** | — |

### 아직 미수집 데이터
| 데이터 | 상태 | 비고 |
|--------|------|------|
| 둘레길 (두루누비) | ⏳ 미수집 | |
| 프리미엄 맛집 (또간집/블루리본) | 🔜 보류 | Kakao/NCP API 권한 문제 |
| AI Hub 전국 여행로그 | ⏳ 미신청 | 수도권 한정 모델 전국화 필요 시 |

---

## 2. ML/DL 모델 현황

### 전국 모델 (서비스 가능)
| 모델 | 알고리즘 | 성능 | 파일 |
|------|---------|------|------|
| WeatherLSTM | LSTM | Acc=82.16%, F1=0.7213 | `models/dl/weather_lstm.pt` |
| 안전점수 회귀 | RandomForest | R²=0.9995 | `models/safety_regressor.pkl` |
| 위험등급 분류 | RandomForest | F1=0.9987 | `models/safety_classifier.pkl` |
| 소비예측 v3 | TabNet | MAE=₩42,764, R²=0.5939 | `models/consume_regressor_v3.zip` |

> 안전 모델: `safety_index_v2` 라벨이 학습 피처로부터 직접 계산됨 (데이터 누수 잔존). API 서비스는 가능하나 재설계 권장.

### 수도권 한정 모델 (⚠️ 전국 서비스 불가)
| 모델 | 알고리즘 | 성능 | 데이터 |
|------|---------|------|--------|
| POI Co-occurrence v2 | Co-occurrence | Recall@5=0.1342 | AI Hub 21,384행 (수도권) |
| POI 매력도 TabNet | TabNet | R²=0.0662 | AI Hub 수도권 한정 |

---

## 3. RAG 파이프라인 분석

### 현재 구성 (FastAPI 서버)

```
입력: { duration, artists, regions, purposes, budget }
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Neo4j 쿼리   Neo4j 쿼리   ChromaDB 검색
  (아티스트 POI) (지역 POI)  (목적 벡터 유사도)
        │           │           │
        └───────────┴───────────┘
                    │
              합산 + 중복제거
                    │
              Groq LLM 호출
                    │
            일정 JSON 생성
                    │
        { itinerary, mapData, source_pois }
```

### 임베딩 모델
- `intfloat/multilingual-e5-small` — 한국어 지원 다국어 임베딩
- ChromaDB 컬렉션: purpose 벡터 (목적별 POI 특성 임베딩)

### Groq LLM
- 역할: POI 리스트 + 여행 조건 → 자연어 일정 JSON 생성
- 출력: `itinerary[].morning.places[]` / `itinerary[].afternoon.places[]`

---

## 4. 시각화 보고서 현황 (report/)

| 모델 | 차트 | 상태 |
|------|------|------|
| WeatherLSTM | Confusion Matrix, 학습곡선 | ✅ 완료 |
| SafetyRegressor/Classifier | 예측 vs 실제, Feature Importance | ✅ 완료 |
| ConsumeTabNet v3 | 소비분포, 피처중요도, 학습곡선, 산점도, 시도분포, v2vs3비교 (차트 16~21) | ✅ 완료 |
| AttractionTabNet | 차트 08~15 (매력도분포/아키텍처/학습곡선/피처중요도/산점도/데이터분할/지도분포/v1vsv2) | ✅ 완료 (2026-05-17) |
| POI Co-occurrence v2 | 차트 5개 (Recall@K/히트맵/Trip분포/카테고리부스팅/요약카드) | ✅ 완료 (2026-05-17) |

### 실행 결과 상세 (2026-05-17)

**POI Co-occurrence v2** (`report/figures/poi_rec_*.png`)

| 지표 | 값 |
|------|-----|
| Recall@5 (Test) | 0.1342 |
| Recall@10 (Test) | 0.1751 |
| Vocab 크기 | 1,646 POI |
| Train trips | 1,775건 |

생성 파일: `poi_rec_recall_bar.png` / `poi_rec_cooccurrence_heat.png` / `poi_rec_trip_dist.png` / `poi_rec_category_boost.png` / `poi_rec_summary.png`

**POI 매력도 TabNet** (`report/charts/08~15.png`)

| 지표 | 값 |
|------|-----|
| MAE | 0.6558 |
| R² | 0.0662 |
| Train | 11,491건 |
| Val | 2,873건 |

⚠️ 비고:
- `pytorch_tabnet` 미설치 → 피처 중요도(차트 11) 추정값으로 대체
- `poi_attraction.csv` 없음 → 지도 분포(차트 14) 더미 데이터로 대체

수정 이력: `MODELS_DIR` 경로 오류(`models/` → `dataset/models/`) 수정 후 정상 실행

---

## 5. 그래프 구조: G vs G_main

> 출처: `src/ml/build_route_graph.py`, `src/api/fastapi_server.py`

`route_graph.pkl`에는 두 개의 NetworkX 그래프가 함께 저장된다.

| 변수 | 정의 | 특징 |
|------|------|------|
| `G` | osmnx로 수집한 서울 자전거 도로 네트워크 **전체** | 여러 개의 연결 컴포넌트 포함. 고립된 노드/단절 구간 존재 가능 |
| `G_main` | G에서 **최대 연결 컴포넌트(LCC)** 만 추출한 서브그래프 | `G.subgraph(largest).copy()` — 모든 노드 간 경로가 보장됨 |

### 왜 두 개를 저장하는가?

- **G**: 원본 전체 데이터 보존용. 통계·메타 정보(총 노드·엣지 수, 컴포넌트 수) 확인 시 사용.
- **G_main**: 실제 경로 탐색에 사용. Dijkstra(`find_route`)·DFS 코스 생성(`generate_course`)은 모든 노드 간 경로 존재가 전제되어야 하므로 LCC만 사용.

### API 서버에서의 사용

```python
G, G_main, graph_meta = _load_graph()   # 둘 다 로드

# find_route, generate_course → G_main만 사용
G_copy = G_main.copy()
reweight_graph(G_copy, req.w_safety, req.w_tourism)
```

`G`는 pkl에 보존되지만 `fastapi_server.py` 내에서 직접 호출되는 엔드포인트는 없음.
`streamlit_kride.py`도 동일하게 `G_main`만 로드하여 사용 (`data.get("G_main")`).

---

## 6. 환경 변수 목록

```bash
KAKAO_REST_API_KEY=...     # 시설 POI 수집
DATABASE_URL=...            # 로컬 PG16 (psycopg2)
VWORLD_API_KEY=...          # 문화시설 지오코딩
JUSO_CONFIRM_KEY=...        # 행안부 JUSO 도로명주소 API
NEO4J_URI=...              # Neo4j AuraDB
GROQ_API_KEY=...           # Groq LLM
```
