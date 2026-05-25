FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY src/api/requirements-docker.txt /tmp/requirements.txt
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /tmp/requirements.txt

COPY src/ /app/src/
COPY dataset/models/route_graph.pkl /app/dataset/models/route_graph.pkl
COPY dataset/data/raw_ml/road_scored.csv /app/dataset/data/raw_ml/road_scored.csv
COPY dataset/data/raw_ml/facility_clean.csv /app/dataset/data/raw_ml/facility_clean.csv
COPY dataset/data/raw_ml/tour_poi.csv /app/dataset/data/raw_ml/tour_poi.csv
COPY chroma_db/ /app/chroma_db/

ENV KRIDE_MODELS_DIR=/app/dataset/models \
    KRIDE_RAW_DATA_DIR=/app/dataset/data/raw_ml \
    CHROMA_MODE=persistent \
    CHROMA_PATH=/app/chroma_db \
    TORCHSERVE_ENABLED=false \
    TORCHSERVE_FALLBACK=true \
    HF_HOME=/tmp/hf_cache \
    TRANSFORMERS_CACHE=/tmp/hf_cache/hub

EXPOSE 8000

CMD ["uvicorn", "src.api.fastapi_server:app", "--host", "0.0.0.0", "--port", "8000"]
