
 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 K-Ride TorchServe + Celery 아키텍처 구축 계획       

 Context

 현재 K-Ride FastAPI 서버는 모든 ML 모델을 프로세스 내에서 직접 로딩한다 (pickle, torch, sentence-transformers). architecture_expand_0520.md에 따라
 향후 사진→TTS→영상 파이프라인을 추가하려면, 모델별 Python/CUDA 환경 격리가 필수이고 이를 위해 TorchServe를 도입해야 한다. 기존 EC2 인프라를 유지하면서
  Phase 2(TorchServe + Celery) 구현에 집중한다.

 ---
 현재 모델 사용 현황 (인라인 로딩)

 FastAPI (src/api/fastapi_server.py)

 ┌──────────────────────────────────┬──────────────────────────────┬───────────────────────────────────┐
 │               모델               │          로딩 방식           │               파일                │
 ├──────────────────────────────────┼──────────────────────────────┼───────────────────────────────────┤
 │ NetworkX Graph                   │ pickle.load(route_graph.pkl) │ src/api/fastapi_server.py:116-118 │
 ├──────────────────────────────────┼──────────────────────────────┼───────────────────────────────────┤
 │ CSV 데이터 (road, facility, poi) │ pd.read_csv()                │ src/api/fastapi_server.py:132-144 │
 └──────────────────────────────────┴──────────────────────────────┴───────────────────────────────────┘

 Ensemble Client (src/api/ensemble_client.py)

 ┌───────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
 │           모델            │            로딩 방식             │               파일               │
 ├───────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
 │ LightGBM/XGBoost Ensemble │ pickle.load(ensemble_ranker.pkl) │ src/api/ensemble_client.py:24-33 │
 ├───────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
 │ Feature Engineering       │ compute_features() (numpy)       │ src/ml/feature_engineering.py    │
 └───────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘

 RAG Client (src/api/rag_client.py)

 ┌─────────────────────────────────────────────┬─────────────────────────┬────────┐
 │                    모델                     │        로딩 방식        │  크기  │
 ├─────────────────────────────────────────────┼─────────────────────────┼────────┤
 │ SentenceTransformer (multilingual-e5-small) │ 싱글턴 로딩             │ ~100MB │
 ├─────────────────────────────────────────────┼─────────────────────────┼────────┤
 │ ChromaDB                                    │ PersistentClient (로컬) │ ~500MB │
 ├─────────────────────────────────────────────┼─────────────────────────┼────────┤
 │ Groq LLM                                    │ 외부 API 호출           │ N/A    │
 └─────────────────────────────────────────────┴─────────────────────────┴────────┘

 Chatbot (subproject/NLP/chatbot/chatbot_chain.py)

 ┌─────────────────────────────────────────────┬─────────────────────────┬────────┐
 │                    모델                     │        로딩 방식        │  크기  │
 ├─────────────────────────────────────────────┼─────────────────────────┼────────┤
 │ SentenceTransformer (multilingual-e5-small) │ 싱글턴 (중복!)          │ ~100MB │
 ├─────────────────────────────────────────────┼─────────────────────────┼────────┤
 │ Cross-encoder Reranker (ms-marco-MiniLM)    │ 싱글턴                  │ ~80MB  │
 ├─────────────────────────────────────────────┼─────────────────────────┼────────┤
 │ ChromaDB                                    │ PersistentClient (로컬) │ 공유   │
 ├─────────────────────────────────────────────┼─────────────────────────┼────────┤
 │ Groq LLM                                    │ 외부 API 호출           │ N/A    │
 └─────────────────────────────────────────────┴─────────────────────────┴────────┘

 DL 모듈 (FastAPI에서 import)

 ┌────────────────────────────────┬─────────────────────────────┬──────────────────────────────┐
 │              모델              │          로딩 방식          │             파일             │
 ├────────────────────────────────┼─────────────────────────────┼──────────────────────────────┤
 │ WeatherLSTM                    │ torch.load(weather_lstm.pt) │ src/dl/build_weather_lstm.py │
 ├────────────────────────────────┼─────────────────────────────┼──────────────────────────────┤
 │ Event NER (mDeBERTa zero-shot) │ transformers pipeline       │ src/dl/build_event_ner.py    │
 └────────────────────────────────┴─────────────────────────────┴──────────────────────────────┘

 ---
 TorchServe 분리 전략

 원칙: 모든 모델을 TorchServe로 옮길 필요 없음

 - TorchServe로 분리: GPU가 필요하거나 Python 환경 격리가 필요한 모델
 - 인라인 유지: CPU 경량 작업 (pickle, CSV, NetworkX, Groq API 호출)

 TorchServe로 이전할 모델 (4개)

 ┌────────────────────────────────┬──────────────────┬─────────────────────────────┬─────────────────────────────────────┐
 │              모델              │     MAR 이름     │           Handler           │                이유                 │
 ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤
 │ SentenceTransformer (e5-small) │ embedder.mar     │ text → 384-dim vector       │ FastAPI/Chatbot 중복 제거, GPU 활용 │
 ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤
 │ Cross-encoder Reranker         │ reranker.mar     │ (query, doc) pairs → scores │ GPU 가속 효과 큼                    │
 ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤
 │ WeatherLSTM                    │ weather_lstm.mar │ 14-day seq → 3-class        │ PyTorch 모델                        │
 ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤
 │ Event NER (mDeBERTa)           │ event_ner.mar    │ text → classification       │ transformers 모델, VRAM 필요        │
 └────────────────────────────────┴──────────────────┴─────────────────────────────┴─────────────────────────────────────┘

 인라인 유지 (TorchServe 불필요)

 ┌────────────────────────────┬────────────────────────────────────────────┐
 │            모델            │                    이유                    │
 ├────────────────────────────┼────────────────────────────────────────────┤
 │ Ensemble Ranker (LightGBM) │ scikit-learn/LightGBM, CPU 전용, <1ms 추론 │
 ├────────────────────────────┼────────────────────────────────────────────┤
 │ NetworkX Graph             │ 데이터 구조, 모델 아님                     │
 ├────────────────────────────┼────────────────────────────────────────────┤
 │ CSV DataFrames             │ 데이터 로딩                                │
 ├────────────────────────────┼────────────────────────────────────────────┤
 │ Groq LLM                   │ 외부 API                                   │
 ├────────────────────────────┼────────────────────────────────────────────┤
 │ ChromaDB                   │ 별도 서버 모드로 분리 (아래 참조)          │
 └────────────────────────────┴────────────────────────────────────────────┘

 ---
 구현 계획

 Step 1: TorchServe 모델 핸들러 작성

 신규 디렉토리: torchserve/

 torchserve/
 ├── handlers/
 │   ├── embedder_handler.py      # SentenceTransformer → encode
 │   ├── reranker_handler.py      # CrossEncoder → predict
 │   ├── weather_lstm_handler.py  # WeatherLSTM → predict_weather
 │   └── event_ner_handler.py     # zero-shot classification
 ├── config.properties            # TorchServe 설정
 ├── package_models.sh            # .mar 패키징 스크립트
 ├── Dockerfile                   # TorchServe Docker 이미지
 └── requirements.txt

 embedder_handler.py 핵심 로직:
 class EmbedderHandler(BaseHandler):
     def initialize(self, context):
         self.model = SentenceTransformer("intfloat/multilingual-e5-small")

     def preprocess(self, data):
         return [item["body"]["text"] for item in data]

     def inference(self, texts):
         return self.model.encode(texts, normalize_embeddings=True).tolist()

 reranker_handler.py 핵심 로직:
 class RerankerHandler(BaseHandler):
     def initialize(self, context):
         self.model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

     def inference(self, pairs):

     
         return self.model.predict(pairs).tolist()

 Step 2: TorchServe Docker 구성

 파일: torchserve/Dockerfile
 FROM pytorch/torchserve:latest-gpu
 COPY handlers/ /home/model-store/handlers/
 COPY config.properties /home/model-store/
 COPY *.mar /home/model-store/
 EXPOSE 8085 8086 7070

 파일: torchserve/config.properties
 inference_address=http://0.0.0.0:8085
 management_address=http://0.0.0.0:8086
 model_store=/home/model-store
 load_models=all
 number_of_gpu=1
 default_workers_per_model=1
 job_queue_size=100
 batch_size=4
 max_batch_delay=100

 Step 3: FastAPI 코드 리팩토링 — TorchServe HTTP 클라이언트

 신규: src/api/torchserve_client.py
 """TorchServe HTTP 추론 클라이언트"""
 import httpx
 import os

 TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8085")

 async def embed_texts(texts: list[str]) -> list[list[float]]:
     """SentenceTransformer 임베딩 (TorchServe 경유)"""
     async with httpx.AsyncClient(timeout=10.0) as client:
         resp = await client.post(
             f"{TORCHSERVE_URL}/predictions/embedder",
             json={"text": texts}
         )
         return resp.json()

 async def rerank(query: str, documents: list[str]) -> list[float]:
     """Cross-encoder 리랭킹 (TorchServe 경유)"""
     async with httpx.AsyncClient(timeout=10.0) as client:
         resp = await client.post(
             f"{TORCHSERVE_URL}/predictions/reranker",
             json={"query": query, "documents": documents}
         )
         return resp.json()

 async def predict_weather(sequence: list) -> dict:
     """WeatherLSTM 예측 (TorchServe 경유)"""
     async with httpx.AsyncClient(timeout=5.0) as client:
         resp = await client.post(
             f"{TORCHSERVE_URL}/predictions/weather_lstm",
             json={"sequence": sequence}
         )
         return resp.json()

 수정: src/api/rag_client.py
 - get_embedder() → torchserve_client.embed_texts() 로 교체
 - SentenceTransformer 직접 import 제거

 수정: subproject/NLP/chatbot/chatbot_chain.py
 - _get_embedder() → torchserve_client.embed_texts() 교체
 - _get_reranker() → torchserve_client.rerank() 교체

 Step 4: Celery + Redis 비동기 작업 큐

 신규: src/api/celery_app.py
 from celery import Celery
 import os

 REDIS_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")

 celery = Celery("kride", broker=REDIS_URL, backend=REDIS_URL)
 celery.conf.update(
     task_serializer="json",
     result_serializer="json",
     accept_content=["json"],
     task_acks_late=True,        # Spot VM 대비: 작업 완료 후 ACK
     worker_prefetch_multiplier=1,
 )

 신규: src/api/tasks.py
 """비동기 Celery 태스크 (Phase 2: 기존 모델 + Phase 3: 미디어 파이프라인)"""
 from celery_app import celery
 import httpx

 TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8085")

 @celery.task(bind=True, max_retries=3)
 def task_embed_texts(self, texts: list[str]) -> list:
     """배치 임베딩 (비동기)"""
     resp = httpx.post(f"{TORCHSERVE_URL}/predictions/embedder", json={"text": texts})
     return resp.json()

 @celery.task(bind=True, max_retries=3)
 def task_predict_weather(self, sequence: list) -> dict:
     """날씨 예측 (비동기)"""
     resp = httpx.post(f"{TORCHSERVE_URL}/predictions/weather_lstm", json={"sequence": sequence})
     return resp.json()

 # Phase 3 태스크 (미래)
 @celery.task(bind=True, max_retries=3)
 def task_generate_tts(self, text: str, voice_id: str) -> str:
     """GPT-SoVITS TTS → GCS URL 반환"""
     pass

 @celery.task(bind=True, max_retries=3)
 def task_generate_video(self, image_url: str, track: str) -> str:
     """CogVideoX/AnimatedDrawings → GCS URL 반환"""
     pass

 Step 5: ChromaDB 서버 모드 분리

 현재 FastAPI와 Chatbot이 동일한 chroma_db/ 디렉토리를 PersistentClient로 직접 접근. TorchServe VM에서 ChromaDB 서버 모드로 운영.

 수정: src/api/rag_client.py:26-30
 # Before:
 _chroma = chromadb.PersistentClient(path=CHROMA_PATH)
 # After:
 CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
 CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8100"))
 _chroma = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)

 수정: subproject/NLP/chatbot/chatbot_chain.py:54-55 — 동일 변경

 Step 6: Docker Compose (GPU VM용)

 신규: docker-compose.gpu.yml
 version: '3.8'
 services:
   torchserve:
     build: ./torchserve
     ports:
       - "8085:8085"
       - "8086:8086"
     deploy:
       resources:
         reservations:
           devices:
             - capabilities: [gpu]
     volumes:
       - ./models:/home/model-store/models

   chromadb:
     image: chromadb/chroma:latest
     ports:
       - "8100:8000"
     volumes:
       - ./chroma_db:/chroma/chroma

   redis:
     image: redis:7-alpine
     ports:
       - "6379:6379"

   celery-worker:
     build:
       context: .
       dockerfile: Dockerfile.worker
     command: celery -A src.api.celery_app worker -l info -c 2
     depends_on:
       - redis
       - torchserve
     environment:
       - TORCHSERVE_URL=http://torchserve:8085
       - CELERY_BROKER_URL=redis://redis:6379/1

 ---
 수정 대상 파일 요약

 ┌─────────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
 │                  파일                   │                          변경 내용                           │
 ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/api/rag_client.py                   │ SentenceTransformer → TorchServe HTTP, ChromaDB → HttpClient │
 ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ subproject/NLP/chatbot/chatbot_chain.py │ embedder/reranker → TorchServe HTTP, ChromaDB → HttpClient   │
 ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ subproject/NLP/chatbot/config.py        │ CHROMA_HOST/PORT 환경변수 추가                               │
 ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ src/api/fastapi_server.py               │ WeatherLSTM/EventNER import → TorchServe 호출로 교체         │
 ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 │ .env                                    │ TORCHSERVE_URL, CHROMA_HOST, CELERY_BROKER_URL 추가          │
 └─────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘

 신규 파일

 ┌─────────────────────────────────────────────┬──────────────────────────────────┐
 │                    파일                     │               내용               │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ torchserve/handlers/embedder_handler.py     │ SentenceTransformer MAR handler  │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ torchserve/handlers/reranker_handler.py     │ CrossEncoder MAR handler         │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ torchserve/handlers/weather_lstm_handler.py │ WeatherLSTM MAR handler          │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ torchserve/handlers/event_ner_handler.py    │ zero-shot classification handler │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ torchserve/config.properties                │ TorchServe 설정                  │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ torchserve/package_models.sh                │ .mar 패키징 스크립트             │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ torchserve/Dockerfile                       │ TorchServe GPU Docker 이미지     │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ src/api/torchserve_client.py                │ TorchServe HTTP 클라이언트       │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ src/api/celery_app.py                       │ Celery 설정                      │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ src/api/tasks.py                            │ Celery 태스크 정의               │
 ├─────────────────────────────────────────────┼──────────────────────────────────┤
 │ docker-compose.gpu.yml                      │ GPU VM용 Docker Compose          │
 └─────────────────────────────────────────────┴──────────────────────────────────┘

 ---
 구현 순서

 1. torchserve/ 디렉토리 + 4개 handler 작성
 2. package_models.sh — .mar 파일 생성 스크립트
 3. torchserve/Dockerfile + config.properties
 4. src/api/torchserve_client.py — HTTP 클라이언트
 5. src/api/rag_client.py 수정 — embedder → TorchServe
 6. subproject/NLP/chatbot/chatbot_chain.py 수정 — embedder/reranker → TorchServe
 7. ChromaDB → HttpClient 모드 전환 (rag_client.py, chatbot_chain.py, config.py)
 8. src/api/celery_app.py + tasks.py 작성
 9. docker-compose.gpu.yml 작성
 10. .env 환경변수 추가

 검증 방법

 1. 로컬 TorchServe 테스트 (GPU 없이도 CPU 모드 가능):
 docker-compose -f docker-compose.gpu.yml up torchserve chromadb redis
 curl -X POST http://localhost:8085/predictions/embedder -d '{"text": ["서울 여행"]}'
 curl -X POST http://localhost:8085/predictions/reranker -d '{"query":"서울","documents":["서울 맛집","부산 해변"]}'
 2. FastAPI 연동 테스트:
 TORCHSERVE_URL=http://localhost:8085 uvicorn src.api.fastapi_server:app --port 8000
 curl http://localhost:8000/api/health
 curl -X POST http://localhost:8000/api/recommend/ai -d '...'
 3. Chatbot 연동 테스트:
 TORCHSERVE_URL=http://localhost:8085 CHROMA_HOST=localhost CHROMA_PORT=8100 \
   uvicorn subproject.NLP.chatbot.chatbot_server:app --port 8001
 curl -X POST http://localhost:8001/chat -d '{"message":"서울 맛집 추천"}'
 4. Celery Worker 테스트:
 celery -A src.api.celery_app worker -l info
 # 별도 터미널에서 태스크 전송 확인
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌