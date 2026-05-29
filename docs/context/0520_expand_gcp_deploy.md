
       GCP Free-Tier Deployment Plan for K-Ride MSA

       Table of Contents

       1. Current State Summary
       2. Phase 1 -- Free Tier / Minimal Cost
       3. Phase 2 -- With GCP Credits (GPU)
       4. Phase 3 -- Production Pipeline
       5. CI/CD Migration
       6. Code Changes Required
       7. Risk Matrix

       ---
       0. Current State Summary

       Services inventory from codebase analysis:

       ┌─────────────────┬──────┬────────────────────────────┬─────────────────────────────────────────────┬────────────────────────────────────────
       ───┐
       │     Service     │ Port │          Runtime           │                   Docker                    │             Key Dependencies
          │
       ├─────────────────┼──────┼────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────
       ───┤
       │ Spring Boot     │      │                            │ subproject/SDUI/SDUI-server/Dockerfile      │ PostgreSQL, Redis, Flyway, JWT,
          │
       │ (SDUI)          │ 8080 │ Java 17, Temurin           │ (multi-stage)                               │ Kakao/Google OAuth, AWS S3, GCP
       Document  │
       │                 │      │                            │                                             │ AI
          │
       ├─────────────────┼──────┼────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────
       ───┤
       │ FastAPI         │ 8000 │ Python 3.9, torch 2.11     │ subproject/ml-server/Dockerfile             │ Neo4j AuraDB, ChromaDB (local), Groq
       LLM, │
       │ (K-Ride)        │      │                            │                                             │  Supabase, NetworkX graph, pickle
       models  │
       ├─────────────────┼──────┼────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────
       ───┤
       │ NLP Chatbot     │ 8001 │ Python 3.9+,               │ No Dockerfile yet                           │ ChromaDB (local, shared), Groq LLM,
          │
       │                 │      │ sentence-transformers      │                                             │ cross-encoder reranker
          │
       ├─────────────────┼──────┼────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────
       ───┤
       │ Next.js PWA     │ 3000 │ Node.js, React 19          │ None (Vercel)                               │ Proxies to 8080 + 8000
          │
       ├─────────────────┼──────┼────────────────────────────┼─────────────────────────────────────────────┼────────────────────────────────────────
       ───┤
       │ team/model      │ 8000 │ Python 3.11                │ team/model/Dockerfile                       │ PaddleOCR, ultralytics
          │
       │ (PaddleOCR)     │      │                            │                                             │
          │
       └─────────────────┴──────┴────────────────────────────┴─────────────────────────────────────────────┴────────────────────────────────────────
       ───┘









       External cloud services (no migration needed):
       - Neo4j AuraDB -- already cloud-hosted
       - Supabase -- already cloud-hosted (images + data)
       - Groq LLM API -- external API
       - Vercel -- frontend hosting

       Data volumes that need migration:
       - ChromaDB local directory (chroma_db/) -- ~5 collections, used by both FastAPI (port 8000) and Chatbot (port 8001)
       - PostgreSQL (SDUI) on EC2 Docker -- sdui-db container
       - Model files: models/dl/weather_lstm.pt, models/safety_regressor.pkl, models/safety_classifier.pkl, route_graph.pkl, ensemble ranker pickle
       - CSV data files: road_scored.csv, facility_clean.csv, tour_poi.csv
       - PDF dataset: 17+ files in dataset/pdf/

       Current CI/CD (from D:\kride-project\subproject\SDUI\.github\workflows\deploy.yml):
       - GitHub Actions -> Docker Hub -> SSH to AWS EC2
       - Spring Boot only (FastAPI deployment commented out)
       - Uses appleboy/ssh-action for remote Docker commands

       ---
       Phase 1: Free Tier / Minimal Cost ($0-$15/month)

       Goal

       Get all services running on GCP using free tier and near-free resources. Sufficient for development and demo traffic (< 100 users/day).

       1.1 Service Placement

       ┌──────────────┬────────────────────────┬────────────────────────────────────────────────────────────────────────────────┬───────────────────
       ────┐
       │   Service    │      GCP Resource      │                                   Rationale                                    │     Monthly Cost
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ Spring Boot  │ Cloud Run (free tier)  │ Stateless JAR, scales to zero. Free tier: 2M requests, 360K vCPU-seconds, 180K │ $0
           │
       │ (SDUI)       │                        │  GiB-seconds                                                                   │
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ FastAPI      │ Compute Engine         │ Loads ~200MB of models + NetworkX graph into memory at startup. Cloud Run cold │
           │
       │ (K-Ride)     │ e2-micro               │  start would be 30-60s. Always-on is needed. Free tier: 1 e2-micro in          │ $0
           │
       │              │                        │ us-central1, 30GB standard disk                                                │
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ NLP Chatbot  │ Colocated on same      │ Shares ChromaDB with FastAPI. sentence-transformers model is ~100MB            │ $0 (shared)
           │
       │              │ e2-micro               │                                                                                │
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ PostgreSQL   │ Cloud SQL (free trial) │ Cloud SQL has 90-day free trial. After trial: use Supabase free tier (500MB)   │ $0 (trial) -> $0
           │
       │ (SDUI)       │  or Supabase free tier │ or Neon free tier (you already have a Neon URL in .env)                        │ (Neon/Supabase)
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ Redis        │ Memorystore free trial │ Spring Boot uses Redis for cache + SQL query cache. Alternative: use Cloud     │ $0
           │
       │              │  or Cloud Run sidecar  │ Run's built-in memory for small cache, or Redis on e2-micro                    │
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ ChromaDB     │ Local on e2-micro      │ Both FastAPI and Chatbot read from chroma_db/. Keep as local directory on the  │ $0
           │
       │              │                        │ e2-micro instance. Total data is small (< 500MB)                               │
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ Next.js PWA  │ Vercel (stay)          │ Already deployed. No change needed                                             │ $0
           │
       ├──────────────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────┼───────────────────
       ────┤
       │ Model files  │ Cloud Storage (5GB     │ Store .pt, .pkl, CSV files. Download to e2-micro at startup                    │ $0
           │
       │              │ free)                  │                                                                                │
           │
       └──────────────┴────────────────────────┴────────────────────────────────────────────────────────────────────────────────┴───────────────────
       ────┘


















       1.2 Architecture Diagram (Phase 1)

       [Vercel - Next.js PWA]
               |
               |-- /api/* --> [Cloud Run - Spring Boot :8080]
               |                    |
               |                    |--> Cloud SQL / Neon (PostgreSQL)
               |                    |--> Redis (Memorystore / in-process)
               |                    |--> Supabase (external)
               |
               |-- /kride-api/* --> [e2-micro VM - FastAPI :8000 + Chatbot :8001]
                                         |
                                         |--> ChromaDB (local dir)
                                         |--> Neo4j AuraDB (external)
                                         |--> Groq LLM (external)
                                         |--> GCS (model files)

       1.3 Compute Engine e2-micro Setup

       The e2-micro instance (0.25 vCPU, 1GB RAM) is tight for running both FastAPI + Chatbot with ML models. Critical optimizations:

       Memory budget on 1GB RAM:
       - OS overhead: ~200MB
       - FastAPI + NetworkX graph + pickle models: ~300MB
       - Chatbot + sentence-transformers (multilingual-e5-small, 384-dim): ~200MB
       - ChromaDB: ~100MB
       - Remaining: ~200MB

       This is extremely tight. If it does not fit, upgrade to e2-small (2GB RAM, ~$6.11/month in us-central1) or e2-medium (4GB, ~$12.22/month).

       Recommendation: Start with e2-small ($6.11/month) for reliability. The e2-micro free tier only has 1GB which will likely OOM when loading
       sentence-transformers + torch models simultaneously.

       Docker Compose on e2-micro/e2-small:

       # docker-compose.gcp.yml (to be created)
       version: '3.8'
       services:
         kride-fastapi:
           build:
             context: .
             dockerfile: Dockerfile.fastapi  # new, trimmed requirements
           ports:
             - "8000:8000"
           volumes:
             - ./chroma_db:/app/chroma_db
             - ./models:/app/models
             - ./data:/app/data
           env_file: .env.gcp

         kride-chatbot:
           build:
             context: ./subproject/NLP
             dockerfile: Dockerfile.chatbot  # new
           ports:
             - "8001:8001"
           volumes:
             - ./chroma_db:/app/chroma_db  # shared ChromaDB
           env_file: .env.gcp

         redis:
           image: redis:7-alpine
           ports:
             - "6379:6379"

       1.4 Cloud Run for Spring Boot

       The existing subproject/SDUI/SDUI-server/Dockerfile is reusable with minimal changes.

       Cloud Run configuration:
       - Region: asia-northeast3 (Seoul) for latency, or us-central1 for free tier eligibility
       - Memory: 512MB (Spring Boot JAR is ~150MB, runtime ~400MB)
       - CPU: 1 vCPU
       - Min instances: 0 (scale to zero for cost savings)
       - Max instances: 2
       - Concurrency: 80

       Critical issue: Cloud Run requires the database connection to go through a Cloud SQL Auth Proxy or a public IP. If using Neon/Supabase for
       PostgreSQL, this is simpler since they provide public connection strings with SSL.

       1.5 Database Strategy

       Option A (recommended for Phase 1): Use Neon free tier
       - You already have a Neon connection string in .env:
       postgresql://neondb_owner:npg_...@ep-fragrant-dream-aozv5jxk-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb
       - Neon free tier: 0.5GB storage, auto-suspend after 5 minutes of inactivity
       - Run Flyway migrations against Neon from local machine first
       - Change SPRING_DATASOURCE_URL in Cloud Run env vars

       Option B: Cloud SQL free trial (90 days)
       - db-f1-micro instance, 10GB storage
       - After 90 days, costs ~$7.67/month
       - Better performance than Neon for sustained workloads

       Redis:
       - For Phase 1, embed Redis in the e2-micro/e2-small VM via Docker
       - Spring Boot on Cloud Run connects to the VM's Redis via internal VPC or public IP with firewall rules
       - Alternative: skip Redis entirely and disable caching in Spring Boot for Phase 1 (set spring.data.redis.host to empty, rely on in-memory
       cache)

       1.6 Networking

       VPC: default
       Subnet: us-central1 (or asia-northeast3)

       Cloud Run (Spring Boot)
         ├── Ingress: Allow all (public HTTPS)
         ├── Egress: connects to Neon PG (external), Redis on VM (internal VPC)
         └── Custom domain: yerin.duckdns.org (or new GCP domain)

       e2-micro/e2-small VM
         ├── External IP: Ephemeral (or static for $0 if attached to running instance)
         ├── Firewall: allow TCP 8000, 8001 from Vercel IPs + Cloud Run
         └── Internal: Redis on localhost:6379

       Firewall rules to create:
       - allow-kride-api: TCP 8000, 8001 from 0.0.0.0/0 (or restrict to Vercel/Cloud Run egress IPs)
       - allow-ssh: TCP 22 from your IP only

       1.7 Data Migration Steps

       1. PostgreSQL (SDUI): Export from EC2 sdui-db container via pg_dump, import to Neon/Cloud SQL via psql. Flyway will validate migrations.
       2. ChromaDB: Tar the chroma_db/ directory, upload to GCS, download to e2-micro.
       3. Model files: Upload models/ directory to GCS bucket. On VM startup, gsutil cp gs://kride-models/* /app/models/.
       4. CSV data: Same as models -- upload to GCS, download on startup.
       5. PDF dataset: Upload to GCS. Chatbot can read from mounted GCS FUSE or download at startup.

       1.8 Cost Summary (Phase 1)

       ┌─────────────────────────────────┬─────────────────┐
       │            Resource             │  Monthly Cost   │
       ├─────────────────────────────────┼─────────────────┤
       │ Cloud Run (Spring Boot)         │ $0 (free tier)  │
       ├─────────────────────────────────┼─────────────────┤
       │ e2-small VM (FastAPI + Chatbot) │ $6.11           │
       ├─────────────────────────────────┼─────────────────┤
       │ Neon PostgreSQL                 │ $0 (free tier)  │
       ├─────────────────────────────────┼─────────────────┤
       │ Redis (on VM)                   │ $0 (shared)     │
       ├─────────────────────────────────┼─────────────────┤
       │ Cloud Storage (models + data)   │ $0 (< 5GB free) │
       ├─────────────────────────────────┼─────────────────┤
       │ Vercel (Next.js)                │ $0 (free tier)  │
       ├─────────────────────────────────┼─────────────────┤
       │ Neo4j AuraDB                    │ $0 (existing)   │
       ├─────────────────────────────────┼─────────────────┤
       │ Supabase                        │ $0 (existing)   │
       ├─────────────────────────────────┼─────────────────┤
       │ Total                           │ ~$6/month       │
       └─────────────────────────────────┴─────────────────┘

       ---
       Phase 2: With GCP Credits -- Add GPU for TorchServe ($150-$400/month)

       Goal

       Add GPU-backed TorchServe for current ML models + future media pipeline. Use GCP credits to offset costs.

       2.1 Service Placement Changes

       ┌───────────────────────┬──────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────┐
       │        Service        │               GCP Resource               │                          Change from Phase 1                          │
       ├───────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
       │ Spring Boot           │ Cloud Run                                │ No change                                                             │
       ├───────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
       │ FastAPI (K-Ride)      │ Cloud Run (migrate from VM)              │ Move to Cloud Run now that GPU VM handles models                      │
       ├───────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
       │ NLP Chatbot           │ Cloud Run                                │ Move to Cloud Run, ChromaDB moves to persistent disk on GPU VM or GCS │
       ├───────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
       │ TorchServe            │ Compute Engine g2-standard-4 (1x L4 GPU) │ NEW                                                                   │
       ├───────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
       │ Celery Worker         │ Colocated on GPU VM                      │ NEW                                                                   │
       ├───────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
       │ Redis (Celery broker) │ Memorystore for Redis (1GB)              │ Upgrade from VM-local                                                 │
       └───────────────────────┴──────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────┘

       2.2 GPU Instance Selection

       Recommended: g2-standard-4 with 1x NVIDIA L4 (Spot VM)

       ┌─────────────────┬───────────────────────────┐
       │      Spec       │           Value           │
       ├─────────────────┼───────────────────────────┤
       │ vCPUs           │ 4                         │
       ├─────────────────┼───────────────────────────┤
       │ RAM             │ 16 GB                     │
       ├─────────────────┼───────────────────────────┤
       │ GPU             │ NVIDIA L4 (24GB VRAM)     │
       ├─────────────────┼───────────────────────────┤
       │ On-demand price │ ~$0.70/hour = ~$504/month │
       ├─────────────────┼───────────────────────────┤
       │ Spot price      │ ~$0.21/hour = ~$151/month │
       └─────────────────┴───────────────────────────┘

       Alternative: n1-standard-4 + 1x T4 (Spot VM)

       ┌────────────┬───────────────────────────┐
       │    Spec    │           Value           │
       ├────────────┼───────────────────────────┤
       │ vCPUs      │ 4                         │
       ├────────────┼───────────────────────────┤
       │ RAM        │ 15 GB                     │
       ├────────────┼───────────────────────────┤
       │ GPU        │ NVIDIA T4 (16GB VRAM)     │
       ├────────────┼───────────────────────────┤
       │ Spot price │ ~$0.14/hour = ~$101/month │
       └────────────┴───────────────────────────┘

       Recommendation: Use T4 Spot for Phase 2 (cheaper, sufficient for current models). L4 for Phase 3 when CogVideoX is needed.

       2.3 TorchServe Model Packaging

       Current models to package as .mar files:

       ┌─────────────────────────────────────────────────┬────────┬──────────────────────────────────────────────────┐
       │                      Model                      │  Size  │                TorchServe Handler                │
       ├─────────────────────────────────────────────────┼────────┼──────────────────────────────────────────────────┤
       │ WeatherLSTM (weather_lstm.pt)                   │ ~5MB   │ Custom handler: load LSTM, predict weather class │
       ├─────────────────────────────────────────────────┼────────┼──────────────────────────────────────────────────┤
       │ Safety Regressor (safety_regressor.pkl)         │ ~10MB  │ Custom handler: sklearn predict                  │
       ├─────────────────────────────────────────────────┼────────┼──────────────────────────────────────────────────┤
       │ Safety Classifier (safety_classifier.pkl)       │ ~10MB  │ Custom handler: sklearn predict                  │
       ├─────────────────────────────────────────────────┼────────┼──────────────────────────────────────────────────┤
       │ Ensemble Ranker (LightGBM/XGBoost)              │ ~20MB  │ Custom handler: load pickle, rank POIs           │
       ├─────────────────────────────────────────────────┼────────┼──────────────────────────────────────────────────┤
       │ Cross-encoder reranker (ms-marco-MiniLM-L-6-v2) │ ~80MB  │ Default text handler                             │
       ├─────────────────────────────────────────────────┼────────┼──────────────────────────────────────────────────┤
       │ Sentence-transformers (multilingual-e5-small)   │ ~100MB │ Default text handler                             │
       └─────────────────────────────────────────────────┴────────┴──────────────────────────────────────────────────┘

       TorchServe config (config.properties):
       inference_address=http://0.0.0.0:8085
       management_address=http://0.0.0.0:8086
       grpc_inference_port=7070
       model_store=/home/model-store
       load_models=all
       number_of_gpu=1

       2.4 Celery + Redis Architecture

       [Cloud Run - FastAPI] --(task submit)--> [Memorystore Redis]
                                                     |
                                           [GPU VM - Celery Worker]
                                                     |
                                           [GPU VM - TorchServe :8085]

       New files needed:
       - src/api/celery_app.py -- Celery application config
       - src/api/tasks.py -- Celery task definitions (weather prediction, ensemble ranking, reranking)
       - torchserve/ directory with model handlers and MAR packaging scripts

       2.5 ChromaDB Migration

       Move ChromaDB from local filesystem to a shared solution:

       Option A: Keep on persistent disk attached to GPU VM
       - FastAPI and Chatbot on Cloud Run access ChromaDB via a thin HTTP wrapper (chroma-server mode)
       - Run chroma run --path /data/chroma_db --host 0.0.0.0 --port 8100 on the GPU VM

       Option B: Use Chroma Cloud (managed service)
       - Chroma offers a hosted solution; may have cost implications

       Recommendation: Option A. Run ChromaDB server mode on the GPU VM alongside TorchServe. The GPU VM is always-on anyway.

       2.6 Cost Summary (Phase 2)

       ┌────────────────────────────────────────────────┬──────────────────┐
       │                    Resource                    │   Monthly Cost   │
       ├────────────────────────────────────────────────┼──────────────────┤
       │ Cloud Run (Spring Boot + FastAPI + Chatbot)    │ $0-$5            │
       ├────────────────────────────────────────────────┼──────────────────┤
       │ Spot VM n1+T4 (TorchServe + Celery + ChromaDB) │ ~$101            │
       ├────────────────────────────────────────────────┼──────────────────┤
       │ Memorystore Redis (1GB)                        │ ~$35             │
       ├────────────────────────────────────────────────┼──────────────────┤
       │ Neon / Cloud SQL PostgreSQL                    │ $0-$8            │
       ├────────────────────────────────────────────────┼──────────────────┤
       │ Cloud Storage                                  │ $0               │
       ├────────────────────────────────────────────────┼──────────────────┤
       │ Total                                          │ ~$140-$150/month │
       └────────────────────────────────────────────────┴──────────────────┘

       With GCP credits, this is effectively $0 out-of-pocket.

       ---
       Phase 3: Production -- Full Media Pipeline ($400-$700/month)

       Goal

       Add Photo -> TTS -> Video generation pipeline with Track A (drawings) and Track B (photos).

       3.1 Full Architecture

       [Vercel - Next.js PWA]
               |
               |-- /api/* --> [Cloud Run - Spring Boot]
               |                    |
               |                    |--> Cloud SQL (PostgreSQL)
               |                    |--> Memorystore (Redis)
               |                    |--> Supabase
               |
               |-- /kride-api/* --> [Cloud Run - FastAPI Orchestrator]
                                         |
                                         |--(sync)--> Cloud Run - Chatbot
                                         |
                                         |--(async celery task)--> Memorystore Redis
                                                                       |
                                         [GPU VM - Celery Worker Pool]
                                              |
                                              |--> TorchServe :8085
                                              |      |- WeatherLSTM
                                              |      |- Ensemble Ranker
                                              |      |- Cross-encoder
                                              |      |- Sentence-transformers
                                              |      |- GPT-SoVITS (TTS)
                                              |      |- Animated Drawings
                                              |      |- CogVideoX / 3D Photo Inpainting
                                              |      |- BLIP-2 (image captioning)
                                              |
                                              |--> ChromaDB server :8100
                                              |
                                              |--> GCS (upload final videos)
                                              |
                                              |--> FCM (push notification to PWA)

       3.2 GPU VM Upgrade

       For Phase 3, CogVideoX and GPT-SoVITS require more VRAM:

       Recommended: g2-standard-8 with 1x NVIDIA L4 (Spot)

       ┌────────────┬───────────────────────────┐
       │    Spec    │           Value           │
       ├────────────┼───────────────────────────┤
       │ vCPUs      │ 8                         │
       ├────────────┼───────────────────────────┤
       │ RAM        │ 32 GB                     │
       ├────────────┼───────────────────────────┤
       │ GPU        │ 1x L4 (24GB VRAM)         │
       ├────────────┼───────────────────────────┤
       │ Spot price │ ~$0.42/hour = ~$302/month │
       └────────────┴───────────────────────────┘

       If CogVideoX needs >24GB VRAM, use a2-highgpu-1g with 1x A100 40GB ($1.10/hour Spot = ~$792/month) -- but this is expensive even with
       credits. Consider using g2-standard-8 and running CogVideoX with model quantization (INT8) to fit in 24GB.

       3.3 TorchServe Model Additions (Phase 3)

       ┌──────────────────────┬──────────┬─────────────────────────────────────────────┐
       │        Model         │   VRAM   │                  Container                  │
       ├──────────────────────┼──────────┼─────────────────────────────────────────────┤
       │ GPT-SoVITS (TTS)     │ ~4GB     │ Separate Docker container with Python 3.10+ │
       ├──────────────────────┼──────────┼─────────────────────────────────────────────┤
       │ Animated Drawings    │ ~2GB     │ Separate container (Python 3.8, CUDA 11)    │
       ├──────────────────────┼──────────┼─────────────────────────────────────────────┤
       │ CogVideoX 1.5 (INT8) │ ~12-16GB │ Separate container (Python 3.10, CUDA 12)   │
       ├──────────────────────┼──────────┼─────────────────────────────────────────────┤
       │ 3D Photo Inpainting  │ ~4GB     │ Separate container                          │
       ├──────────────────────┼──────────┼─────────────────────────────────────────────┤
       │ BLIP-2               │ ~4GB     │ Shared with CogVideoX container             │
       ├──────────────────────┼──────────┼─────────────────────────────────────────────┤
       │ MusicGen (BGM)       │ ~4GB     │ Optional, lower priority                    │
       └──────────────────────┴──────────┴─────────────────────────────────────────────┘

       Key insight from architecture_expand_0520.md: Different models require different Python/CUDA versions. TorchServe solves this via .mar
       packaging, but for models that fundamentally conflict (Python 3.8 vs 3.10, CUDA 11 vs 12), use separate Docker containers with their own
       TorchServe instances.

       # docker-compose.gpu.yml
       services:
         torchserve-main:  # WeatherLSTM, ensemble, reranker, embeddings
           image: pytorch/torchserve:latest-gpu
           deploy:
             resources:
               reservations:
                 devices:
                   - capabilities: [gpu]
           ports:
             - "8085:8085"
             - "8086:8086"

         torchserve-tts:  # GPT-SoVITS
           build: ./torchserve/tts
           deploy:
             resources:
               reservations:
                 devices:
                   - capabilities: [gpu]
           ports:
             - "8087:8085"

         torchserve-video:  # CogVideoX, 3D Photo Inpainting, BLIP-2
           build: ./torchserve/video
           deploy:
             resources:
               reservations:
                 devices:
                   - capabilities: [gpu]
           ports:
             - "8088:8085"

         celery-worker:
           build: ./src/api
           command: celery -A celery_app worker -l info -c 2
           depends_on:
             - redis
             - torchserve-main
           env_file: .env.gcp

         chromadb:
           image: chromadb/chroma:latest
           ports:
             - "8100:8000"
           volumes:
             - chroma-data:/chroma/chroma

         redis:
           image: redis:7-alpine
           ports:
             - "6379:6379"

       3.4 Celery Task Flow (Media Pipeline)

       # src/api/tasks.py (new file)
       from celery import chain, group
       from celery_app import celery

       @celery.task(bind=True, max_retries=3)
       def classify_input(self, image_url: str, text: str):
           """Determine Track A (drawing) or Track B (photo)"""
           # Call BLIP-2 on TorchServe
           # Return: {"track": "A" | "B", "caption": "...", "prompt": "..."}

       @celery.task(bind=True)
       def generate_tts(self, text: str, voice_id: str):
           """GPT-SoVITS TTS generation"""
           # Call torchserve-tts:8087

       @celery.task(bind=True)
       def generate_video_track_a(self, image_url: str, motion: str):
           """Animated Drawings pipeline"""

       @celery.task(bind=True)
       def generate_video_track_b(self, image_url: str, prompt: str):
           """CogVideoX or 3D Photo Inpainting"""

       @celery.task(bind=True)
       def mix_final(self, video_path: str, audio_path: str, bgm_path: str):
           """FFmpeg mixing -> upload to GCS -> FCM notification"""

       3.5 Cost Summary (Phase 3)

       ┌──────────────────────────────┬──────────────────┐
       │           Resource           │   Monthly Cost   │
       ├──────────────────────────────┼──────────────────┤
       │ Cloud Run (3 services)       │ $5-$20           │
       ├──────────────────────────────┼──────────────────┤
       │ Spot VM g2-standard-8 + L4   │ ~$302            │
       ├──────────────────────────────┼──────────────────┤
       │ Memorystore Redis (2GB)      │ ~$55             │
       ├──────────────────────────────┼──────────────────┤
       │ Cloud SQL (db-g1-small)      │ ~$26             │
       ├──────────────────────────────┼──────────────────┤
       │ Cloud Storage (videos, 50GB) │ ~$1              │
       ├──────────────────────────────┼──────────────────┤
       │ Total                        │ ~$400-$410/month │
       └──────────────────────────────┴──────────────────┘

       ---
       CI/CD Pipeline Migration

       Current Pipeline (from D:\kride-project\subproject\SDUI\.github\workflows\deploy.yml)

       GitHub push -> Build JAR -> Docker build -> Docker Hub push -> SSH to EC2 -> docker run

       New Pipeline (GCP)

       Spring Boot -> Cloud Run:
       # .github/workflows/deploy-gcp.yml
       name: Deploy to GCP Cloud Run
       on:
         push:
           branches: [main]
       jobs:
         deploy-spring-boot:
           runs-on: ubuntu-latest
           steps:
             - uses: actions/checkout@v4
             - uses: google-github-actions/auth@v2
               with:
                 credentials_json: ${{ secrets.GCP_SA_KEY }}
             - uses: google-github-actions/setup-gcloud@v2
             - name: Build and push to Artifact Registry
               run: |
                 gcloud builds submit ./subproject/SDUI/SDUI-server \
                   --tag asia-northeast3-docker.pkg.dev/$PROJECT_ID/kride/sdui-backend:${{ github.sha }}
             - name: Deploy to Cloud Run
               run: |
                 gcloud run deploy sdui-backend \
                   --image asia-northeast3-docker.pkg.dev/$PROJECT_ID/kride/sdui-backend:${{ github.sha }} \
                   --region asia-northeast3 \
                   --memory 512Mi \
                   --cpu 1 \
                   --min-instances 0 \
                   --max-instances 2 \
                   --set-env-vars "SPRING_PROFILES_ACTIVE=prod,SPRING_DATASOURCE_URL=${{ secrets.GCP_DB_URL }}"

       FastAPI -> Compute Engine (Phase 1) / Cloud Run (Phase 2+):
         deploy-fastapi:
           runs-on: ubuntu-latest
           steps:
             # Phase 1: SSH to e2-micro, pull and restart
             # Phase 2+: Deploy to Cloud Run similar to Spring Boot

       ---
       Code Changes Required

       Phase 1 Changes

       1. Create Dockerfile.chatbot for NLP Chatbot (new file at subproject/NLP/Dockerfile.chatbot)
       FROM python:3.9-slim
       WORKDIR /app
       COPY chatbot/requirements.txt .
       RUN pip install --no-cache-dir -r requirements.txt
       COPY chatbot/ ./chatbot/
       CMD ["uvicorn", "chatbot.chatbot_server:app", "--host", "0.0.0.0", "--port", "8001"]

       2. Update next.config.ts (line 12, 29)
       - Change BACKEND_URL to Cloud Run URL
       - Change /kride-api/* destination from localhost:8000 to the VM's external IP or Cloud Run URL
       const BACKEND_URL = isProd
           ? 'https://sdui-backend-xxxxx-an.a.run.app'  // Cloud Run URL
           : 'http://localhost:8080';
       // ...
       { source: '/kride-api/:path*', destination: isProd ? 'http://VM_IP:8000/api/:path*' : 'http://localhost:8000/api/:path*' }

       3. Update CSP connect-src in next.config.ts (line 61)
       - Add Cloud Run and VM URLs to allowed connections

       4. Create docker-compose.gcp.yml (new file at project root)
       - For running FastAPI + Chatbot + Redis on the VM

       5. Update .env to create .env.gcp variant
       - DATABASE_URL -> Neon connection string
       - Add CHROMA_PATH=/app/chroma_db
       - Keep all external API keys (Neo4j, Groq, Supabase, Kakao)

       6. Spring Boot application.yml -- create application-prod.yml profile
       - spring.datasource.url -> Neon/Cloud SQL URL with SSL
       - spring.data.redis.host -> VM internal IP or Memorystore IP
       - kride.fastapi.url -> http://VM_IP:8000
       - kride.fastapi.chatbot-url -> http://VM_IP:8001

       Phase 2 Changes

       7. Create Celery infrastructure:
       - src/api/celery_app.py -- Celery app definition with Redis broker
       - src/api/tasks.py -- Task definitions for model inference
       - Modify src/api/fastapi_server.py to submit tasks to Celery instead of running inference inline

       8. Create TorchServe handlers:
       - torchserve/weather_lstm_handler.py
       - torchserve/ensemble_handler.py
       - torchserve/reranker_handler.py
       - MAR packaging script: torchserve/package.sh

       9. ChromaDB client mode: Update subproject/NLP/chatbot/config.py line 10:
       # From:
       CHROMA_PATH = str(PROJECT_ROOT / "chroma_db")
       # To:
       CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
       CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8100"))

       Phase 3 Changes

       10. Media pipeline tasks: New Celery tasks for Track A/B
       11. FCM integration: Push notifications when video is ready
       12. GCS upload utility: Upload generated videos to Cloud Storage
       13. WebSocket/SSE progress endpoint: Real-time progress updates to PWA

       ---
       Risk Matrix

       ┌──────────────────────────────────────┬──────────────────────────┬──────────────────────────────────────────────────────────────────────────
       ┐
       │                 Risk                 │          Impact          │                                Mitigation
       │
       ├──────────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────────────────
       ┤
       │ e2-micro OOM (1GB RAM)               │ FastAPI/Chatbot crash    │ Use e2-small ($6/month) or split into 2 Cloud Run services
       │
       ├──────────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────────────────
       ┤
       │ Spot VM preemption                   │ GPU tasks interrupted    │ Celery auto-retry with acks_late=True; tasks resume on new Spot instance
       │
       ├──────────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────────────────
       ┤
       │ Neon free tier cold start            │ 5s delay after 5min idle │ Acceptable for dev; upgrade to Cloud SQL for production
       │
       ├──────────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────────────────
       ┤
       │ ChromaDB data loss on VM             │ Embeddings lost          │ Mount GCS FUSE or use persistent disk with snapshots
       │
       ├──────────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────────────────
       ┤
       │ Cloud Run cold start for Spring Boot │ 10-20s first request     │ Set min-instances: 1 (costs ~$15/month)
       │
       ├──────────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────────────────
       ┤
       │ Python env conflicts (Phase 3)       │ Model loading failures   │ Separate Docker containers per model group
       │
       ├──────────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────────────────────────────────────
       ┤
       │ GCP credit expiry                    │ Service downtime         │ Monitor credit usage; set billing alerts at 50%, 75%, 90%
       │
       └──────────────────────────────────────┴──────────────────────────┴──────────────────────────────────────────────────────────────────────────
       ┘









       ---
       Critical Files for Implementation

       - D:\kride-project\subproject\SDUI\.github\workflows\deploy.yml -- Current CI/CD pipeline to fork and adapt for GCP Cloud Run deployment
       - D:\kride-project\subproject\SDUI\SDUI-server\Dockerfile -- Existing multi-stage Docker build for Spring Boot, reusable for Cloud Run with
       no changes
       - D:\kride-project\subproject\SDUI\metadata-project\next.config.ts -- Must update BACKEND_URL and /kride-api/* proxy destinations to point to
        GCP endpoints instead of EC2
       - D:\kride-project\src\api\fastapi_server.py -- Core FastAPI server that loads models at startup; needs refactoring to call TorchServe HTTP
       endpoints instead of inline pickle/torch loading (Phase 2)
       - D:\kride-project\subproject\NLP\chatbot\config.py -- ChromaDB path configuration must change from local filesystem to ChromaDB server mode
       (HTTP client) for Phase 2+ when services are split across Cloud Run and GPU VM
                                                                               │
│ K-Ride TorchServe + Celery 아키텍처 구축 계획                                                                                                        │
│                                                                                                                                                      │
│ Context                                                                                                                                              │
│                                                                                                                                                      │
│ 현재 K-Ride FastAPI 서버는 모든 ML 모델을 프로세스 내에서 직접 로딩한다 (pickle, torch, sentence-transformers). architecture_expand_0520.md에 따라   │
│ 향후 사진→TTS→영상 파이프라인을 추가하려면, 모델별 Python/CUDA 환경 격리가 필수이고 이를 위해 TorchServe를 도입해야 한다. 기존 EC2 인프라를          │
│ 유지하면서 Phase 2(TorchServe + Celery) 구현에 집중한다.                                                                                             │
│                                                                                                                                                      │
│ ---                                                                                                                                                  │
│ 현재 모델 사용 현황 (인라인 로딩)                                                                                                                    │
│                                                                                                                                                      │
│ FastAPI (src/api/fastapi_server.py)                                                                                                                  │
│                                                                                                                                                      │
│ ┌──────────────────────────────────┬──────────────────────────────┬───────────────────────────────────┐                                              │
│ │               모델               │          로딩 방식           │               파일                │                                              │
│ ├──────────────────────────────────┼──────────────────────────────┼───────────────────────────────────┤                                              │
│ │ NetworkX Graph                   │ pickle.load(route_graph.pkl) │ src/api/fastapi_server.py:116-118 │                                              │
│ ├──────────────────────────────────┼──────────────────────────────┼───────────────────────────────────┤                                              │
│ │ CSV 데이터 (road, facility, poi) │ pd.read_csv()                │ src/api/fastapi_server.py:132-144 │                                              │
│ └──────────────────────────────────┴──────────────────────────────┴───────────────────────────────────┘                                              │
│                                                                                                                                                      │
│ Ensemble Client (src/api/ensemble_client.py)                                                                                                         │
│                                                                                                                                                      │
│ ┌───────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐                                                  │
│ │           모델            │            로딩 방식             │               파일               │                                                  │
│ ├───────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤                                                  │
│ │ LightGBM/XGBoost Ensemble │ pickle.load(ensemble_ranker.pkl) │ src/api/ensemble_client.py:24-33 │                                                  │
│ ├───────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤                                                  │
│ │ Feature Engineering       │ compute_features() (numpy)       │ src/ml/feature_engineering.py    │                                                  │
│ └───────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘                                                  │
│                                                                                                                                                      │
│ RAG Client (src/api/rag_client.py)                                                                                                                   │
│                                                                                                                                                      │
│ ┌─────────────────────────────────────────────┬─────────────────────────┬────────┐                                                                   │
│ │                    모델                     │        로딩 방식        │  크기  │                                                                   │
│ ├─────────────────────────────────────────────┼─────────────────────────┼────────┤                                                                   │
│ │ SentenceTransformer (multilingual-e5-small) │ 싱글턴 로딩             │ ~100MB │                                                                   │
│ ├─────────────────────────────────────────────┼─────────────────────────┼────────┤                                                                   │
│ │ ChromaDB                                    │ PersistentClient (로컬) │ ~500MB │                                                                   │
│ ├─────────────────────────────────────────────┼─────────────────────────┼────────┤                                                                   │
│ │ Groq LLM                                    │ 외부 API 호출           │ N/A    │                                                                   │
│ └─────────────────────────────────────────────┴─────────────────────────┴────────┘                                                                   │
│                                                                                                                                                      │
│ Chatbot (subproject/NLP/chatbot/chatbot_chain.py)                                                                                                    │
│                                                                                                                                                      │
│ ┌─────────────────────────────────────────────┬─────────────────────────┬────────┐                                                                   │
│ │                    모델                     │        로딩 방식        │  크기  │                                                                   │
│ ├─────────────────────────────────────────────┼─────────────────────────┼────────┤                                                                   │
│ │ SentenceTransformer (multilingual-e5-small) │ 싱글턴 (중복!)          │ ~100MB │                                                                   │
│ ├─────────────────────────────────────────────┼─────────────────────────┼────────┤                                                                   │
│ │ Cross-encoder Reranker (ms-marco-MiniLM)    │ 싱글턴                  │ ~80MB  │                                                                   │
│ ├─────────────────────────────────────────────┼─────────────────────────┼────────┤                                                                   │
│ │ ChromaDB                                    │ PersistentClient (로컬) │ 공유   │                                                                   │
│ ├─────────────────────────────────────────────┼─────────────────────────┼────────┤                                                                   │
│ │ Groq LLM                                    │ 외부 API 호출           │ N/A    │                                                                   │
│ └─────────────────────────────────────────────┴─────────────────────────┴────────┘                                                                   │
│                                                                                                                                                      │
│ DL 모듈 (FastAPI에서 import)                                                                                                                         │
│                                                                                                                                                      │
│ ┌────────────────────────────────┬─────────────────────────────┬──────────────────────────────┐                                                      │
│ │              모델              │          로딩 방식          │             파일             │                                                      │
│ ├────────────────────────────────┼─────────────────────────────┼──────────────────────────────┤                                                      │
│ │ WeatherLSTM                    │ torch.load(weather_lstm.pt) │ src/dl/build_weather_lstm.py │                                                      │
│ ├────────────────────────────────┼─────────────────────────────┼──────────────────────────────┤                                                      │
│ │ Event NER (mDeBERTa zero-shot) │ transformers pipeline       │ src/dl/build_event_ner.py    │                                                      │
│ └────────────────────────────────┴─────────────────────────────┴──────────────────────────────┘                                                      │
│                                                                                                                                                      │
│ ---                                                                                                                                                  │
│ TorchServe 분리 전략                                                                                                                                 │
│                                                                                                                                                      │
│ 원칙: 모든 모델을 TorchServe로 옮길 필요 없음                                                                                                        │
│                                                                                                                                                      │
│ - TorchServe로 분리: GPU가 필요하거나 Python 환경 격리가 필요한 모델                                                                                 │
│ - 인라인 유지: CPU 경량 작업 (pickle, CSV, NetworkX, Groq API 호출)                                                                                  │
│                                                                                                                                                      │
│ TorchServe로 이전할 모델 (4개)                                                                                                                       │
│                                                                                                                                                      │
│ ┌────────────────────────────────┬──────────────────┬─────────────────────────────┬─────────────────────────────────────┐                            │
│ │              모델              │     MAR 이름     │           Handler           │                이유                 │                            │
│ ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤                            │
│ │ SentenceTransformer (e5-small) │ embedder.mar     │ text → 384-dim vector       │ FastAPI/Chatbot 중복 제거, GPU 활용 │                            │
│ ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤                            │
│ │ Cross-encoder Reranker         │ reranker.mar     │ (query, doc) pairs → scores │ GPU 가속 효과 큼                    │                            │
│ ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤                            │
│ │ WeatherLSTM                    │ weather_lstm.mar │ 14-day seq → 3-class        │ PyTorch 모델                        │                            │
│ ├────────────────────────────────┼──────────────────┼─────────────────────────────┼─────────────────────────────────────┤                            │
│ │ Event NER (mDeBERTa)           │ event_ner.mar    │ text → classification       │ transformers 모델, VRAM 필요        │                            │
│ └────────────────────────────────┴──────────────────┴─────────────────────────────┴─────────────────────────────────────┘                            │
│                                                                                                                                                      │
│ 인라인 유지 (TorchServe 불필요)                                                                                                                      │
│                                                                                                                                                      │
│ ┌────────────────────────────┬────────────────────────────────────────────┐                                                                          │
│ │            모델            │                    이유                    │                                                                          │
│ ├────────────────────────────┼────────────────────────────────────────────┤                                                                          │
│ │ Ensemble Ranker (LightGBM) │ scikit-learn/LightGBM, CPU 전용, <1ms 추론 │                                                                          │
│ ├────────────────────────────┼────────────────────────────────────────────┤                                                                          │
│ │ NetworkX Graph             │ 데이터 구조, 모델 아님                     │                                                                          │
│ ├────────────────────────────┼────────────────────────────────────────────┤                                                                          │
│ │ CSV DataFrames             │ 데이터 로딩                                │                                                                          │
│ ├────────────────────────────┼────────────────────────────────────────────┤                                                                          │
│ │ Groq LLM                   │ 외부 API                                   │                                                                          │
│ ├────────────────────────────┼────────────────────────────────────────────┤                                                                          │
│ │ ChromaDB                   │ 별도 서버 모드로 분리 (아래 참조)          │                                                                          │
│ └────────────────────────────┴────────────────────────────────────────────┘                                                                          │
│                                                                                                                                                      │
│ ---                                                                                                                                                  │
│ 구현 계획                                                                                                                                            │
│                                                                                                                                                      │
│ Step 1: TorchServe 모델 핸들러 작성                                                                                                                  │
│                                                                                                                                                      │
│ 신규 디렉토리: torchserve/                                                                                                                           │
│                                                                                                                                                      │
│ torchserve/                                                                                                                                          │
│ ├── handlers/                                                                                                                                        │
│ │   ├── embedder_handler.py      # SentenceTransformer → encode                                                                                      │
│ │   ├── reranker_handler.py      # CrossEncoder → predict                                                                                            │
│ │   ├── weather_lstm_handler.py  # WeatherLSTM → predict_weather                                                                                     │
│ │   └── event_ner_handler.py     # zero-shot classification                                                                                          │
│ ├── config.properties            # TorchServe 설정                                                                                                   │
│ ├── package_models.sh            # .mar 패키징 스크립트                                                                                              │
│ ├── Dockerfile                   # TorchServe Docker 이미지                                                                                          │
│ └── requirements.txt                                                                                                                                 │
│                                                                                                                                                      │
│ embedder_handler.py 핵심 로직:                                                                                                                       │
│ class EmbedderHandler(BaseHandler):                                                                                                                  │
│     def initialize(self, context):                                                                                                                   │
│         self.model = SentenceTransformer("intfloat/multilingual-e5-small")                                                                           │
│                                                                                                                                                      │
│     def preprocess(self, data):                                                                                                                      │
│         return [item["body"]["text"] for item in data]                                                                                               │
│                                                                                                                                                      │
│     def inference(self, texts):                                                                                                                      │
│         return self.model.encode(texts, normalize_embeddings=True).tolist()                                                                          │
│                                                                                                                                                      │
│ reranker_handler.py 핵심 로직:                                                                                                                       │
│ class RerankerHandler(BaseHandler):                                                                                                                  │
│     def initialize(self, context):                                                                                                                   │
│         self.model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")                                                                            │
│                                                                                                                                                      │
│     def inference(self, pairs):                                                                                                                      │
│         return self.model.predict(pairs).tolist()                                                                                                    │
│                                                                                                                                                      │
│ Step 2: TorchServe Docker 구성                                                                                                                       │
│                                                                                                                                                      │
│ 파일: torchserve/Dockerfile                                                                                                                          │
│ FROM pytorch/torchserve:latest-gpu                                                                                                                   │
│ COPY handlers/ /home/model-store/handlers/                                                                                                           │
│ COPY config.properties /home/model-store/                                                                                                            │
│ COPY *.mar /home/model-store/                                                                                                                        │
│ EXPOSE 8085 8086 7070                                                                                                                                │
│                                                                                                                                                      │
│ 파일: torchserve/config.properties                                                                                                                   │
│ inference_address=http://0.0.0.0:8085                                                                                                                │
│ management_address=http://0.0.0.0:8086                                                                                                               │
│ model_store=/home/model-store                                                                                                                        │
│ load_models=all                                                                                                                                      │
│ number_of_gpu=1                                                                                                                                      │
│ default_workers_per_model=1                                                                                                                          │
│ job_queue_size=100                                                                                                                                   │
│ batch_size=4                                                                                                                                         │
│ max_batch_delay=100                                                                                                                                  │
│                                                                                                                                                      │
│ Step 3: FastAPI 코드 리팩토링 — TorchServe HTTP 클라이언트                                                                                           │
│                                                                                                                                                      │
│ 신규: src/api/torchserve_client.py                                                                                                                   │
│ """TorchServe HTTP 추론 클라이언트"""                                                                                                                │
│ import httpx                                                                                                                                         │
│ import os                                                                                                                                            │
│                                                                                                                                                      │
│ TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8085")                                                                           │
│                                                                                                                                                      │
│ async def embed_texts(texts: list[str]) -> list[list[float]]:                                                                                        │
│     """SentenceTransformer 임베딩 (TorchServe 경유)"""                                                                                               │
│     async with httpx.AsyncClient(timeout=10.0) as client:                                                                                            │
│         resp = await client.post(                                                                                                                    │
│             f"{TORCHSERVE_URL}/predictions/embedder",                                                                                                │
│             json={"text": texts}                                                                                                                     │
│         )                                                                                                                                            │
│         return resp.json()                                                                                                                           │
│                                                                                                                                                      │
│ async def rerank(query: str, documents: list[str]) -> list[float]:                                                                                   │
│     """Cross-encoder 리랭킹 (TorchServe 경유)"""                                                                                                     │
│     async with httpx.AsyncClient(timeout=10.0) as client:                                                                                            │
│         resp = await client.post(                                                                                                                    │
│             f"{TORCHSERVE_URL}/predictions/reranker",                                                                                                │
│             json={"query": query, "documents": documents}                                                                                            │
│         )                                                                                                                                            │
│         return resp.json()                                                                                                                           │
│                                                                                                                                                      │
│ async def predict_weather(sequence: list) -> dict:                                                                                                   │
│     """WeatherLSTM 예측 (TorchServe 경유)"""                                                                                                         │
│     async with httpx.AsyncClient(timeout=5.0) as client:                                                                                             │
│         resp = await client.post(                                                                                                                    │
│             f"{TORCHSERVE_URL}/predictions/weather_lstm",                                                                                            │
│             json={"sequence": sequence}                                                                                                              │
│         )                                                                                                                                            │
│         return resp.json()                                                                                                                           │
│                                                                                                                                                      │
│ 수정: src/api/rag_client.py                                                                                                                          │
│ - get_embedder() → torchserve_client.embed_texts() 로 교체                                                                                           │
│ - SentenceTransformer 직접 import 제거                                                                                                               │
│                                                                                                                                                      │
│ 수정: subproject/NLP/chatbot/chatbot_chain.py                                                                                                        │
│ - _get_embedder() → torchserve_client.embed_texts() 교체                                                                                             │
│ - _get_reranker() → torchserve_client.rerank() 교체                                                                                                  │
│                                                                                                                                                      │
│ Step 4: Celery + Redis 비동기 작업 큐                                                                                                                │
│                                                                                                                                                      │
│ 신규: src/api/celery_app.py                                                                                                                          │
│ from celery import Celery                                                                                                                            │
│ import os                                                                                                                                            │
│                                                                                                                                                      │
│ REDIS_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")                                                                          │
│                                                                                                                                                      │
│ celery = Celery("kride", broker=REDIS_URL, backend=REDIS_URL)                                                                                        │
│ celery.conf.update(                                                                                                                                  │
│     task_serializer="json",                                                                                                                          │
│     result_serializer="json",                                                                                                                        │
│     accept_content=["json"],                                                                                                                         │
│     task_acks_late=True,        # Spot VM 대비: 작업 완료 후 ACK                                                                                     │
│     worker_prefetch_multiplier=1,                                                                                                                    │
│ )                                                                                                                                                    │
│                                                                                                                                                      │
│ 신규: src/api/tasks.py                                                                                                                               │
│ """비동기 Celery 태스크 (Phase 2: 기존 모델 + Phase 3: 미디어 파이프라인)"""                                                                         │
│ from celery_app import celery                                                                                                                        │
│ import httpx                                                                                                                                         │
│                                                                                                                                                      │
│ TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8085")                                                                           │
│                                                                                                                                                      │
│ @celery.task(bind=True, max_retries=3)                                                                                                               │
│ def task_embed_texts(self, texts: list[str]) -> list:                                                                                                │
│     """배치 임베딩 (비동기)"""                                                                                                                       │
│     resp = httpx.post(f"{TORCHSERVE_URL}/predictions/embedder", json={"text": texts})                                                                │
│     return resp.json()                                                                                                                               │
│                                                                                                                                                      │
│ @celery.task(bind=True, max_retries=3)                                                                                                               │
│ def task_predict_weather(self, sequence: list) -> dict:                                                                                              │
│     """날씨 예측 (비동기)"""                                                                                                                         │
│     resp = httpx.post(f"{TORCHSERVE_URL}/predictions/weather_lstm", json={"sequence": sequence})                                                     │
│     return resp.json()                                                                                                                               │
│                                                                                                                                                      │
│ # Phase 3 태스크 (미래)                                                                                                                              │
│ @celery.task(bind=True, max_retries=3)                                                                                                               │
│ def task_generate_tts(self, text: str, voice_id: str) -> str:                                                                                        │
│     """GPT-SoVITS TTS → GCS URL 반환"""                                                                                                              │
│     pass                                                                                                                                             │
│                                                                                                                                                      │
│ @celery.task(bind=True, max_retries=3)                                                                                                               │
│ def task_generate_video(self, image_url: str, track: str) -> str:                                                                                    │
│     """CogVideoX/AnimatedDrawings → GCS URL 반환"""                                                                                                  │
│     pass                                                                                                                                             │
│                                                                                                                                                      │
│ Step 5: ChromaDB 서버 모드 분리                                                                                                                      │
│                                                                                                                                                      │
│ 현재 FastAPI와 Chatbot이 동일한 chroma_db/ 디렉토리를 PersistentClient로 직접 접근. TorchServe VM에서 ChromaDB 서버 모드로 운영.                     │
│                                                                                                                                                      │
│ 수정: src/api/rag_client.py:26-30                                                                                                                    │
│ # Before:                                                                                                                                            │
│ _chroma = chromadb.PersistentClient(path=CHROMA_PATH)                                                                                                │
│ # After:                                                                                                                                             │
│ CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")                                                                                             │
│ CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8100"))                                                                                             │
│ _chroma = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)                                                                                    │
│                                                                                                                                                      │
│ 수정: subproject/NLP/chatbot/chatbot_chain.py:54-55 — 동일 변경                                                                                      │
│                                                                                                                                                      │
│ Step 6: Docker Compose (GPU VM용)                                                                                                                    │
│                                                                                                                                                      │
│ 신규: docker-compose.gpu.yml                                                                                                                         │
│ version: '3.8'                                                                                                                                       │
│ services:                                                                                                                                            │
│   torchserve:                                                                                                                                        │
│     build: ./torchserve                                                                                                                              │
│     ports:                                                                                                                                           │
│       - "8085:8085"                                                                                                                                  │
│       - "8086:8086"                                                                                                                                  │
│     deploy:                                                                                                                                          │
│       resources:                                                                                                                                     │
│         reservations:                                                                                                                                │
│           devices:                                                                                                                                   │
│             - capabilities: [gpu]                                                                                                                    │
│     volumes:                                                                                                                                         │
│       - ./models:/home/model-store/models                                                                                                            │
│                                                                                                                                                      │
│   chromadb:                                                                                                                                          │
│     image: chromadb/chroma:latest                                                                                                                    │
│     ports:                                                                                                                                           │
│       - "8100:8000"                                                                                                                                  │
│     volumes:                                                                                                                                         │
│       - ./chroma_db:/chroma/chroma                                                                                                                   │
│                                                                                                                                                      │
│   redis:                                                                                                                                             │
│     image: redis:7-alpine                                                                                                                            │
│     ports:                                                                                                                                           │
│       - "6379:6379"                                                                                                                                  │
│                                                                                                                                                      │
│   celery-worker:                                                                                                                                     │
│     build:                                                                                                                                           │
│       context: .                                                                                                                                     │
│       dockerfile: Dockerfile.worker                                                                                                                  │
│     command: celery -A src.api.celery_app worker -l info -c 2                                                                                        │
│     depends_on:                                                                                                                                      │
│       - redis                                                                                                                                        │
│       - torchserve                                                                                                                                   │
│     environment:                                                                                                                                     │
│       - TORCHSERVE_URL=http://torchserve:8085                                                                                                        │
│       - CELERY_BROKER_URL=redis://redis:6379/1                                                                                                       │
│                                                                                                                                                      │
│ ---                                                                                                                                                  │
│ 수정 대상 파일 요약                                                                                                                                  │
│                                                                                                                                                      │
│ ┌─────────────────────────────────────────┬──────────────────────────────────────────────────────────────┐                                           │
│ │                  파일                   │                          변경 내용                           │                                           │
│ ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤                                           │
│ │ src/api/rag_client.py                   │ SentenceTransformer → TorchServe HTTP, ChromaDB → HttpClient │                                           │
│ ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤                                           │
│ │ subproject/NLP/chatbot/chatbot_chain.py │ embedder/reranker → TorchServe HTTP, ChromaDB → HttpClient   │                                           │
│ ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤                                           │
│ │ subproject/NLP/chatbot/config.py        │ CHROMA_HOST/PORT 환경변수 추가                               │                                           │
│ ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤                                           │
│ │ src/api/fastapi_server.py               │ WeatherLSTM/EventNER import → TorchServe 호출로 교체         │                                           │
│ ├─────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤                                           │
│ │ .env                                    │ TORCHSERVE_URL, CHROMA_HOST, CELERY_BROKER_URL 추가          │                                           │
│ └─────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘                                           │
│                                                                                                                                                      │
│ 신규 파일                                                                                                                                            │
│                                                                                                                                                      │
│ ┌─────────────────────────────────────────────┬──────────────────────────────────┐                                                                   │
│ │                    파일                     │               내용               │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ torchserve/handlers/embedder_handler.py     │ SentenceTransformer MAR handler  │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ torchserve/handlers/reranker_handler.py     │ CrossEncoder MAR handler         │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ torchserve/handlers/weather_lstm_handler.py │ WeatherLSTM MAR handler          │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ torchserve/handlers/event_ner_handler.py    │ zero-shot classification handler │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ torchserve/config.properties                │ TorchServe 설정                  │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ torchserve/package_models.sh                │ .mar 패키징 스크립트             │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ torchserve/Dockerfile                       │ TorchServe GPU Docker 이미지     │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ src/api/torchserve_client.py                │ TorchServe HTTP 클라이언트       │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ src/api/celery_app.py                       │ Celery 설정                      │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ src/api/tasks.py                            │ Celery 태스크 정의               │                                                                   │
│ ├─────────────────────────────────────────────┼──────────────────────────────────┤                                                                   │
│ │ docker-compose.gpu.yml                      │ GPU VM용 Docker Compose          │                                                                   │
│ └─────────────────────────────────────────────┴──────────────────────────────────┘                                                                   │
│                                                                                                                                                      │
│ ---                                                                                                                                                  │
│ 구현 순서                                                                                                                                            │
│                                                                                                                                                      │
│ 1. torchserve/ 디렉토리 + 4개 handler 작성                                                                                                           │
│ 2. package_models.sh — .mar 파일 생성 스크립트                                                                                                       │
│ 3. torchserve/Dockerfile + config.properties                                                                                                         │
│ 4. src/api/torchserve_client.py — HTTP 클라이언트                                                                                                    │
│ 5. src/api/rag_client.py 수정 — embedder → TorchServe                                                                                                │
│ 6. subproject/NLP/chatbot/chatbot_chain.py 수정 — embedder/reranker → TorchServe                                                                     │
│ 7. ChromaDB → HttpClient 모드 전환 (rag_client.py, chatbot_chain.py, config.py)                                                                      │
│ 8. src/api/celery_app.py + tasks.py 작성                                                                                                             │
│ 9. docker-compose.gpu.yml 작성                                                                                                                       │
│ 10. .env 환경변수 추가                                                                                                                               │
│                                                                                                                                                      │
│ 검증 방법                                                                                                                                            │
│                                                                                                                                                      │
│ 1. 로컬 TorchServe 테스트 (GPU 없이도 CPU 모드 가능):                                                                                                │
│ docker-compose -f docker-compose.gpu.yml up torchserve chromadb redis                                                                                │
│ curl -X POST http://localhost:8085/predictions/embedder -d '{"text": ["서울 여행"]}'                                                                 │
│ curl -X POST http://localhost:8085/predictions/reranker -d '{"query":"서울","documents":["서울 맛집","부산 해변"]}'                                  │
│ 2. FastAPI 연동 테스트:                                                                                                                              │
│ TORCHSERVE_URL=http://localhost:8085 uvicorn src.api.fastapi_server:app --port 8000                                                                  │
│ curl http://localhost:8000/api/health                                                                                                                │
│ curl -X POST http://localhost:8000/api/recommend/ai -d '...'                                                                                         │
│ 3. Chatbot 연동 테스트:                                                                                                                              │
│ TORCHSERVE_URL=http://localhost:8085 CHROMA_HOST=localhost CHROMA_PORT=8100 \                                                                        │
│   uvicorn subproject.NLP.chatbot.chatbot_server:app --port 8001                                                                                      │
│ curl -X POST http://localhost:8001/chat -d '{"message":"서울 맛집 추천"}'                                                                            │
│ 4. Celery Worker 테스트:                                                                                                                             │
│ celery -A src.api.celery_app worker -l info                                                                                                          │
│ # 별도 터미널에서 태스크 전송 확인     



  7개 엔드포인트:

  ┌──────────────────────────────┬────────────────────────────────────────┬────────┐
  │             API              │                  기능                  │  VRAM  │
  ├──────────────────────────────┼────────────────────────────────────────┼────────┤
  │ POST /api/media/tts          │ XTTS-v2 한국어 TTS                     │ ~2-3GB │
  ├──────────────────────────────┼────────────────────────────────────────┼────────┤
  │ POST /api/media/musicgen     │ MusicGen BGM 생성                      │ ~2-6GB │
  ├──────────────────────────────┼────────────────────────────────────────┼────────┤
  │ POST /api/media/inpaint3d    │ Depth Anything + Ken Burns 카메라 무빙 │ ~2-4GB │
  ├──────────────────────────────┼────────────────────────────────────────┼────────┤
  │ POST /api/media/animate      │ LivePortrait 인물 모션 (3~10분)        │ ~6GB   │
  ├──────────────────────────────┼────────────────────────────────────────┼────────┤
  │ POST /api/media/render       │ FFmpeg 합성 (영상+TTS+BGM)             │ CPU    │
  ├──────────────────────────────┼────────────────────────────────────────┼────────┤
  │ GET /api/media/status/{id}   │ 폴링                                   │ —      │
  ├──────────────────────────────┼────────────────────────────────────────┼────────┤
  │ GET /api/media/download/{id} │ 파일 다운로드                          │ —      │
  └──────────────────────────────┴────────────────────────────────────────┴────────┘

  핵심 설계:
  - 비동기 폴링: 오래 걸리는 작업은 job_id 반환 → 상태 폴링 → 완료 후 다운로드
  - GPU 메모리 관리: POST /api/media/unload/{tts|musicgen} 으로 수동 해제 가능
  - ThreadPoolExecutor(max_workers=1): T4 16GB OOM 방지
  - 모델 lazy loading: 사용 시점에만 로딩

  kaggle/kride_media_kaggle.ipynb — Kaggle 노트북

  11단계: GPU 확인 → 의존성 → LivePortrait 설치 → 서버 시작 → zrok → 테스트 (TTS → BGM → 3D Photo →
  Render)

  전체 Kaggle 배포 구조

  [노트북 A] CPU/가벼운 GPU           [노트북 B] GPU T4
    kaggle_server.py (:8000)           media_server.py (:8001)
    zrok URL-A                         zrok URL-B
    ├─ 추천/챗봇/아티스트               ├─ TTS (XTTS-v2)
    └─ 즉시 응답                        ├─ MusicGen (BGM)
                                        ├─ 3D Photo (Ken Burns)
                                        ├─ LivePortrait (인물)
                                        └─ FFmpeg (합성)
