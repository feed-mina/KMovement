# K-Ride AI Agent 작업 가이드

> Claude Code 등 AI 에이전트가 이 프로젝트 작업 시 반드시 참고해야 할 규칙 모음
> **최종 업데이트**: 2026-04-27 (ConsumeTabNet v3 학습·시각화 완료 — test MAE ₩42,764원, R²=0.5939, 리포트 차트 16~21 생성)

---

## 0. 에이전트 역할 분담 원칙 🤝

**코드 실행과 라이브러리 설치는 사용자가 직접 한다. 에이전트는 코드 생성과 수정만 담당한다.**

### 에이전트가 하는 것 (코드 생성 / 수정)
- 새 스크립트 작성, 기존 코드 수정, 버그 픽스
- 실행 명령어를 텍스트로 안내 (직접 실행하지 않음)
- 필요한 라이브러리 목록을 텍스트로 안내 (`pip install ...`)

### 사용자가 하는 것 (실행 / 설치)
- `python ...` 스크립트 실행
- `pip install ...` 라이브러리 설치
- 터미널 명령어 실행

### 규칙 요약
| 작업 | 담당 |
|------|------|
| 코드 작성 / 수정 | 에이전트 |
| 실행 명령어 안내 | 에이전트 (텍스트로만) |
| `python` 스크립트 실행 | 사용자 |
| `pip install` 라이브러리 설치 | 사용자 |
| 환경변수 설정 | 사용자 |

---

## 0-1. 전국 단위 실데이터 원칙 🚨 (최우선 규칙)

**모델링 전처리는 반드시 실제 데이터 기반으로 전국 단위로 진행한다. 평균값/중앙값 대체(imputation)는 금지.**

### 핵심 규칙
- **평균값 대체 금지**: 결측치를 평균·중앙값으로 채워 학습하면 안 된다. 결측 행은 제거하거나 실제 소스 데이터를 추가 수집한다.
- **전국 단위 필수**: 서울·수도권 한정 데이터로 전국 모델을 만들지 않는다. 데이터가 수도권 한정이면 반드시 문서에 ⚠️ 수도권 한정 명시.
- **AI Hub 여행로그 한계**: `tn_visit_area_info_방문지정보_E.csv` (21,384행)는 **수도권 한정** 데이터. 이를 기반으로 학습한 모델(POI 추천, 매력도 TabNet)은 **수도권 한정** 모델이며, 전국 서비스 전에 전국 데이터 재학습 필수.
- **대체 금지 예시**: `district_danger` 매핑 실패 행을 중앙값으로 채우는 것은 임시 조치이며 이를 전국 모델로 발표하면 안 됨.

### 전국 데이터 부재 시 처리 기준
| 상황 | 올바른 처리 | 금지 처리 |
|------|-----------|---------|
| 좌표 결측 | 실 주소 지오코딩 추가 수집 | 시군구 중심 좌표로 대체 |
| 사고 데이터 미수집 지역 | 해당 시군구 제외 or 수집 후 진행 | 전국 평균 danger_score 채움 |
| AI Hub 수도권 한정 | 모델에 ⚠️ 수도권 한정 명시 | 전국 모델인 척 서비스 |
| 소상공인 데이터 일부 누락 | 해당 지역 소스 재수집 | 타 지역 평균값 채움 |

---

## 0-2. 원천 CSV 파일 현황 (프로젝트 루트 위치)

**아래 파일들은 `e:/krider/kride-project/` 루트에 위치. 전처리 스크립트가 이 경로를 BASE_DIR로 참조.**

### 음식점 원천 데이터
| 파일 | 행수 | 용도 | 전처리 스크립트 | 상태 |
|------|------|------|--------------|------|
| `소상공인시장진흥공단_상가(상권)정보_20251231/` | 전국 17개 시도 | 맛집/카페 주력 소스 | `preprocess_soho_food.py` | ✅ 처리 완료 → food_poi_nationwide.csv |
| `모범음식점정보.csv` | 65,418행 | is_exemplary 플래그 매칭 | `preprocess_soho_food.py` | ✅ 17,905건 매칭 완료 |
| `식품_관광식당.csv` | 519행 | is_tourist_certified 플래그 | `preprocess_soho_food.py` | ✅ 107건 매칭 완료 |
| `식품_관광유흥음식점업.csv` | 23행 | is_tourist_certified 플래그 | `preprocess_soho_food.py` | ✅ 처리 완료 |
| `식품_일반음식점.csv` | **2,271,530행** | 좌표 보완용 (TM→WGS84) | `preprocess_soho_food.py` | ✅ 참조 완료 |
| `식품_휴게음식점.csv` | **633,424행** | 좌표 보완용 (TM→WGS84) | `preprocess_soho_food.py` | ✅ 참조 완료 |

### 문화시설 원천 데이터
| 파일 | 행수 | sub_category | 전처리 스크립트 | 상태 |
|------|------|-------------|--------------|------|
| `문화_박물관 및 미술관.csv` | 1,265행 | museum | `preprocess_culture_poi.py` | ✅ 1,066행 처리 완료 |
| `문화_한옥체험업.csv` | 3,075행 | hanok | `preprocess_culture_poi.py` | ✅ 2,216행 처리 완료 |
| `문화_종합테마파크업.csv` | 81행 | theme_park | `preprocess_culture_poi.py` | ✅ 43행 처리 완료 |
| `문화_테마파크업(기타).csv` | 6,865행 | theme_park | `preprocess_culture_poi.py` | ✅ 2,112행 처리 완료 |
| `문화_종합휴양업.csv` | 41행 | resort | `preprocess_culture_poi.py` | ✅ 10행 처리 완료 |
| `문화_국내여행업.csv` | 20,126행 | travel_agency | `preprocess_culture_poi.py` | ✅ 3,208행 처리 완료 |
| `문화_종합여행업.csv` | 19,265행 | travel_agency | `preprocess_culture_poi.py` | ✅ 9,532행 처리 완료 |
| `문화_시내순환관광업.csv` | 114행 | tour_bus | `preprocess_culture_poi.py` | ✅ 65행 처리 완료 |
| **합계** | — | — | — | ✅ **18,252행** → `culture_poi_nationwide.csv` |

### 자전거 원천 데이터
| 파일 | 행수 | 용도 | 전처리 스크립트 | 상태 |
|------|------|------|--------------|------|
| `자전거보관소정보.csv` | 18,422행 | 자전거보관소 POI | `preprocess_bike_facility.py` | ✅ 18,277행 처리 완료 |
| `bicycleDataset12_24.csv` | 5,049행 | 자전거 사고다발지 (2012-2024) | `collect_nationwide_accident.py` | ✅ `district_danger_nationwide.csv` 생성에 통합 사용 |

### AI Hub 여행로그 (수도권 한정 ⚠️)
| 파일 | 행수 | 범위 | 활용 모델 |
|------|------|------|---------|
| `data/ai-hub/국내 여행로그 수도권_2023/02.라벨링데이터/tn_visit_area_info_방문지정보_E.csv` | 21,384행 | **수도권만** | POI 추천 (build_poi_recommender_v2), 매력도 TabNet (build_attraction_model) |

> ⚠️ AI Hub 여행로그는 수도권 한정. POI 추천·매력도 모델은 현재 **수도권 한정 모델**. 전국 확대 시 AI Hub 전국 여행로그 신청 필수.

### 국민여행조사 2024 (전국 소비 — ✅ 신규 보유)
| 파일 | 응답자 | 소비값 유효 | 범위 | 활용 모델 |
|------|--------|-----------|------|---------|
| `2024년 국민여행조사 국내여행 RAWDATA.xlsx` | 51,754명 | **26,342행** (50.9%) | **전국** | ConsumeTabNet v3 (preprocess_national_travel.py → build_consume_model_v3.py) |
| `국민여행조사_국내여행_2024_데이터.txt` | 동일 (탭 구분 텍스트) | 동일 | 전국 | 동일 |

> ✅ 소비값(D_TRA1_COST) 있는 26,342행은 여행 속성 전체 완전 — 필터만으로 즉시 학습 가능. 수도권 AI Hub(2,508행) 대비 10.5× 규모. **전국 소비 모델 v3 학습 가능**.

### 네이버 데이터랩 (POI 인기도 사이드 피처)
| 폴더 | 내용 | 활용 |
|------|------|------|
| `202504-202603_데이터랩_다운로드2/` | 전국 시군구별 방문자 수·비율 (202504~202603) | 시도별 popularity_ratio 피처 |
| `202504-202603_데이터랩_다운로드3/` | 카테고리별·지역별 검색건수 (음식 42.6% 1위) | POI 카테고리 가중치 |

---

## 1. 데이터 수집 우선 원칙 ⚠️

**모델 학습 스크립트를 실행하기 전에 반드시 데이터 범위를 확인할 것.**

### 규칙
- 학습에 사용할 데이터가 **전국(nationwide)** 기준인지 먼저 확인한다.
- 데이터 파일이 없거나, 특정 지역(예: 서울만)에 국한된 경우 → **코드 실행 전에 데이터 수집/전처리 스크립트를 먼저 실행**한다.
- 모델 학습 → 데이터 수집 순서는 **절대 금지**. 반드시 **데이터 수집 → 전처리 → 모델 학습** 순서.

### 현재 알려진 데이터 범위 문제 사례
| 데이터 | 현재 상태 | 필요 작업 |
|--------|-----------|-----------|
| 사고다발지 (`district_danger`) | **전국 381 시군구** (bicycle+pedestrian CSV 완료, DB 로드 완료) | ✅ 완료 |
| DB (로컬 PG16) | **전체 로드 완료 938,400행** — poi/trail/weather/danger (Neon→로컬 전환) | ✅ 완료 |
| 날씨 (ASOS) | 전국 67개 관측소 완료 | ✅ 완료 |
| 자전거도로 | 전국 16개 시도 완료 | ✅ 완료 |
| 안전 모델 | **전국 재학습 완료** R²=0.9995, F1=0.9987 (89.1% 매핑) | ✅ 완료 |
| 맛집 POI | **전국 803,096행** DB 로드 완료 (모범 17,905건, 관광 107건) | ✅ 완료 |
| 자전거보관소 | **전국 18,277행** DB 로드 완료 | ✅ 완료 |
| 문화시설 POI | **18,252행** DB 재로드 완료 (museum/hanok/theme_park/travel_agency/tour_bus) | ✅ 완료 |
| TourAPI 음식 POI | **10,535행** 전국 17개 시도, DB 적재 완료 (2026-04-27) | ✅ 완료 |
| K-Culture 촬영지 POI | **1,073행** 전국 (관광지 필터 62건 + 여행코스 1,065건), DB 적재 완료 (2026-04-27) | ✅ 완료 |

### 체크리스트 (새 모델 작업 시)
```
[ ] data/raw_ml/ 또는 data/dl/ 에 해당 CSV 존재 여부 확인
[ ] CSV가 전국 기준인지 확인 (파일명에 _nationwide 여부)
[ ] 없으면 src/data_collect/ 또는 src/preprocessing/ 스크립트 먼저 실행
[ ] 데이터 확인 후 모델 학습 진행
```

---

## 2. 모델 성능 시각화 및 보고서 저장 규칙 📊

**모든 모델 학습 완료 후 성능 지표를 이미지/표 파일로 저장해야 한다.**

### 규칙
- 모델 학습 스크립트는 학습 완료 후 반드시 시각화 결과를 파일로 저장한다.
- 저장 위치: `report/figures/` (이미지), `report/tables/` (CSV/JSON)
- 보고서 마크다운: `report/` 폴더에 모델별 `report_step{N}_{model_name}.md` 형식으로 작성

### 저장해야 할 시각화 항목
| 모델 유형 | 필수 시각화 |
|-----------|-------------|
| 분류 모델 (DL/ML) | Confusion Matrix, Classification Report 표, 학습 곡선 (loss/acc) |
| 회귀 모델 | 예측 vs 실제 scatter plot, Feature Importance 바 차트 |
| 모든 모델 공통 | 클래스/타겟 분포, 최종 성능 요약 표 (Acc/F1/R² 등) |

### 파일 명명 규칙
```
report/figures/{model_name}_confusion_matrix.png
report/figures/{model_name}_learning_curve.png
report/figures/{model_name}_feature_importance.png
report/tables/{model_name}_classification_report.csv
report/tables/{model_name}_performance_summary.json
```

### 현재 시각화 미완료 모델 목록
- [x] `WeatherLSTM` — ✅ 완료 (`src/dl/visualize_weather_lstm.py`)
- [x] `SafetyRegressor` — ✅ 완료 (`src/ml/visualize_safety_model.py`) R²=0.9995
- [x] `SafetyClassifier` — ✅ 완료 (`src/ml/visualize_safety_model.py`) F1=0.9987
- [ ] `AttractionTabNet` — ⏳ 대기 (`src/report/report_step2_poi_tabnet.py` 실행 필요) MAE=0.6558, R²=0.0662
- [ ] `POI Co-occurrence v2` — ⏳ 대기 (`src/ml/visualize_poi_recommender.py` 실행 필요) Recall@5=0.1342
- [ ] `ConsumeTabNet v2` — ⏳ 대기 (시각화 스크립트 미작성) R²=0.1277

---

## 3. 스크립트 실행 순서 (전체 파이프라인)

```
[데이터 수집]
  src/data_collect/collect_nationwide_weather.py      ✅ 완료 (73,426행)
  src/data_collect/collect_nationwide_facility.py     ✅ CSV 완료 (DB 저장 대기 — KAKAO_REST_API_KEY 필요)
  src/data_collect/collect_nationwide_accident.py     ✅ 완료 (381 시군구, bicycle+pedestrian CSV)

[전처리]
  src/preprocessing/preprocess_road_nationwide.py     ✅ 완료 (20,262행, 16개 시도)

[모델 학습]
  src/dl/build_weather_lstm.py                        ✅ 완료 (Acc=82.16%, F1=0.7213)
  src/ml/build_safety_model.py                        ✅ 완료 — 전국 재학습 (R²=0.9995, F1=0.9987, 89.1% 매핑)

[DB 초기화 / 데이터 적재]
  src/db/init_db.py                                   ✅ 완료
  src/db/load_data.py --table poi (tour_poi+facility)  ✅ 완료 (19,273행)
  src/db/load_data.py --table trail                    ✅ 완료 (20,262행)
  src/db/load_data.py --table weather                  ✅ 완료 (73,426행)
  src/db/load_data.py --table danger                   ✅ 완료 (381행)
  src/db/load_data.py --table bike_facility             ✅ 완료 (18,277행)
  src/db/load_data.py --table food_poi                  ✅ 완료 (803,096행)
  src/db/load_data.py --table culture_poi               ✅ 완료 (18,252행) — 2026-04-27 재로드

[시각화 보고서]
  src/dl/visualize_weather_lstm.py                    ✅ 완료
  src/ml/visualize_safety_model.py                    ✅ 완료 (R²=0.9995, F1=0.9987)

[공공데이터 전처리 — Week 1 나머지]
  src/preprocessing/preprocess_soho_food.py           ✅ 완료 (803,096행, 모범 17,905건, 관광 107건)
  src/preprocessing/preprocess_bike_facility.py       ✅ 완료 (18,277행, 25개 시도)
  src/preprocessing/preprocess_culture_poi.py         ✅ 완료 (18,252행, Vworld/JUSO API 지오코딩)

[DB 로드 — 전처리 완료 CSV → DB 적재]
  python src/db/load_data.py --table food_poi           ✅ 완료 (803,096행)
  python src/db/load_data.py --table culture_poi        ✅ 완료 (18,252행) — 2026-04-27 재로드

[추가 데이터 수집 — Week 1 나머지]
  TourAPI 음식 카테고리 (contentTypeId=39)            ✅ 완료 (2026-04-27)
    → 10,535행 수집, data/raw_ml/tourapi_food_nationwide.csv 저장
    → 시도별: 경기 2,736건 / 강원 1,302건 / 서울 1,204건 등 17개 시도
    → sub_category: 한식 6,250 / 카페·디저트 2,610 / 서양식 611 등
    → DB 적재 완료 (--db 옵션)
  K-Culture 촬영지 수집 (TourAPI)                     ✅ 완료 (2026-04-27)
    → 1,073행 수집, data/raw_ml/kculture_poi_nationwide.csv 저장
    → STEP1 키워드 검색: 0건 (KorService2 URL 404 — KorService1 정상)
    → STEP2 관광지(12) K-Culture 필터: 62건 (전국 8,666건 중 키워드 필터)
    → STEP3 여행코스(25): 1,065건 (17개 시도)
    → sub_category: tourism_course 919 / traditional_culture 71 / kpop_spot 42 등
    → DB 적재 완료 (--db 옵션)
  둘레길 데이터 수집 (두루누비 공공데이터)             ⏳ 필요

[소비 예측 모델 전국화]
  src/preprocessing/preprocess_national_travel.py     ✅ 완료 (2026-04-27)
    → 25,893행 (이상치 1%~99% 제거 후), 16개 컬럼
    → 1인당 중앙값 ₩78,500 / 전국 17개 시도 100% 매핑
    → season 균등 분포 (봄6,597/여름6,408/가을6,576/겨울6,312)
    → 출력: data/raw_ml/national_travel_consume.csv
  src/dl/build_consume_model_v3.py                    ✅ 완료 (2026-04-27)
    → 학습 데이터: national_travel_consume.csv (전국 25,893행, 이상치 제거 후)
    → 피처셋: travel_days/companion_cnt/trip_type/sido_enc/sa1_1~5/income_score/season (11개)
    → 최적 실험: n_d=32, n_steps=5, epochs=150 → test MAE=₩42,764원, R²=0.5939
    → epochs=200 재실행 결과: Early stop epoch=174, best_epoch=149 (동일)
    → 지역 매칭: sido_name_to_enc 역매핑 consume_meta_v3.json 저장 (POI sido → 모델 입력)
    → 출력: models/consume_regressor_v3.zip / consume_scaler_v3.pkl / consume_meta_v3.json
  src/report/report_step3_consume_tabnet.py            ✅ 완료 (2026-04-27)
    → 차트 6개 생성: 16_소비분포 / 17_피처중요도 / 18_학습곡선 / 19_산점도 / 20_시도분포 / 21_v2vs3비교
    → 출력: report/charts/16~21_consume_*.png

[프리미엄 맛집 수집 — 또간집/블루리본/레드리본]
  src/data_collect/collect_premium_food.py            🔜 보류 (추후 재개)
    → 현황: 8단계 지오코딩 체인 구현 완료 (Kakao→NCP→Naver→Vworld→JUSO→Nominatim)
    → 나무위키 또간집 파싱 확인 (~143건), 블루리본/레드리본 SPA 0건
    → 보류 사유:
        ① Kakao Local API 403 — 앱 카카오맵 제품 활성화 필요
        ② NCP Maps Geocoding 401 — console.ncloud.com 구독 신청 필요
        ③ 블루리본/레드리본 SPA 렌더링 → Selenium 또는 수동 CSV 필요
    → 재개 조건: Kakao 또는 NCP API 활성화 후 지오코딩 성공률 70%+ 확인 후 DB 병합

[1차 MVP — Week 2 백엔드]
  FastAPI 엔드포인트 재설계 (/poi/search, /course/generate, /weather, /chat)  ⏳ 필요
  Ollama LLM 연동 (llama3.1:8b or gemma2:9b)         ⏳ 필요
  RAG 파이프라인 (ChromaDB + POI 벡터 임베딩)         ⏳ 필요

[1차 MVP — Week 3 프론트엔드]
  React + Vite + Leaflet/네이버 지도                  ⏳ 필요
  카테고리별 필터 UI (맛집/K-Culture/관광/둘레길)     ⏳ 필요
  다국어 지원 (한/영)                                 ⏳ 필요

[1차 MVP — Week 4 배포]
  Docker Compose 구성                                 ⏳ 필요
  Vercel(React) + Railway(FastAPI) 배포               ⏳ 필요
  HuggingFace 모델 업로드                             ⏳ 필요
```

---

## 4. 환경 변수 체크리스트

```bash
KAKAO_REST_API_KEY=...   # 시설 POI 수집
DATABASE_URL=...          # Neon PostgreSQL (psycopg2 연결문자열)
VWORLD_API_KEY=...        # 문화시설 지오코딩 — 국토지리정보원 Vworld (테스트 후 선택)
JUSO_CONFIRM_KEY=...      # 문화시설 지오코딩 — 행안부 JUSO 도로명주소 API (테스트 후 선택)
```

---

## 5. 현재 생성된 모델 목록 (2026-04-27 업데이트 — 전처리 전종 완료, 모델 6종 생성 완료)

| # | 모델 파일 | 알고리즘 | 목적 | 성능 | 데이터 범위 |
|---|-----------|---------|------|------|------------|
| 1 | `models/dl/weather_lstm.pt` | LSTM | 날씨 3분류 (맑음/흐림/비·눈) | Acc=**82.16%**, F1=**0.7213** | 전국 67개 관측소 ✅ |
| 2 | `models/safety_regressor.pkl` | RandomForest | 안전점수 회귀 (0~1) | R²=**0.9995** | 전국 도로 + 전국 사고 381 시군구 ✅ |
| 3 | `models/safety_classifier.pkl` | RandomForest | 위험등급 3분류 | F1=**0.9987** | 전국 도로 + 전국 사고 381 시군구 ✅ |
| 4 | `models/poi_cooccurrence_v2.pkl` | Co-occurrence | POI 추천 (방문 시퀀스 기반) | Recall@5=**0.1342**, Recall@10=**0.1751** (베이스라인 대비 3.6× 향상) | ⚠️ 수도권 한정 (AI Hub 21,384행) |
| 5 | `models/attraction_regressor.zip` | TabNet | POI 매력도 점수 회귀 (1~5) | MAE=**0.6558**, R²=**0.0662** | ⚠️ 수도권 한정 (AI Hub 기반) |
| 6 | `models/consume_regressor_v2.zip` | TabNet | 여행 소비 예측 (원) | R²=**0.1277** | ⚠️ 수도권 한정 (AI Hub 2,508행) |

> ⚠️ 데이터 누수(leakage) 잔존: `safety_index_v2` 라벨이 학습 피처(width_m, district_danger)로부터 직접 계산됨. 실제 외부 사고 건수를 타겟으로 삼는 재설계 권장 (현재는 district_danger lookup 방식으로 API 서비스 가능).
> 매핑 성공: 89.1% (18,048/20,262행) — 기존 3.1% 대비 대폭 향상.
> 모델 4·5·6은 수도권 한정 데이터로 학습. 전국 확대 시 AI Hub 전국 여행로그 재신청 필수.
