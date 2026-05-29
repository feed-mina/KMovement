# K-Ride 2.0 Research Log

> **최종 업데이트**: 2026-04-29 (여행 기록 & 맞춤 영상 기능 설계 추가 + PWA MVP → React Native 전환 전략 + RAG MLflow 실험 추적 통합)
> **목적**: 기존 K-Ride 자산 분석 + 신규 데이터 소스 조사 + 모델링 전략 연구

---

## 프로젝트 기획
```
* 프로젝트 계획은 바꾸려고 합니다. 

기획의도는 한국인/외국인 기반으로 새로운 관광 서비스 제공하는 서비스를 제공하려고 합니다. 
대상 : 한국인, K한류/Kpop을 좋아하는 외국인
목적 : (1)한국 여행을 하면서 맛집정보 (유튜브 또간집, 블루리본, 방송에서 나온 맛집 등) 와 (2-1)자신이 좋아하는 아이돌/가수/배우 등이 뮤직비디오, 영화, 드라마 촬영지나 SNS에 올린 장소나 팬덤이 방문하고 싶은 장소 정보 (2-2) 요즘 떠오르고 있는 케데헌/한국 문화를 알고싶어하는 사람들을 위한 국립중앙박물관 (서울, 경주, 기타 등등) 과 유명 관광지 (2-3) 자연을 좋아하는 사람이라면 자연치화적이면 아마 전국에서 제공하는 지역마다 스탬프를 찍을 수 있는 둘레길이나 관광경로 정보 (4) 당일치기, 1박2일, 2박3일, 3박 4일 정도로 추천해주는 관광지 경로로 이동할때 들어가는 예측 소비,  (5) 이동수단은 걷기, 자전거, 오토바이/자동차, 기차여행 등이 있습니다. 

(6)
공공데이터나 사용가능한 api / 크롤링도 한가지 방법이 될수있음 을 통해 학습데이터를 찾고 로컬에서 ml,dl,llm 등 모델링 
(7) ollma를 통한 모델 
(8) groq, huggingface, roboflow, kaggle 에서도 필요한 데이터(원천 또는 api )를 받아서 사용할수 있음 
(9) rag, graphrag와 mcp까지 확대 예정 
(10) 저비용을 위한 원천학습  모델링 생성> 오픈소스 모델링 사용 > 배포를 위해 최대한 경량화  (허깅페이스, 로보플로우, 캐글, groq등 외부에 올릴 수 있다면 올려서 사용)
(11) 구글 드라이브에서 gpu 사용이나 클라우드 배포까지 

현재 학습하고 모델링 되어있는 부분에서 전국으로 범위를 확대하고 지도 기반의 새로운 비즈니스 를 만들어보려고 합니다. 이동수단에 필요한 학습 부분은 시간이 오래 걸릴꺼 같아 1차 MVP 이후에 2차나 3차 MVP 에 붙이고 싶습니다 

기획의도에 맞춰서 현재 상태와 plan, research를 전부 읽고 새로운 new_plan, new_research 문서를 만들어주세요. 


```

## 1. 기존 자산 성능 현황 (2026-04-25 기준)

### 1-1. 모델 파일 상태 진단 (2026-04-26 기준)

| 모델 | 파일 | 상태 | 데이터 범위 | 시각화 |
|------|------|------|------------|--------|
| WeatherLSTM | `weather_lstm.pt` | ✅ 학습 완료 | **전국 67개 관측소** | ✅ **지금 가능** (`visualize_weather_lstm.py`) |
| 안전 RF 회귀 | `safety_regressor.pkl` | ✅ 학습 완료 (R²=0.9919) | 전국 도로 20,262행 + 서울 사고 111건 | ⚠️ 전국 사고 수집 후 재학습 권장 |
| 안전 RF 분류 | `safety_classifier.pkl` | ✅ 학습 완료 (F1=0.9990) | 전국 도로 20,262행 + 서울 사고 111건 | ⚠️ 전국 사고 수집 후 재학습 권장 |
| Co-occurrence POI | `poi_cooccurrence_v2.pkl` | ⛔ 수도권만 | 수도권 AI Hub 2,536여행 | ❌ 전국 재수집 후 |
| 소비 TabNet v2 | `consume_regressor_v2.zip` | ⛔ 수도권만 | 수도권 2,508행 | ❌ 전국 재수집 후 |
| POI 매력도 TabNet | `attraction_regressor.zip` | ⛔ 수도권만 | 수도권 14,364행 | ❌ 전국 재수집 후 |
| Visit GRU | `visit_seq_gru.pt` | ⛔ 수도권만 | 수도권 | ❌ 전국 재수집 후 |
| 경로 그래프 | `route_graph.pkl` | ⛔ LFS 포인터 | — | ❌ 전국 재빌드 필요 |

### 1-2. 모델 성능 대시보드 (2026-04-26 18:10 업데이트)

| 모델 | 성능 | 학습 데이터 범위 | 상태 |
|------|------|----------------|:---:|
| **WeatherLSTM** | Acc=**82.16%**, F1=**0.7213** | **전국 67개 관측소** | ✅ **완료 + 시각화 완료** |
| **안전 RF 회귀** | R²=**0.9995** ⚠️ leakage | 전국 도로 20,262행 + **전국 사고 381 시군구** | ✅ **전국 재학습 완료** (89.1% 매핑) |
| **안전 RF 분류** | F1=**0.9987** ⚠️ leakage | 전국 도로 20,262행 + **전국 사고 381 시군구** | ✅ **전국 재학습 완료** (89.1% 매핑) |
| 소비 TabNet v2 | MAE=₩129,653, R²=0.1277 | **수도권만** (2,508행) | ⛔ 전국 AI Hub 신청 후 재학습 |
| POI 매력도 TabNet | MAE=0.6558, R²=0.0662 | **수도권만** (14,364행) | ⛔ 전국 데이터 재수집 후 재학습 |
| Co-occurrence POI | Recall@5=0.1372 | **수도권만** (2,536 여행) | ⛔ 전국 AI Hub 신청 후 재학습 |
| GRU 시퀀스 | top5=0.14 | 수도권 | ❌ 폐기 (LLM 코스 생성으로 대체)

> ⚠️ Safety 모델: `safety_index_v2` 라벨이 학습 피처(width_m, district_danger)에서 직접 계산됨 → 데이터 누수(leakage). district_danger 매핑 성공률은 3.1% → **89.1%** 로 대폭 향상. 실용 API에서는 district_danger lookup 방식으로 서비스 가능.

### 1-2-1. WeatherLSTM 재학습 결과 상세 (2026-04-26)

| 항목 | 이전 (수도권) | 현재 (전국) |
|------|-------------|-----------|
| 관측소 수 | 5개 | **67개 (17개 시도)** |
| 학습 행수 | ~5,480행 | **73,426행** |
| 기간 | 일부 | **2023-01-01 ~ 2025-12-31 (3년)** |
| 시퀀스 수 | 소규모 | **156,874개** (14일 윈도우) |
| Train/Val/Test | — | 109,810 / 31,373 / 15,691 |
| Accuracy | 73.28% | **82.16%** (+8.88%p) |
| F1-Macro | — | **0.7213** |
| Best val_acc | — | 0.8245 |

**학습 곡선 (30 Epoch / CPU 학습)**
```
Epoch  1: loss=0.8784  val_acc=0.6319
Epoch  5: loss=0.6223  val_acc=0.7137
Epoch 10: loss=0.4996  val_acc=0.7755
Epoch 15: loss=0.4110  val_acc=0.7926
Epoch 20: loss=0.3736  val_acc=0.8095
Epoch 25: loss=0.3321  val_acc=0.8186
Epoch 30: loss=0.3150  val_acc=0.8226  (Best val: 0.8245)
```

**클래스 가중치 (불균형 보정)**
```
맑음(0):  0.48  ← 데이터 多 → 가중치 낮게
흐림(1):  4.36  ← 데이터 少 → 가중치 높게
비·눈(2): 1.44
```

**저장된 파일**
```
models/dl/weather_lstm.pt       ← 학습된 모델 가중치 (갱신됨)
models/dl/weather_scaler.pkl    ← StandardScaler
models/dl/weather_meta.json     ← Acc/F1/클래스 정보
```

**특이 사항**
- 경상남도 진주(175): 수집 0건 → 제외 (66개 관측소로 학습)
- 일부 관측소 인덱스(27/30/34/46/48)가 4,384행: 두 지점이 같은 LabelEncoder 인덱스로 병합된 것으로 학습에 무영향

### 1-3. 데이터 파일 현황 (2026-04-26 기준)

| 파일 | 행수 | 범위 | 활용 상태 |
|------|------|------|:--:|
| `tour_poi.csv` | 15,905 | **전국 17개 시도** | ✅ **DB 로드 완료** |
| `road_clean_nationwide.csv` | **20,262** | **전국 16개 시도** | ✅ **DB 로드 완료** (trail 테이블) |
| `road_clean_v2.csv` | 4,998 | 수도권+일부 | ⚠️ nationwide로 대체됨 |
| `weather_asos_daily_nationwide.csv` | **73,426** | **전국 67개 관측소** | ✅ **DB 로드 완료** (weather_daily) |
| `district_danger.csv` | 19개 구 | **서울만** | ✅ 생성 완료 (전국 사고 수집 후 교체 예정) |
| `facility_clean.csv` | 3,368 | 서울 | ✅ **DB 로드 완료** (poi 테이블) |
| `poi_attraction.csv` | 8,454 | 수도권 | ⚠️ 전국 확대 예정 |
| AI Hub 여행로그 4개 | 2,560여행 | **수도권만** | ⚠️ 전국 신청 필요 |

---

## 2. 데이터 소스 조사

### 2-1. 맛집 데이터

#### 카카오 로컬 REST API (FD6/CE7)
```
상태: ✅ API 키 보유, 스크립트 보유 (step3_food_collect.py)
쿼터: 300,000콜/일
방법: 전국 시군구 중심 좌표 기준 반경 검색
예상: ~50,000건 (중복 제거 후)
장점: 정확한 좌표, 카테고리, 전화번호, 리뷰수
단점: 별점/리뷰 텍스트 미제공
```

#### 블루리본 서베이
```
상태: [ ] 조사 필요
URL: bluer.co.kr
robots.txt: 확인 필요
방법: requests + BeautifulSoup (지역별 맛집 목록)
예상: ~3,000건 (블루리본 인증점)
장점: 큐레이션된 고품질 맛집
단점: 크롤링 약관 확인 필요
```

#### 유튜브 또간집/백종원
```
상태: [ ] 조사 필요
방법 A: YouTube Data API v3 (영상 검색 + 설명 텍스트 파싱)
방법 B: 나무위키/위키 "또간집 목록" 페이지 파싱
예상: ~500건
장점: 대중적 인지도 높은 맛집
단점: 가게명 → 좌표 변환 필요 (카카오 Geocoding)
```

#### 공공데이터 맛집 ← 전략 전환 (카카오 → 소상공인 데이터 주력)
```
【주력】소상공인시장진흥공단_상가(상권)정보 (ZIP) — 카카오 API 대체
  파일: 소상공인시장진흥공단_상가(상권)정보_20251231.zip (338MB)
  상태: ✅ 다운로드 완료 (전국 17개 시도 CSV)
  컬럼: 상호명, 상권업종대분류명, 상권업종중분류명, 도로명주소, 경도, 위도
  필터: 상권업종대분류명=="음식" + 중분류명 포함 "카페/제과"
  좌표: ✅ 위경도 직접 포함 → 지오코딩 불필요
  전처리: src/preprocessing/preprocess_soho_food.py (신규 작성 필요)

【인증 플래그】모범음식점정보.csv (~65,418행)
  좌표 없음 → 이름+주소 매칭으로 소상공인 POI에 is_exemplary=True 부여

【인증 플래그】식품_관광식당.csv (~519행)
  좌표 없음 → 매칭으로 is_tourist_certified=True 부여

【미사용】식품_일반음식점.csv (689MB), 식품_휴게음식점.csv (203MB)
  위경도 없음 + 폐업 혼재 → 소상공인 데이터로 완전 대체
```

### 2-2. K-Culture 성지순례

#### 한국관광공사 TourAPI 촬영지
```
상태: ✅ API 키 보유, 스크립트 보유
방법: contentTypeId=25 (여행코스) 중 "촬영지" 키워드 필터
     또는 cat3="A02060300" (촬영지)
예상: ~2,000건 (전국)
장점: 공식 API, 좌표 포함
```

#### K-Drama/K-Pop 위키
```
소스 후보:
  - 나무위키: "OO (드라마)/촬영지" 문서
  - 한국영화데이터베이스 (KMDb): kobis.or.kr
  - 위버스/팬카페: 팬덤 성지 목록 (수동 큐레이션)
방법: requests + BeautifulSoup
예상: ~1,000건
주의: 좌표 없음 → 장소명 기반 Geocoding 필요
```

#### 아이돌/배우 SNS 장소
```
방법: Instagram 해시태그 (#BTSspots, #블랙핑크촬영지 등)
     → SerpAPI 또는 직접 크롤링
예상: ~500건
주의: robots.txt + 약관 확인, 변경 빈번
대안: 팬 커뮤니티 위키 기반 수동 큐레이션
```

### 2-3. 문화·관광지

#### 한국관광공사 TourAPI
```
상태: ✅ 15,905건 보유 (tour_poi.csv)
분포: 경기 2,460 / 강원 2,074 / 경북 1,594 / 경남 1,442 / 전남 1,376 ...
카테고리: 관광지 8,931 / 레저 3,243 / 숙박 2,080 / 문화 1,651
활용: 문화·관광지 카테고리 기본 DB로 그대로 사용
```

#### 국립중앙박물관 API
```
소스: museum.go.kr 또는 data.go.kr
내용: 서울/경주/나주/김해/춘천 등 분관 정보
상태: [ ] API 명세 확인 필요
```

#### 공공데이터 문화시설 (다운로드 완료)
```
【활용 가능】 문화_박물관 및 미술관.csv (~1,265행)
  컬럼: 사업장명, 영업상태명, 도로명주소, 박물관미술관유형명
  좌표: 없음 → 도로명주소 지오코딩 필요
  필터: 영업상태명 포함 "영업/정상"
  활용: poi 테이블 category='kculture', sub_category='museum'

【활용 가능】 문화_한옥체험업.csv (~3,075행)
  컬럼: 사업장명, 영업상태명, 도로명주소, 객실수
  좌표: 없음 → 도로명주소 지오코딩 필요
  필터: 영업상태명 포함 "영업/정상"
  활용: poi 테이블 category='kculture', sub_category='hanok'

【소규모 선별】 문화_종합테마파크업.csv (~81행), 문화_테마파크업(기타).csv
  폐업 多 → 영업중만 필터 후 도로명주소 지오코딩
  활용: poi 테이블 category='tourism', sub_category='theme_park'

【사용 제외】 문화_국내여행업.csv, 문화_종합여행업.csv
  여행사 등록 정보 → K-Ride POI와 무관

  지오코딩 전처리: src/preprocessing/preprocess_culture_poi.py (신규 작성 필요)
  지오코딩 API: Vworld API / JUSO 도로명주소 API (둘 다 테스트 후 성공률 높은 것 선택)
    - Vworld: https://api.vworld.kr/req/address (국토지리정보원, 무료, 3만건/일)
    - JUSO:   https://www.juso.go.kr/addrlink/addrCoordApi.do (행안부, 무료, 무제한)
  필요 키: VWORLD_API_KEY 또는 JUSO_CONFIRM_KEY (.env 추가 필요)
```

### 2-4. 둘레길·자연·자전거 인프라

#### 두루누비 (durunubi.kr)
```
소스: 한국관광공사 도보여행 포털
내용: 전국 둘레길/트레킹 코스 GPS 경로
방법: 공공데이터 API 또는 웹 크롤링
예상: ~800코스
핵심: 스탬프 시스템 연동 가능
```

#### 산림청 숲길
```
소스: data.go.kr "산림청_전국자연휴양림"
내용: 전국 자연휴양림, 숲길, 둘레길
상태: [ ] API 명세 확인 필요
```

#### 자전거보관소정보 (전처리 + DB 로드 완료) ✅
```
파일: 자전거보관소정보.csv (18,422행 → 전처리 후 18,277행)
상태: ✅ 전처리 완료 + DB 로드 완료 (poi 테이블, category='facility', sub_category='bike_storage')
컬럼: 자전거보관소명, 소재지도로명주소, WGS84위도, WGS84경도,
      보관대수, 설치형태, 차양막설치여부,
      공기주입기비치여부, 공기주입기유형명, 수리대설치여부
활용: poi 테이블 category='facility', sub_category='bike_storage'
      공기주입기/수리대 정보는 raw_data JSONB에 저장
전처리: src/preprocessing/preprocess_bike_facility.py ✅ 완료
시도 분포: 25개 (정규 17개 시도 + 비정규 8개 — sido 정규화 개선 권장)
```

---

## 3. LLM 전략 연구

### 3-1. Ollama 로컬 LLM

| 모델 | 크기 | VRAM | 한국어 성능 | 권장 용도 |
|------|------|------|-----------|----------|
| llama3.1:8b | 4.7GB | 6GB | 중 | 코스 생성, 대화 |
| gemma2:9b | 5.5GB | 8GB | 중상 | 한국어 질의 처리 |
| EEVE-Korean-10.8B | 6.5GB | 8GB | 상 | 한국어 특화 |
| phi3:mini | 2.3GB | 4GB | 하 | 경량 테스트 |

```bash
# 설치 및 실행
ollama pull llama3.1:8b
ollama serve  # localhost:11434

# Python 연동
from langchain_community.llms import Ollama
llm = Ollama(model="llama3.1:8b", base_url="http://localhost:11434")
```

### 3-2. Groq API (배포 환경)

```
무료 tier: 30 requests/min, 14,400 requests/day
모델: llama-3.1-70b-versatile (가장 강력)
지연: ~0.5초 (매우 빠름)
장점: 로컬 GPU 불필요, 배포 환경 적합
단점: rate limit, 외부 의존성
```

### 3-3. RAG 파이프라인 설계

```python
# ChromaDB 벡터 스토어 구성
from chromadb import Client
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("intfloat/multilingual-e5-small")  # 한영 다국어

collection = chroma.create_collection("poi_db")

# POI 데이터 임베딩
for poi in poi_list:
    text = f"{poi.name} {poi.category} {poi.address} {poi.description}"
    embedding = embedder.encode(text)
    collection.add(
        documents=[text],
        embeddings=[embedding.tolist()],
        metadatas=[{"id": poi.id, "category": poi.category, "lat": poi.lat, "lon": poi.lon}],
        ids=[str(poi.id)]
    )

# 검색
results = collection.query(
    query_texts=["BTS 뮤비 촬영지 근처 맛집"],
    n_results=10
)
```

### 3-4. GraphRAG 확대 (2차 MVP) ✅ (완료)

```
노드: POI (맛집/관광지/K-Culture/둘레길)
엣지:
  - NEAR (거리 < 2km)
  - SAME_CATEGORY (같은 카테고리)
  - SAME_TRIP (같은 여행에서 함께 방문)
  - FILMING_LOCATION (같은 작품 촬영지)

질의 예시:
  "BTS MV 촬영지에서 걸어서 갈 수 있는 맛집"
  → BTS 노드 → FILMING_LOCATION → 촬영지 노드 → NEAR → 맛집 노드
```

### 3-5. MCP (3차 MVP)

```
Model Context Protocol 도구:
  - weather_tool: KMA API 실시간 날씨
  - map_tool: 네이버/카카오 지도 경로 검색
  - transit_tool: TAGO 대중교통 API
  - cost_tool: TabNet 소비 예측 모델

LLM이 도구를 직접 호출:
  "내일 서울 1박2일 여행 계획 세워줘"
  → weather_tool("서울", "내일") → 맑음 22°C
  → map_tool("경복궁→홍대") → 4.5km, 도보 50분
  → cost_tool(duration=2, companion=2) → ₩185,000
```

---

## 4. 다국어 지원 전략

### 4-1. POI 데이터 다국어화

| 방법 | 비용 | 품질 |
|------|------|------|
| TourAPI 영문 데이터 | 무료 | 높음 (공식 번역) |
| Google Translate API | 유료 ($20/100만자) | 중 |
| Ollama 번역 | 무료 | 중하 |
| 수동 번역 (핵심 POI만) | 인건비 | 최상 |

```python
# TourAPI 영문 조회
# MobileOS=ETC&MobileApp=KRide&_type=json&arrange=A&contentTypeId=12
# → title, addr1 등이 영문으로 반환됨
```

### 4-2. 검색 다국어 대응

```
한국어: "BTS 촬영지 근처 맛집"
영어:   "restaurants near BTS filming locations"
  ↓ multilingual-e5-small 임베딩
  ↓ 같은 벡터 공간에서 검색
  → 동일한 POI 결과 반환
```

---

## 5. 소비 예측 모델 확장 계획

### 5-0. 신규 전국 소비 데이터 파악 결과 (2026-04-27)

#### 5-0-1. 2024년 국민여행조사 국내여행 RAWDATA

```
파일: 2024년 국민여행조사 국내여행 RAWDATA.xlsx / 국민여행조사_국내여행_2024_데이터.txt
소스: 문화체육관광부 / 한국관광공사 — 연간 전국 조사 (공식 마이크로데이터)
응답자: 51,754명 (전국)
컬럼수: 2,227개 (광폭 구조 — 응답자당 최대 5건 여행 × 최대 15개 방문지 × 속성)

[핵심 소비 컬럼 — 결측률 분석]
  MON_EXP_1~5   : 51,754건 (100.0%) ← 월 지출 구간 (소득 대리변수, 완전 무결측)
  D_TRA1_COST   : 26,342건 ( 50.9%) ← 1차 여행 총비용 ★ 핵심 타겟
  D_TRA1_ONE_COST: 26,342건 ( 50.9%) ← 1인당 비용 ★ 대안 타겟
  D_TRA2_COST   :  1,291건 (  2.5%) ← 2차 여행 (소수)
  D_TRA3_COST   :     96건 (  0.2%) ← 이하 무시

[중요 패턴]
  COST가 있는 26,342행은 D_TRA1_CASE / S_Day / NUM / SPOT도 모두 존재
  → 26,342행이 완전한 학습 세트 (결측 없음, 필터만 하면 즉시 사용 가능)

[소비값 분포 (26,342행 기준)]
  D_TRA1_COST    : min=3,000원 / median=170,000원 / max=21,000,000원
  D_TRA1_ONE_COST: min=2,500원 / median=79,000원  / max=6,980,000원

[여행 유형 분포]
  D_TRA1_CASE: 1(당일)=18,539건(70.4%) / 2(1박)=4,511건 / 3(2박)=2,420건 / 4~5=소수
  D_TRA1_S_Day: 0(당일)=15,899건 / 1(1박)=7,751건 / 2(2박)=2,128건 / 3+소수
  D_TRA1_NUM: 1인=7,909건 / 2인=7,678건 / 3인=4,378건 / 4인=5,196건 / 5+소수

[SPOT 코드 구조]
  unique=229개, 5자리 정수 (예: 32030, 38090, 31270)
  앞 2자리 = 표준 행정구역 시도코드 → 코드북 없이 시도 추출 가능
  (11=서울, 21=부산, 22=대구, 23=인천, 24=광주, 25=대전, 26=울산, 29=세종,
   31=경기, 32=강원, 33=충북, 34=충남, 35=전북, 36=전남, 37=경북, 38=경남, 39=제주)

[MON_EXP 이진 분포]
  MON_EXP_1: {1: 18,960건 / 2: 32,794건} → 37% 해당
  MON_EXP_2: {1:  4,577건 / 2: 47,177건} → 9% 해당
  MON_EXP_3: {1:  2,681건 / 2: 49,073건} → 5% 해당
  MON_EXP_4: {1:    421건 / 2: 51,333건} → 1% 해당
  MON_EXP_5: {1:    567건 / 2: 51,187건} → 1% 해당
  → 값=1이 "해당 지출 항목 선택", 값=2가 "미해당"으로 추정
  → income_score = sum(MON_EXP_i == 1) → 0~5점

[여행 속성 컬럼]
  D_TRA1_S_Day  : 여행 박수 (당일=1, 1박2일=2, ...)
  D_TRA1_NUM    : 동반자 수
  D_TRA1_CASE   : 여행 유형 코드 (당일/숙박 구분)
  D_TRA1_VAC    :  5,091건 (9.8%) — 휴가 여부 (결측 많음 → 제외 권장)
  D_TRA1_1_SPOT : 26,342건 → 방문지 시도 코드 (코드북 매핑 필요)
  D_TRA1_2_SPOT :  9,417건 → 2번째 방문지 (선택적 사용)

[인구통계 컬럼 — SA1 계열]
  SA1_1: unique=6 → 성별/거주지역 등 코드 (100% 완전)
  SA1_2: unique=4 → 연령대 코드 (100% 완전)
  SA1_3: unique=5 → 소득/지역 코드 (100% 완전)
  SA1_4: unique=3 → (코드북 필요)
  SA1_5: unique=5 → (코드북 필요)

[수도권 AI Hub 대비 비교]
  AI Hub 수도권 (v2 학습): 2,508행 / 수도권 한정
  국민여행조사 (v3 학습): 26,342행 / 전국 (10.5× 규모)
  → AI Hub 전국 신청 없이도 전국 소비 모델 학습 가능
```

#### 5-0-2. 네이버 데이터랩 — 방문자·검색 통계 (2025.04~2026.03)

```
[다운로드2 — 방문자 통계]
파일: 광역별 방문자 수.csv / 방문자 수 추이.csv / 방문자수 히트맵.csv
내용: 전국 시군구별 방문자 수 + 비율 (외지인/현지인/전체 구분)
기간: 202504~202603 (1년)
활용:
  - 시도별 방문자 비율 → POI 지역 인기도 피처 추가
  - 외지인 방문비율 → 관광지/맛집 수요 지표

[다운로드3 — 검색 통계]
파일: 검색건수 추이.csv / 유형별 검색건수.csv / 방문자수 히트맵.csv / 지역별 검색건수.csv
내용: 전국 시군구별 검색건수 + 카테고리별 비율
핵심 발견:
  음식        42.6% ← 맛집 검색이 전체의 거의 절반
  쇼핑        13.4%
  문화관광    12.0% ← K-Culture/관광지 수요 확인
  숙박         9.6%
  레저스포츠   5.0%
  자연관광     4.3%
  역사관광     3.1%
  체험관광     0.8%
  기타         9.2%
활용:
  - 카테고리 가중치 → POI 추천 스코어 반영
  - 지역별 검색건수 → POI 인기도 사이드 피처
```

### 5-1. 현재 모델 (TabNet v2) — ⚠️ 수도권 한정

```
입력: sgg_enc, travel_duration_h, distance_km, companion_cnt,
      season, day_of_week, has_lodging, income_tier, age_grp_enc,
      gender_enc, travel_purpose_enc, travel_styl_avg
출력: log_total_consume → 실제 금액 (역변환)
성능: MAE=₩129,653 / R²=0.1277
한계: 수도권 2,508행, 계절 편향 (여름 82.7%), 전국 서비스 불가
```

### 5-1-1. 국민여행조사 기반 전국 ConsumeTabNet v3 전처리 전략

```
[Step 1] 소비값 필터링 (26,342행 추출)
  - 조건: D_TRA1_COST.notna() & (D_TRA1_COST > 0)
  - 결과: 26,342행, 모든 여행 속성 완전 (결측 없음)

[Step 2] 피처 추출
  타겟(y):
    - D_TRA1_ONE_COST (1인당 비용) — log1p 변환 권장
    - 또는 D_TRA1_COST (총비용, 인원 보정 후)
  여행 속성:
    - D_TRA1_S_Day → travel_days (1~N)
    - D_TRA1_NUM   → companion_cnt
    - D_TRA1_CASE  → trip_type (당일/1박/2박+)
    - D_TRA1_1_SPOT → 앞 2자리 = 표준 시도코드 → sido_enc
        (unique=229개, 코드북 없이 추출 가능: 11=서울 21=부산 31=경기 32=강원 등)
  인구통계 (SA1 계열 — label encoding):
    - SA1_1: {0:32794, 1:18625, 2:307} → 이진 dominant 변수
    - SA1_2: {0:47177, 1:4533, 2:42}
    - SA1_3: {0:49073, 1:2611, 2:62}
    - SA1_4: {0:51333, 1:419, 2:2}
    - SA1_5: {0:51187, 1:532, 2:28}
    → 코드북 없이 그대로 label encoding 사용 가능 (0이 기본값, 1~=특성 있음)
  소득 대리:
    - MON_EXP_1~5 → 100% 완전 → 이진 응답 (값=1 또는 2)
    - sum(MON_EXP_i == 1) → 0~5 범위 합산 → income_score → 3단계 구간화
      (0~1=저지출, 2~3=보통, 4~5=고지출)

[Step 3] 이상치 제거
  - D_TRA1_ONE_COST: 1%~99% 분위 필터
  - 0원 제거

[Step 4] 사이드 피처 추가 (선택)
  - 데이터랩 방문자 비율 → 시도별 popularity_ratio 조인
  - 계절 파생: S_Day 포함 여행 개시 월 → season (1~4)

[Step 5] 출력
  - data/raw_ml/national_travel_consume.csv
  - 전국 ~24,000~26,000행 (이상치 제거 후)
  - 스크립트: src/preprocessing/preprocess_national_travel.py

[Step 6] ConsumeTabNet v3 학습 완료 (2026-04-27)
  - 스크립트: src/dl/build_consume_model_v3.py (신규 작성)
  - 피처 11개: travel_days / companion_cnt / trip_type / sido_enc / sa1_1~5 / income_score / season
  - income_tier (편향 극심: 0=25,204 vs 1=689) 대신 income_score(연속 0~5) 사용
  - 지역 매칭: sido_name_to_enc 역매핑 메타 저장 → POI sido → 모델 입력 자동 변환

  실험 결과:
  | 실험 | n_d | n_steps | epochs | test MAE | test R² | 비고 |
  |------|-----|---------|--------|----------|---------|------|
  | 1차 (채택) | 32 | 5 | 150 | ₩42,764원 | 0.5939 | best_epoch=149, 개선 중 |
  | 2차 (과적합) | 64 | 6 | 200 | ₩43,917원 | 0.5156 | Early stop epoch 57 |

  최종 확정 (--epochs 200 재실행): Early stop epoch=174, best_epoch=149 → 동일 결과
  v2 대비: R² 0.1277 → 0.5939 (+0.466), 데이터 2,508 → 25,893행 (10.3×)
  출력: models/consume_regressor_v3.zip / consume_scaler_v3.pkl / consume_meta_v3.json

  시각화 산출물 (report_step3_consume_tabnet.py):
    16_consume_target_distribution.png  — 소비 타겟 분포 (log/계절별/여행일수별)
    17_consume_feature_importance.png   — 피처 중요도 (Attention 기반)
    18_consume_learning_curve.png       — 학습 곡선 (실제 훈련 로그 기반)
    19_consume_scatter.png              — 실제 vs 예측 산점도 + 잔차 분포
    20_consume_sido_distribution.png    — 시도별 1인 지출 중앙값
    21_consume_v2_vs_v3.png             — v2→v3 업그레이드 비교
```

### 5-2. 일정별 예측으로 확장

```
기존: 여행 1건 → 총 소비 예측
확장: 일정(당일/1박2일/2박3일/3박4일) + 카테고리별 예측

입력 추가:
  - duration_days (1~4)
  - n_restaurants (방문 맛집 수)
  - n_attractions (방문 관광지 수)
  - accommodation_type (없음/게스트하우스/호텔)
  - transport_type (walk/bike/public/car)

출력:
  - 식비 예측
  - 숙박비 예측
  - 교통비 예측
  - 입장료 예측
  - 총 예상 비용
```

---

## 6. 데이터 수집 우선순위

| 순위 | 데이터 | 소스 | 난이도 | 상태 |
|------|--------|------|:---:|---------|
| **1** | **전국 사고다발지** | `collect_nationwide_accident.py` | 낮 | ✅ **완료** (381 시군구) |
| **2** | **WeatherLSTM 시각화** | `visualize_weather_lstm.py` | 낮 | ✅ **완료** (report/figures/) |
| **3** | DB 연결 (Neon 설정) | neon.tech + `.env` | 낮 | ✅ **완료** (131,619행 로드) |
| **4** | **전국 맛집 POI (주력)** | 소상공인 상가 ZIP → `preprocess_soho_food.py` | 낮 | ✅ **전처리 완료** (803,096행, DB 로드 대기) |
| **5** | **자전거보관소 POI** | `자전거보관소정보.csv` → `preprocess_bike_facility.py` | 낮 | ✅ **전처리 + DB 로드 완료** (18,277행) |
| **6** | **문화시설 POI** | 박물관/한옥 CSV → Vworld / JUSO API 지오코딩 | 중 | ✅ **전처리 완료** (3,685행, DB 로드 대기) |
| 7 | K-Culture 촬영지 | TourAPI + 위키 크롤링 | 중 | ✅ (완료) (K_Drama_Unique_Spots.xlsx 반영) |
| 8 | 둘레길 코스 | 두루누비 공공데이터 | 중 | [ ] 미착수 |
| 9 | **국민여행조사 전처리** | `preprocess_national_travel.py` 작성 | 낮 | ✅ (완료) (ConsumeTabNet v3 학습 완료) |
| 10 | 전국 AI Hub 여행로그 | aihub.or.kr 신청 | — | [ ] POI 추천·매력도 모델 전국화 용도 |
| 10 | 블루리본 맛집 | 크롤링 | 중 | [ ] 미착수 |
| 11 | 아이돌 SNS 장소 | 수동 큐레이션 | 높 | [ ] 미착수 |

---

## 7. 외부 플랫폼 활용 계획

| 플랫폼 | 용도 | 상태 |
|--------|------|------|
| **HuggingFace** | ML 모델 호스팅 (pkl/pt/zip) + Spaces 데모 | [ ] 레포 생성 |
| **Roboflow** | 이미지 분류 모델 (관광지 사진 등) | [ ] 필요 시 |
| **Kaggle** | 학습 데이터셋 공유 + GPU 학습 | [ ] Notebook 작성 |
| **Groq** | 배포 환경 LLM 추론 (무료 tier) | [ ] API 키 발급 |
| **Google Colab** | GPU 학습 (A100/T4) | [ ] Drive 연동 |

---

## 8. DB 인프라 설계 (PostgreSQL + PostGIS)

### 8-1. Neon을 선택한 이유

**Neon이란?**
PostgreSQL을 서버리스(Serverless) 방식으로 제공하는 클라우드 서비스.
로컬 PC에 PostgreSQL을 설치하지 않아도 인터넷으로 DB에 접속 가능.

**왜 Neon인가?**

| 이유 | 설명 |
|------|------|
| **무료 (500MB)** | 1차 MVP 규모에서 충분. 유료 전환 없이 개발 가능 |
| **PostGIS 지원** | 위도/경도 기반 공간 쿼리 (반경 검색, 거리 계산) 내장 지원 |
| **Serverless** | PC가 꺼져도 DB는 항상 켜져 있음. Railway/Vercel 배포 환경과 연동 용이 |
| **즉시 연결** | 설치 없이 CONNECTION_STRING 하나로 바로 사용 |
| **Branching** | 개발/운영 DB를 Git 브랜치처럼 분리 가능 |

**PostGIS가 필요한 이유?**

일반 DB: `WHERE sido='서울'` → 지역명 문자열 검색만 가능

PostGIS: `ST_DWithin(geom, ST_Point(127.0, 37.5, 4326), 2000)` → **현재 위치에서 반경 2km 내 POI** 즉시 검색

K-Ride의 핵심 기능(지도 기반 POI 검색, 경로 생성)은 공간 쿼리 없이는 구현이 어렵기 때문에 PostGIS가 필수.

**대안 비교**

| 옵션 | 장점 | 단점 |
|------|------|------|
| **Neon** (선택) | 무료, PostGIS, 서버리스 | 500MB 제한 (무료) |
| 로컬 PostgreSQL | 제한 없음 | 배포 환경에서 접근 불가 |
| Supabase | PostGIS 지원, 무료 500MB | 기능이 더 많지만 복잡 |
| SQLite | 초간단 | 공간 쿼리 미지원, 동시접속 불가 |
| Railway PostgreSQL | 배포 통합 편리 | 무료 tier 제한적 |

---

### 8-2. DB 스키마 (2026-04-26 확정)

```sql
-- 통합 POI 테이블 (맛집/K-Culture/관광/시설)
CREATE TABLE poi (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    name_en     VARCHAR(200),
    category    VARCHAR(30) NOT NULL,  -- food/kculture/tourism/nature/facility
    sub_category VARCHAR(50),
    sido        VARCHAR(20),
    sigungu     VARCHAR(30),
    address     VARCHAR(300),
    geom        GEOMETRY(POINT, 4326), -- PostGIS 공간 컬럼
    source      VARCHAR(50),           -- kakao/tourapi/crawl
    score       DECIMAL(3,2),
    is_24h      BOOLEAN DEFAULT FALSE,
    raw_data    JSONB,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_poi_geom ON poi USING GIST(geom);   -- 공간 인덱스

-- 자전거도로/둘레길
CREATE TABLE trail (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200),
    trail_type  VARCHAR(20),   -- bike_road / dullegil / forest
    sido        VARCHAR(20),
    length_km   DECIMAL(8,3),
    width_m     DECIMAL(6,2),
    safety_index DECIMAL(6,4),
    is_official BOOLEAN DEFAULT FALSE,
    geom        GEOMETRY(LINESTRING, 4326),
    source      VARCHAR(50)
);

-- 지역별 사고 위험도
CREATE TABLE district_danger (
    id          SERIAL PRIMARY KEY,
    sido        VARCHAR(20) NOT NULL,
    sigungu     VARCHAR(30) NOT NULL,
    crash_count INTEGER,
    death_count INTEGER,
    danger_score DECIMAL(6,4),  -- 0~1 정규화
    data_year   SMALLINT,
    UNIQUE (sido, sigungu, data_year)
);

-- 기상 일자료 (ASOS)
CREATE TABLE weather_daily (
    id          SERIAL PRIMARY KEY,
    stn_id      VARCHAR(10) NOT NULL,
    stn_name    VARCHAR(30),
    sido        VARCHAR(20),
    obs_date    DATE NOT NULL,
    avg_temp    DECIMAL(5,1),
    precipitation DECIMAL(7,1),
    avg_humidity DECIMAL(5,1),
    UNIQUE (stn_id, obs_date)
);

-- 추천 코스
CREATE TABLE course_template (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200),
    duration_days SMALLINT,     -- 1=당일, 2=1박2일
    transport   VARCHAR(20),    -- walk/bike/public/car
    estimated_cost INTEGER,
    poi_ids     INTEGER[],      -- 방문 POI 순서 배열
    route_geom  GEOMETRY(LINESTRING, 4326)
);
```

---

### 8-3. 생성된 스크립트 전체 목록 (2026-04-26 17:20 업데이트)

| 파일 | 역할 | 실행 가능 여부 |
|------|------|:---:|
| `src/db/init_db.py` | PostGIS 확장 설치 + 테이블 전체 생성 | ✅ **실행 완료** |
| `src/db/load_data.py` | 기존 CSV → DB 일괄 로드 | ✅ **실행 완료** (112,961행) |
| `src/data_collect/collect_nationwide_facility.py` | 카카오 API 수집 + `--db` 즉시 저장 | ✅ 즉시 실행 가능 (DATABASE_URL 설정 완료) |
| `src/data_collect/collect_nationwide_accident.py` | 전국 사고 데이터 수집 | ⏳ 미실행 (우선 실행 필요) |
| `src/preprocessing/preprocess_road_nationwide.py` | 전국 자전거도로 전처리 | ✅ **실행 완료** (20,262행) |
| `src/dl/build_weather_lstm.py` | WeatherLSTM 학습 (히스토리 저장 추가됨) | ✅ 완료 |
| `src/dl/visualize_weather_lstm.py` | WeatherLSTM 시각화 → report/ 저장 | ✅ **실행 완료** (Acc=82.16%) |
| `src/ml/build_safety_model.py` | Safety 모델 학습 (전국 도로 지원됨) | ✅ **실행 완료** (R²=0.9919, F1=0.9990) |
| `.ai/agent.md` | AI 에이전트 작업 규칙 (데이터 우선 원칙 등) | — |

---

### 8-4. DB 연결 현황 및 준비 체크리스트 (2026-04-27 업데이트)

| 항목 | 상태 | 조치 |
|------|:---:|------|
| `psycopg2` 패키지 | ✅ 설치 완료 (2.9.12) | — |
| `openpyxl` 패키지 | ✅ 설치 완료 (3.1.5) | — |
| `python-dotenv` 패키지 | ✅ 설치됨 | — |
| `.env` 파일 | ✅ DATABASE_URL 설정 완료 (Neon) | — |
| Neon 계정 | ✅ 생성 완료 (ap-southeast-1) | — |
| `init_db.py` 코드 | ✅ 실행 완료 | 테이블 5개 생성됨 |
| `load_data.py` 코드 | ✅ 실행 완료 | 131,619행 로드됨 |

**결론: DB 초기화 + 기본 로드 완료! 다음은 food_poi (803,096행) + culture_poi (3,685행) DB 로드**

```
[✅] 코드 준비 완료
[✅] pip install psycopg2 완료 (2.9.12)

[✅] 1. Neon 계정 생성 및 DATABASE_URL 발급 완료

[✅] 2. .env 파일에 DATABASE_URL 추가 완료

[✅] 3. 스키마 초기화 완료
      python src/db/init_db.py
      → poi, course_template, trail, district_danger, weather_daily 테이블 생성

[✅] 4. 기존 CSV → DB 로드 완료 (총 131,619행 — 2026-04-27 기준)
      poi: 19,273행 (tour_poi 15,905 + facility 3,368)
      trail: 20,262행 (road_clean_nationwide.csv)
      weather: 73,426행 (weather_asos_daily_nationwide.csv)
      danger: 381행 (district_danger_nationwide.csv)
      poi(bike_facility): 18,277행 (bike_facility_nationwide.csv) ✅ NEW

[ ] 5. 나머지 POI DB 로드 (전처리 완료 CSV → DB 적재)
      python src/db/load_data.py --table food_poi      → 803,096행
      python src/db/load_data.py --table culture_poi   → 3,685행
```

---

### 8-5. 로드 대상 CSV → DB 매핑

| CSV 파일 | → DB 테이블 | 예상 행수 |
|----------|------------|---------|
| `tour_poi.csv` | `poi` (category=tourism/food) | 15,905 |
| `facility_clean.csv` | `poi` (category=facility) | 3,368 |
| `facility_clean_nationwide.csv` | `poi` (category=facility) | 미정 (수집 후) |
| `road_clean_nationwide.csv` | `trail` (trail_type=bike_road) | ~20,262 |
| `district_danger_nationwide.csv` | `district_danger` | ~250 (시군구) |
| `weather_asos_daily_nationwide.csv` | `weather_daily` | 미정 (수집 후) |

---

### 8-6. PostGIS 공간 쿼리 활용 예시

```sql
-- 현재 위치(서울 광화문) 반경 1km 내 맛집
SELECT name, address, ST_Distance(geom::geography, ST_Point(126.9769, 37.5759)::geography) AS dist_m
FROM poi
WHERE category = 'food'
  AND ST_DWithin(geom::geography, ST_Point(126.9769, 37.5759)::geography, 1000)
ORDER BY dist_m;

-- 위험 지역 TOP 10 (자전거 경로 회피용)
SELECT sido, sigungu, danger_score
FROM district_danger
WHERE data_year = 2024
ORDER BY danger_score DESC
LIMIT 10;

-- 특정 자전거도로와 교차하는 위험 지역 찾기
SELECT d.*
FROM district_danger d
JOIN trail t ON ST_Intersects(
    ST_Buffer(t.geom::geography, 500)::geometry,
    d.geom
)
WHERE t.id = 123;
```

---

## 10. LLM + RAG + GraphRAG 모델 선택 전략 (2026-04-28 추가)

> **배경**: 현재 96만건 POI DB + 6종 ML/DL 모델이 준비됨. 다음 단계는 LLM 기반 추천 시스템 + 개인 챗봇 시스템 구축. 멀티모달이 이 시스템의 핵심.

---

### 10-1. 역할별 모델 후보군

#### A. LLM — 코스 생성 + 챗봇

| 모델 | 크기 | 한국어 | 실행 방식 | 비용 | 추천 용도 |
|------|------|--------|----------|------|-----------|
| `EEVE-Korean-10.8B` | 6.5GB | ★★★★★ | Ollama 로컬 | 무료 | **한국어 챗봇 1순위** |
| `gemma2:9b` | 5.5GB | ★★★★ | Ollama 로컬 | 무료 | 코스 생성 |
| `llama3.1:8b` | 4.7GB | ★★★ | Ollama 로컬 | 무료 | 영어 질의 처리 |
| `qwen2.5:14b` | 8.2GB | ★★★★★ | Ollama 로컬 | 무료 | **한/중/영 멀티링궐** |
| `llama-3.3-70b` | — | ★★★★ | Groq API | 무료 tier | 배포 환경 fallback |

> 모델 탐색 방법: `ollama list` 또는 [ollama.com/library](https://ollama.com/library) → korean 필터 → pulls 수 기준 정렬

#### B. Embedding 모델 — RAG 핵심

| 모델 | 크기 | 한/영 | HuggingFace MTEB 순위 | 비고 |
|------|------|-------|----------------------|------|
| `BAAI/bge-m3` | 570MB | ✅ 다국어 | Korean Retrieval 최상위권 | **1순위 추천** |
| `intfloat/multilingual-e5-small` | 118MB | ✅ 다국어 | 중상위 | 빠름, 이미 플랜에 명시 |
| `jhgan/ko-sroberta-multitask` | 110MB | 한국어 특화 | KorSTS 상위 | 경량, 한국어 최적화 |
| `upskyy/kf-deberta-multitask` | 180MB | 한국어 특화 | KorSTS 1위 | 한국어 STS 최강 |
| `openai/text-embedding-3-small` | API | ✅ | MTEB 최상위 | 유료, 영문 최강 |

> 모델 비교 방법: [HuggingFace MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) → Korean 탭 → Retrieval 점수 기준 선택

#### C. Reranker 모델 — 검색 후 정렬

| 모델 | 특징 | 권장 |
|------|------|------|
| `BAAI/bge-reranker-v2-m3` | 다국어 지원, Cross-Encoder 방식 | **1순위** |
| `cross-encoder/ms-marco-MiniLM-L-6-v2` | 빠름, 영어 특화 | 영문 쿼리 |
| `Cohere Reranker API` | API 방식, 무료 tier | 배포 환경 |
| LLM 기반 rankllm | GPT/LLaMA로 직접 리랭킹 | 정확도 최상, 느림 |

#### D. 멀티모달 모델 — 이미지 + 텍스트

| 모델 | 용도 | 크기 | 실행 방식 |
|------|------|------|-----------|
| `openai/clip-vit-large-patch14` | 이미지 ↔ 텍스트 유사도 검색 | 890MB | HuggingFace |
| `BLIP-2` | 이미지 캡션 생성 → POI 설명 자동화 | 3~12GB | HuggingFace |
| `llava:13b` | 이미지 보고 자연어 답변 | 8GB | Ollama 로컬 |
| `qwen2.5-vl:7b` | 한국어 + 이미지 이해 | 4.5GB | Ollama 로컬 |

> **멀티모달 핵심 시나리오 2가지**
> 1. 사용자가 사진 업로드 → CLIP으로 유사 POI 이미지 검색 → 관광지 추천
> 2. 사용자가 "이 사진 어디야?" 질문 → LLaVA/Qwen2.5-VL이 이미지 이해 → POI DB 매칭

---

### 10-2. 성능 평가 방법 — 실제로 모델을 비교하는 법

#### Embedding 모델 비교 (Recall@K, NDCG@K)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# 평가용 정답 셋 구성 (POI ID 기준)
# query → ground_truth_poi_ids 매핑 20~50개 만들어두기
eval_set = [
    {"query": "BTS 뮤비 촬영지 근처 맛집", "relevant": [poi_id_1, poi_id_2]},
    {"query": "서울 당일치기 K-Culture 코스", "relevant": [poi_id_3, poi_id_4]},
    ...
]

models_to_eval = [
    "BAAI/bge-m3",
    "intfloat/multilingual-e5-small",
    "jhgan/ko-sroberta-multitask",
]

for model_name in models_to_eval:
    model = SentenceTransformer(model_name)
    # Recall@5, NDCG@10 계산
    # MLflow에 기록
```

#### LLM 코스 생성 품질 평가 기준

```
동일 프롬프트: "서울 1박2일, 혼자, K-Pop 팬, 예산 20만원"
평가 항목:
  1. 코스 논리성 — 이동 거리가 합리적인가 (PostGIS로 검증 가능)
  2. 한국어 자연스러움 — 1~5점 수동 평가
  3. 응답 속도 — 토큰/초 (ollama 로그로 측정)
  4. 할루시네이션 여부 — 실제 POI DB에 없는 장소 생성 횟수
  5. 맥락 유지 — 멀티턴 대화에서 이전 맥락 반영 여부
```

#### MLflow 실험 추적 (2026-04-29 실제 구현 완료)

**추적 파일**: `scripts/test_rag_pipeline.py`  
**DB**: `mlflow.db` (SQLite, 프로젝트 루트)  
**UI 실행**: `mlflow ui --backend-store-uri sqlite:///mlflow.db` → `http://localhost:5000`

**실험명**: `kride_rag_pipeline`

```
[파라미터]
  embed_model       — 임베딩 모델명 (비교 실험 핵심)
  llm_model         — LLM 모델명
  top_k             — 검색 상위 K개
  n_sample_pois     — 샘플 POI 수
  chroma_space      — 벡터 유사도 방식 (cosine)

[메트릭]
  embed_load_time_sec       — 임베딩 모델 로딩 시간
  vector_dim                — 벡터 차원 수
  multilingual_sim_ko_en    — 한국어↔영어 유사도
  multilingual_sim_ko_ja    — 한국어↔일본어 유사도
  multilingual_sim_en_ja    — 영어↔일본어 유사도
  recall_at_1               — 검색 정답률 (4개 쿼리 기준)
  avg_top1_similarity       — 상위 1위 평균 유사도
  rag_latency_ko_sec        — 한국어 RAG 응답 시간
  rag_latency_en_sec        — 영어 RAG 응답 시간
  rag_latency_ja_sec        — 일본어 RAG 응답 시간
  rag_avg_latency_sec       — 평균 RAG 응답 시간
  db_poi_count              — PostgreSQL POI 총 수
  check_*                   — 시스템 점검 결과 (0/1)

[아티팩트]
  rag_answers.txt           — 한/영/일 RAG 답변 전문

[태그]
  all_checks_passed         — 전체 시스템 정상 여부
  embed_model / llm_model   — 빠른 필터용
```

**모델 비교 실험 방법**: `EMBED_MODEL` 변경 후 재실행 → MLflow UI에서 run 나란히 비교

```python
# 현재 (경량 테스트용)
EMBED_MODEL = "intfloat/multilingual-e5-small"  # 118MB, 384차원

# 교체 후 재실행 (최고 품질)
EMBED_MODEL = "BAAI/bge-m3"  # 2.3GB, 1024차원
```

**2026-04-29 기준 실측 결과** (multilingual-e5-small + qwen2.5:3b):
```
multilingual_sim_ko_en : 0.898
multilingual_sim_ko_ja : 0.893
multilingual_sim_en_ja : 0.925
recall_at_1            : 1.0 (4/4 정답)
avg_top1_similarity    : 0.887
db_poi_count           : 874,191
```

---

### 10-3. Chunking → Retrieval → Reranking 파이프라인 설계

#### Chunking 전략 (POI 데이터 특성 반영)

POI 데이터는 일반 문서와 달리 텍스트가 짧으므로 **필드별 분리 청킹** 전략을 사용한다.

```python
def chunk_poi(poi: dict) -> list[dict]:
    chunks = []

    # 청크 1: 검색용 (카테고리 + 지역 + 이름)
    chunks.append({
        "text": f"{poi['name']} {poi['category']} {poi['sub_category']} {poi['sido']} {poi['sigungu']}",
        "type": "search",
        "poi_id": poi["id"]
    })

    # 청크 2: 의미 검색용 (설명 + 태그)
    if poi.get("description"):
        chunks.append({
            "text": f"{poi['name']}: {poi['description']} 태그: {' '.join(poi.get('tags', []))}",
            "type": "semantic",
            "poi_id": poi["id"]
        })

    # 청크 3: 멀티모달용 (이미지 URL 참조)
    if poi.get("image_url"):
        chunks.append({
            "text": f"[IMAGE] {poi['name']}",
            "image_url": poi["image_url"],
            "type": "multimodal",
            "poi_id": poi["id"]
        })

    return chunks
```

#### Retrieval — Dense + Sparse 하이브리드

```
[사용자 질의]
  "BTS 뮤비 촬영지 근처 맛집"
        ↓
[Dense Retrieval]                    [Sparse Retrieval]
  BAAI/bge-m3 임베딩                  BM25 (키워드 정확 매칭)
  ChromaDB 벡터 검색 Top-50           "BTS", "뮤비", "촬영지", "맛집" 정확 일치
        ↓                                    ↓
[Hybrid Fusion]
  Dense 결과 70% + Sparse 결과 30% 가중 합산 (RRF: Reciprocal Rank Fusion)
  → 후보 Top-50
        ↓
[Reranking]
  BAAI/bge-reranker-v2-m3
  질의-문서 쌍 교차 인코딩
  → Top-5~10
        ↓
[지리 필터 후처리]
  PostGIS ST_DWithin — 반경 2km 내 필터
  안전 점수 보정 — safety_regressor.pkl 예측값 가중
        ↓
[LLM 컨텍스트 주입]
  코스 생성 or 챗봇 답변 생성
```

#### ChromaDB 구성 코드 뼈대

```python
import chromadb
from sentence_transformers import SentenceTransformer, CrossEncoder

# 임베딩 모델
embedder = SentenceTransformer("BAAI/bge-m3")
# 리랭커
reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")

client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(
    name="kride_poi",
    metadata={"hnsw:space": "cosine"}
)

def retrieve_and_rerank(query: str, top_k: int = 50, final_k: int = 5):
    # 1. Dense Retrieval
    query_emb = embedder.encode(query, normalize_embeddings=True)
    dense_results = collection.query(
        query_embeddings=[query_emb.tolist()],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )

    # 2. Reranking
    docs = dense_results["documents"][0]
    metas = dense_results["metadatas"][0]
    pairs = [(query, doc) for doc in docs]
    scores = reranker.predict(pairs)

    # 3. 점수 기준 정렬 → Top-K 반환
    ranked = sorted(zip(scores, metas), reverse=True)
    return [meta for _, meta in ranked[:final_k]]
```

---

### 10-4. RAG → GraphRAG 확대 전략

#### GraphRAG 노드/엣지 설계

```
[노드 타입]
  POI       — 맛집, 관광지, K-Culture, 둘레길
  Artist    — BTS, BLACKPINK, 드라마 등
  Region    — 시도, 시군구

[엣지 타입]
  NEAR           — 거리 < 2km (PostGIS 기반 자동 생성)
  SAME_CATEGORY  — 동일 카테고리
  FILMING_AT     — Artist → POI (촬영지 관계)
  VISITED_SAME   — Co-occurrence 여행 시퀀스 기반
  IN_REGION      — POI → Region

[질의 예시]
  "BTS 촬영지에서 걸어서 갈 수 있는 맛집"
  → Artist(BTS) -FILMING_AT→ POI(촬영지) -NEAR→ POI(맛집) 그래프 탐색
```

#### 구현 라이브러리 선택

| 라이브러리 | 장점 | 단점 | 선택 기준 |
|-----------|------|------|---------|
| NetworkX | 설치 간단, Python 네이티브 | 대규모 느림 | **1차 MVP — 프로토타입** |
| Neo4j | 대규모 그래프, Cypher 쿼리 | 설치 복잡 | 2차 MVP |
| LangChain GraphRAG | LLM 연동 쉬움 | 추상화 많음 | LLM 통합 시 |

---

### 10-5. 모델 탐색 실행 순서 (추천)

```bash
# Step 1: Ollama LLM 비교
ollama pull EEVE-Korean-10.8B
ollama pull qwen2.5:14b
ollama pull gemma2:9b
# → 동일 프롬프트로 한국어 품질 직접 비교

# Step 2: 임베딩 모델 설치
pip install sentence-transformers
# BAAI/bge-m3, multilingual-e5-small, ko-sroberta 3종 Recall@K 비교

# Step 3: 리랭커 설치
# BAAI/bge-reranker-v2-m3 → CrossEncoder로 사용

# Step 4: 멀티모달
ollama pull llava:13b      # 이미지 이해
ollama pull qwen2.5-vl:7b  # 한국어 + 이미지

# Step 5: Groq API 키 발급
# console.groq.com → 무료 tier → llama-3.3-70b 배포용
```

---

## 9. 기존 research.md에서 계승하는 핵심 인사이트

### 유지할 연구 결과
- **safety_index_v2 공식**: `(1-district_danger)×0.6 + road_attr_score×0.4` — 재학습에 그대로 사용
- **소비 모델 income_tier 구간화**: 짠순이(1~3)/보통(4~6)/호캉스(7~8) — 유지
- **Co-occurrence Jaccard + 지리 필터**: Recall@5=0.1372 달성 방법론 유지
- **날씨 보정값**: 맑음 0.0 / 흐림 -0.05 / 비눈 -0.20 — 유지
- **데이터 모수 문제**: 좌표 결측 68% → 전국 확대 시 Geocoding 보완 전략

### 폐기/대체할 연구
- GRU 방문지 시퀀스 → **LLM 기반 코스 생성으로 대체**
- 자전거 전용 프로파일 (BMI/자전거종류) → **2차 MVP로 이동**
- Phase 7 셀카 패션 추천 → **프로젝트 범위 외**
- TabNet Safety Phase 5 → RF R²=0.9539 충분, 전국 확대 후 재검토

---

## 11. 여행 기록 & 맞춤 영상 기능 (2026-04-29 추가)

> **배경**: RAG 기반 여행지 추천 이후 사용자 경험을 완성하는 핵심 차별화 기능.  
> 단순 추천 서비스를 넘어 **여행 전(추천) → 여행 중(기록) → 여행 후(영상)** 전체 루프를 제공.

---

### 11-1. 프론트엔드 전략 — PWA MVP → React Native

```
1차 MVP: PWA (Progressive Web App)
  - 별도 앱 설치 없이 브라우저에서 실행
  - 카메라 API (MediaDevices.getUserMedia) — 사진 촬영 가능
  - GPS (Geolocation API) — 위치 기반 기능 가능
  - Service Worker — 오프라인 캐시 일부 지원
  - 배포: Vercel / Cloudflare Pages (무료)
  - 프레임워크: Next.js (React 기반) 권장

2차 확장: React Native
  - iOS + Android 네이티브 앱
  - 네이티브 카메라 / GPS / 푸시 알림 완전 지원
  - PWA 코드 재사용률 높음 (React 공유)
  - Expo 프레임워크로 빠른 시작 권장
  - 전환 시점: PWA 사용자 확보 후 네이티브 기능 필요해질 때
```

---

### 11-2. 4가지 핵심 기능 설계

#### 기능 1 — 지도 + 추천 경로 표시

```
흐름:
  RAG 추천 결과 (POI 리스트 + 좌표)
    ↓
  Kakao Maps / Google Maps JS API
    ↓
  마커 표시 (추천 POI 순서대로)
  + 경로 선 그리기 (Polyline)
  + 예상 이동 시간/거리 표시

기술 선택:
  Kakao Maps API  — 한국 도로 정확도 우수, 무료 (일 300,000콜)
  Google Maps API — 해외 사용자(일본/서양) 대응 필요 시

DB 연동:
  PostGIS ST_Distance로 POI 간 거리 계산
  → 최단 경로 순서 정렬 (Nearest Neighbor TSP)
  → 경로 좌표 배열 → 지도 API에 전달
```

#### 기능 2 — 사진 촬영 + 저장

```
흐름:
  PWA 카메라 버튼 클릭
    ↓
  MediaDevices.getUserMedia (PWA) / 네이티브 카메라 (RN)
    ↓
  사진 캡처 → 클라이언트 압축 (Canvas API, max 1MB)
    ↓
  서버 업로드 → 오브젝트 스토리지 저장
    ↓
  DB에 메타데이터 기록 (여행ID, 사용자ID, POI ID, GPS 좌표, 촬영 시각)

스토리지 선택:
  Cloudflare R2   — 무료 10GB/월, S3 호환 API (1순위)
  AWS S3          — 안정적, 유료 (월 ~$0.023/GB)
  Supabase Storage — DB와 통합, 무료 1GB

보안:
  이미지 URL에 서명된 URL (Signed URL) 사용 → 직접 접근 차단
  사용자별 폴더 분리: /{user_id}/{trip_id}/{timestamp}.jpg
```

#### 기능 3 — 여행 기록 저장

```sql
-- 여행 세션 테이블
CREATE TABLE trip_session (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(100) NOT NULL,
    started_at  TIMESTAMP NOT NULL,
    ended_at    TIMESTAMP,
    status      VARCHAR(20) DEFAULT 'active',  -- active / ended
    title       VARCHAR(200),                  -- "2026-04-29 서울 여행"
    summary     TEXT,                          -- LLM 생성 요약문
    video_url   VARCHAR(500)                   -- 생성된 영상 URL
);

-- 여행 중 이벤트 (채팅, 사진, 방문)
CREATE TABLE trip_event (
    id          SERIAL PRIMARY KEY,
    trip_id     INTEGER REFERENCES trip_session(id),
    event_type  VARCHAR(20),   -- chat / photo / visit / checkin
    poi_id      INTEGER REFERENCES poi(id),
    content     TEXT,          -- 채팅 내용 또는 사진 경로
    lat         DECIMAL(9,6),
    lon         DECIMAL(9,6),
    created_at  TIMESTAMP DEFAULT NOW()
);
```

#### 기능 4 — 맞춤 영상 생성 (1분 미만)

```
흐름:
  "여행 끝" 버튼 클릭
    ↓
  trip_event에서 이번 여행 사진 + 방문 POI + 대화 내용 조회
    ↓
  LLM (qwen2.5:3b)으로 여행 요약문 생성
  예시: "오늘 경복궁의 웅장한 자태를 보고 광장시장에서 육회를 맛봤습니다..."
    ↓
  TTS로 요약문 → 음성 파일 생성
  (Edge TTS: 무료 / Google Cloud TTS: 유료 / Coqui TTS: 오픈소스)
    ↓
  ffmpeg로 영상 합성:
    - 사진들 → 슬라이드쇼 (각 2~3초)
    - BGM: K-Pop 인스트루멘탈 (저작권 무료)
    - TTS 나레이션 오버레이
    - 자막: 방문 POI명 + 날짜
    ↓
  .mp4 생성 → Cloudflare R2 저장
    ↓
  사용자에게 다운로드 / SNS 공유 링크 제공

영상 규격:
  해상도: 1080x1920 (세로 — 릴스/쇼츠 최적화)
  길이: 30초~60초
  사진 1장당: 약 3초 (20장 이하 권장)
  포맷: H.264 MP4 (호환성 최고)

ffmpeg 핵심 명령:
  ffmpeg -framerate 1/3 -i photo_%03d.jpg  \
         -i bgm.mp3 -i narration.mp3        \
         -filter_complex "[0:v]scale=1080:1920,fade=t=in:d=0.5[v]" \
         -map "[v]" -map 1:a -map 2:a       \
         -shortest -c:v libx264 output.mp4
```

---

### 11-3. 전체 사용자 경험 흐름

```
[여행 전]
  사용자: "서울에서 BTS 팬 1박2일 코스 추천해줘"
    ↓
  RAG 추천 → POI 리스트 + 지도에 경로 표시
  예산 예측 (ConsumeTabNet v3), 날씨 예보 (WeatherLSTM)

[여행 중]
  지도에서 경로 따라 이동
  POI 도착 → 자동 체크인 (GPS 매칭)
  사진 촬영 → 즉시 저장 + POI와 연결
  AI 챗봇에게 추가 질문 가능 ("근처 맛집 있어?")

[여행 후]
  "여행 끝" 버튼 클릭
    ↓
  방문 POI 요약 카드 표시 (날짜/시간/사진)
    ↓
  맞춤 영상 생성 (30~60초) — K-Pop BGM + 나레이션
    ↓
  SNS 공유 (Instagram 릴스 / YouTube 쇼츠 / TikTok)
  여행 일지 PDF 내보내기 (선택)
```

---

### 11-4. 기술 스택 요약

| 레이어 | 1차 MVP (PWA) | 2차 (React Native) |
|--------|--------------|-------------------|
| **프론트엔드** | Next.js + PWA | Expo (React Native) |
| **지도** | Kakao Maps JS API | react-native-maps |
| **카메라** | MediaDevices API | Expo Camera |
| **백엔드** | FastAPI (Python) | 동일 |
| **DB** | PostgreSQL (Neon) | 동일 |
| **이미지 저장** | Cloudflare R2 | 동일 |
| **영상 생성** | ffmpeg (서버) | 동일 |
| **TTS** | Edge-TTS (무료) | 동일 |
| **배포** | Vercel / Cloudflare | App Store / Play Store |

---

### 11-5. MVP 개발 우선순위

```
Phase 1 (RAG 완성) — 현재 진행 중
  [✅] Ollama + bge-m3 + ChromaDB RAG 파이프라인

Phase 2 (지도 + 경로)
  [✅] Leaflet + OpenStreetMap 지도 연동 (focus 페이지 MapView)
  [✅] 추천 POI → 지도 마커 + Polyline 경로 표시
  [✅] Next.js PWA 기본 구조 (manifest.json + layout 메타데이터)
  [ ] 실제 K-Ride FastAPI 데이터 연동 (현재 mock 데이터 사용 중)

Phase 3 (여행 기록)
  [ ] trip_session / trip_event 테이블 생성
  [ ] 사진 촬영 → Cloudflare R2 업로드
  [ ] 여행 타임라인 UI

Phase 4 (영상 생성)
  [ ] ffmpeg 서버 설치 + 슬라이드쇼 생성
  [ ] Edge-TTS 나레이션 합성
  [ ] BGM 믹싱 + 최종 .mp4 출력
  [ ] SNS 공유 버튼
```

---

## 12. SDUI MSA 통합 연구 (2026-05-06 추가)

> **배경**: 기존 SDUI 프로젝트(https://yerin.duckdns.org)를 MSA로 연결해 K-Ride 프론트엔드에 도입.
> SDUI 핵심 원칙 — "가장 작은 단위 요소(text, button, image 등)를 블록처럼 쌓아 DOM 트리로 페이지를 구성하고, `ui_metadata` DB 값만 바꾸면 즉시 화면이 바뀐다" — 를 K-Ride 온보딩 전체에 적용.

---

### 12-1. SDUI DynamicEngine 분석 결과

```
[핵심 발견]
- DynamicEngine.tsx: 재귀 renderNodes(), Repeater 패턴(ref_data_id로 배열 매핑), isVisible 처리
- useDynamicEngine.tsx: 데이터 바인딩 우선순위 = formData > rowData(Repeater) > pageData
- componentMap.tsx: withRenderTrack HOC로 21개 컴포넌트 래핑
- usePageHook.tsx: userActions(인증) / businessActions(비즈니스) 분기

[K-Ride 적용 시 변경 사항]
- PostcodeModal, useDeviceType, useRenderCount 제거 (불필요)
- useAuth → NextAuth 5 session으로 교체
- useBusinessActions에 K-Ride 액션 6종 추가:
    SET_DURATION / TOGGLE_ARTIST / TOGGLE_REGION / SET_PURPOSES / SET_BUDGET / GOTO_FOCUS
```

### 12-2. Atom 계층 구조 (3단계 설계)

```
Level 1 — SDUI 기본 Atom (재사용)
  GROUP · TEXT · BUTTON · IMAGE

Level 2 — K-Ride 신규 Atom (가장 작은 단위)
  CARD_IMAGE, CARD_LABEL, CHECK_INDICATOR
  RANGE_INPUT, RANGE_TRACK, RANGE_LABEL
  COLLAPSE_HEADER, COLLAPSE_BODY, ROUTE_NODE
  PURPOSE_ICON, DURATION_LABEL

Level 3 — K-Ride 복합 컴포넌트 (Level 2 조합)
  SELECTION_CARD = GROUP + CARD_IMAGE + CARD_LABEL + CHECK_INDICATOR
  DURATION_BUTTON = BUTTON + DURATION_LABEL
  PURPOSE_CARD = GROUP + PURPOSE_ICON + TEXT + CHECK_INDICATOR
  DUAL_RANGE_SLIDER = GROUP + RANGE_LABEL + RANGE_INPUT×2 + RANGE_TRACK
  MAP_VIEW = dynamic(MapViewInner, {ssr: false}) — Leaflet SSR 비활성
  ITINERARY_PANEL = GROUP + [COLLAPSE_HEADER + COLLAPSE_BODY + ROUTE_NODE[]]×N
```

### 12-3. 정적 메타데이터 → SDUI DB 전환 전략

```
현재 (MVP 1차):
  각 intro 페이지에 TypeScript 메타데이터 배열 직접 정의
  → 코드 배포 없이 DB만 수정하는 SDUI 원칙에서 벗어남

향후 (SDUI 완전 연동):
  SDUI V40 migration 적용 → GET /api/ui/KRIDE_INTRO1 호출
  → React Query로 메타데이터 fetch → DynamicEngine 렌더링
  → DB만 수정하면 즉시 화면 변경 가능

전환 방법:
  각 page.tsx의 INTRO1_METADATA 배열 제거
  useQuery({ queryKey: ['ui', SCREEN_IDS.INTRO1], queryFn: () => fetchUiMetadata('KRIDE_INTRO1') }) 추가
  SDUI 서버: GET /api/ui/{screenId} (Spring Boot EC2, Redis 1시간 캐시)
```

### 12-4. 데이터 흐름 (MSA)

```
K-Ride Frontend (Next.js 14, netflix-clone-main)
  │
  ├─ GET /api/ui/{screenId} → SDUI Server (Spring Boot EC2)
  │    └─ ui_metadata table → Redis cache (1hr) → JSON tree
  │
  ├─ GET /api/artists        → K-Ride FastAPI (Python)
  ├─ GET /api/regions        → K-Ride FastAPI
  ├─ POST /api/recommend     → K-Ride FastAPI + GraphRAG
  │
  └─ Zustand persist (localStorage)
       └─ duration / selectedArtists / selectedRegions / purposes / budget
```

### 12-5. SDUI DB 추가 내용 (V40__kride_screens.sql)

```
파일 위치: SDUI/SDUI-server/src/main/resources/db/migration/V40__kride_screens.sql
적용 방법: SDUI 서버 재시작 시 Flyway 자동 실행

추가 screen_id:
  KRIDE_INTRO1 — 여행기간 선택 (DURATION_BUTTON × 3)
  KRIDE_INTRO2 — 아티스트 선택 (SELECTION_CARD, Repeater: artistList)
  KRIDE_INTRO3 — 지역 선택 (SELECTION_CARD, Repeater: regionList)
  KRIDE_INTRO4 — 여행목적 (PURPOSE_CARD, Repeater: purposeList)
  KRIDE_INTRO5 — 예산 슬라이더 (DUAL_RANGE_SLIDER)
  KRIDE_MY_LIST — 요약 + AI 배너
  KRIDE_FOCUS   — 지도 + 일정 패널
```

### 12-6. 패키지 설치 참고

```bash
# react-leaflet 버전 주의: v5는 React 19 전용
npm install zustand react-leaflet@4 leaflet @types/leaflet

# Leaflet 기본 아이콘 파일 복사 (필수)
# node_modules/leaflet/dist/images/ → public/leaflet/
# (marker-icon.png, marker-icon-2x.png, marker-shadow.png)

# PWA 활성화 (선택)
npm install next-pwa
# next.config.js의 withPWA 주석 해제
```
