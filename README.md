# 🚀 K-Ride 2.0 (K-라이드) - AI 맞춤형 여행 추천 어시스턴트

**K-Ride 2.0**은 K-Pop, K-Drama 등 한국 대중문화(K-Culture)를 즐기기 위해 방문하는 외국인 관광객과 국내 팬들을 위한 **AI 기반 맞춤형 여행 일정 추천 및 가이드 시스템**입니다. 

기존의 단순 거리 기반 장소 추천을 넘어 사용자의 선호 아티스트, 방문 목적, 체류 기간을 분석하여 최적화된 동선과 장소를 추천하고, 시각적 요소와 AI 보이스가 결합된 멀티미디어 가이드(TTS, Video)를 생성합니다.

---

## 🌐 서비스 주소 (Web Entry Points)

| 화면 | URL | 비고 |
|---|---|---|
| 메인 (SDUI 웹) | https://yerin.duckdns.org/view/MAIN_PAGE | K-RIDE 여행 시작·K-POP 진입 카드 |
| 로그인 / 회원가입 | https://yerin.duckdns.org/view/LOGIN_PAGE · [/view/REGISTER_PAGE](https://yerin.duckdns.org/view/REGISTER_PAGE) | 카카오 로그인 지원 |
| 탐색 (전국 성지·맛집) | https://yerin.duckdns.org/view/TOUR_EXPLORE | 시/도·시군구, 작품별 필터, 성지 맛집 |
| K-POP 데모 웹 (kride, Vercel) | `https://<Vercel 프로젝트 도메인>/kpop` | main 머지 시 자동 배포. 도메인은 Vercel 대시보드의 kride 프로젝트에서 확인 후 이 표를 갱신할 것 |
| BTS 광화문 이벤트 | https://bts-gwanghwamun.vercel.app | 단독 이벤트 페이지 |
| API 문서 (Swagger) | https://yerin.duckdns.org/swagger-ui.html | Spring Boot 백엔드 (`/api/**`) |
| 모바일 앱 | Android (EAS `kride-mobile`, preview/production 채널) | 딥링크 스킴 `kride://` (예: `kride://KPOP_EXPLORE`) |

---

## ✨ 핵심 기능 (Core Focus)

이 프로젝트는 특히 다음 **5가지 핵심 기능**에 집중하여 기획 및 개발되었습니다:

1. 🗓️ **AI 맞춤형 여행 일정 생성**: 사용자의 선호 아티스트, 방문 목적, 체류 기간을 분석하여 동선이 최적화된 일별 여행 스케줄을 자동으로 구성합니다.
2. 🗺️ **인터랙티브 지도 및 마커 시각화**: 추천된 일정과 장소들을 지도(Kakao/Google Maps) 위에 직관적인 마커로 시각화하여 사용자가 전체 여행 동선을 한눈에 파악할 수 있도록 돕습니다.
3. 🕸️ **GraphRAG 기반 심층 장소 추천**: Neo4j 지식 그래프를 활용하여 아티스트와 촬영지 간의 복잡한 관계(FILMING_AT)를 추론해, 단순 검색을 넘어서는 깊이 있는 장소를 추천합니다.
4. 🤖 **LLM 기반 대화형 챗봇 (AI Assistant)**: Groq API와 고속 대규모 언어 모델(LLM)을 연동하여, 사용자의 여행 관련 질문에 실시간으로 답변하고 소통하는 챗봇 가이드를 제공합니다.
5. 🌐 **다국어 RAG 파이프라인**: 다국어 임베딩 모델과 벡터 검색 엔진(ChromaDB)을 결합한 RAG(검색 증강 생성) 기술로, 글로벌 사용자의 다양한 질의에 대해 환각(Hallucination) 없는 정확한 장소 데이터를 제공합니다.

---

## 🏗️ 아키텍처 및 파이프라인 (Architecture)

본 시스템은 빠른 응답 속도와 복잡한 AI 추론을 동시에 소화하기 위해 **투트랙 아키텍처(Two-track Architecture)**로 분리되어 있습니다.

### 🧠 1. 지식 그래프 및 LLM 기반 추천 시스템 (GraphRAG)
- **DB 및 검색 엔진**: PostgreSQL + PostGIS (공간 쿼리 및 위치 기반 최적화), ChromaDB (Vector 검색), Neo4j (Graph DB)
- **자연어 처리 (NLP)**: `intfloat/multilingual-e5-small` 다국어 임베딩을 통한 벡터 변환
- **GraphRAG**: Neo4j 기반으로 아티스트와 촬영지 간의 관계(FILMING_AT)를 추출하여 풍부한 여행 컨텍스트를 LLM에 전달
- **LLM 추론**: Groq API 기반 고속 추론으로 최적의 여행 일정(JSON) 및 자연어 챗봇 응답 생성

### 🎬 2. 멀티모달 생성형 AI 미디어 파이프라인
생성된 여행 일정을 바탕으로 다양한 생성 AI 모델을 병렬로 구동하여 맞춤형 비디오 가이드를 만듭니다.
- **비동기 태스크 큐**: 무거운 딥러닝 추론의 병목을 방지하고 서버 안정성을 확보하기 위해 **Celery**와 **Redis** 기반의 비동기 메시지 큐 시스템 위에서 백그라운드로 작동합니다.
- **지능형 라우팅 (Intelligent Routing)**: **BLIP-2**를 통해 입력된 이미지를 분석하여 인물/정적 객체 여부를 파악한 뒤, 무거운 비디오 생성(**CogVideoX-5b**)이나 가벼운 3D 패닝(**3D Photo Inpainting**), 뼈대 추출 애니메이션(**Animated Drawings**) 중 최적의 AI 모델을 선택하도록 자동 라우팅하여 메모리(OOM)와 비용을 최적화합니다.
- **오디오 합성 및 미디어 믹싱**: **GPT-SoVITS(V3)** 모델로 자연스러운 고품질 한국어 음성(TTS)을 합성하고, **MusicGen**을 통해 텍스트 프롬프트 기반의 맞춤형 BGM을 생성합니다. 이렇게 생성된 비디오와 오디오 요소들은 **FFmpeg**을 사용하여 비동기 환경에서 하나의 완벽한 영상(MP4)으로 최종 믹싱(Mixing)됩니다.

---

## ☁️ 배포 환경 및 인프라 (Deployment)

본 프로젝트는 서비스의 안정성과 AI 모델 추론을 위해 여러 클라우드 환경을 하이브리드로 구성하여 배포되었습니다.

| 구분 | 환경 및 기술 스택 | 주요 역할 |
| :--- | :--- | :--- |
| **Frontend** | AWS EC2 (Docker) / Next.js | 사용자 인터페이스 제공 및 GitHub Actions를 통한 CI/CD 배포 |
| **Backend API** | GCP Compute Engine / FastAPI | RAG 파이프라인 관리, Celery 비동기 큐잉, API 게이트웨이 |
| **AI Inference** | RunPod / TorchServe (GPU) | CogVideoX, GPT-SoVITS 등 무거운 딥러닝 모델 전용 추론 서버 |
| **Reverse Proxy** | Nginx / Let's Encrypt | `yerin.duckdns.org` 도메인 라우팅, 부하 분산 및 HTTPS 암호화 |

---

## 📈 MLOps 및 실험 기록 (MLflow)

Dagshub의 MLflow를 연동하여 모델 실험, 프롬프트 엔지니어링, RAG 성능 평가 및 생성 모델 추론 시간 등을 체계적으로 기록하였습니다. 

| 실험 목적 및 내용 | MLflow 대시보드 링크 |
| :--- | :--- |
| **Exp 18: RAG 파이프라인 및 LLM 성능 추적** | [🔗 상세 실험 내역 보기](https://dagshub.com/myelin24m/Kride.mlflow/#/experiments/18/runs/ff127c95a4c94633b4e82bb89ae39689) |
| **Exp 16: 다국어 임베딩 및 검색 성능 최적화** | [🔗 상세 실험 내역 보기](https://dagshub.com/myelin24m/Kride.mlflow/#/experiments/16/runs/c2bb1015fd2e4e6a8e1d76a1bac5050b) |
| **Exp 12: 미디어 생성(비디오/오디오) Task 시간 추적** | [🔗 상세 실험 내역 보기](https://dagshub.com/myelin24m/Kride.mlflow/#/experiments/12/runs?searchFilter=&orderByKey=attributes.start_time&orderByAsc=false&startTime=ALL&lifecycleFilter=Active&modelVersionFilter=All+Runs&datasetsFilter=W10%3D) |
| **Exp 6: 초기 모델 베이스라인 테스트** | [🔗 상세 실험 내역 보기](https://dagshub.com/myelin24m/Kride.mlflow/#/experiments/6/runs/61ad2dbe1d7f428bb6a90a6cf6d7d1d7) |

---

## 📑 프로젝트 문서 (Documents & Reports)

자세한 시스템 아키텍처와 기술적 성과는 아래의 로컬 HTML 문서를 브라우저에서 열어 확인하실 수 있습니다.

> [!TIP]
> 해당 파일들은 프로젝트를 다운로드 받은 후 웹 브라우저로 실행해 주세요.

- 📎 **[기술 보고서 (Technical Report)](./report/report.html)**: 시스템 구조, GraphRAG 설계, 모델 최적화 및 배포 파이프라인 상세 설명
- 📎 **[발표 자료 (Presentation Deck)](./report/deck.html)**: 프로젝트 개요 및 핵심 기능 발표용 슬라이드
