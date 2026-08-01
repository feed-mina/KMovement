FROM python:3.11-slim

WORKDIR /app

# Keep this shared prefix identical in both K-Ride runtime Dockerfiles. Docker reuses the
# large CPU Torch and application dependency layers across the API and worker
# images instead of storing two copies on the deployment host.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY src/api/requirements-docker.txt /tmp/requirements.txt
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /tmp/requirements.txt

# End of the shared K-Ride dependency layers.

COPY src/ /app/src/

COPY dataset/models/route_graph.pkl /app/dataset/models/route_graph.pkl
COPY dataset/data/raw_ml/road_scored.csv /app/dataset/data/raw_ml/road_scored.csv
COPY dataset/data/raw_ml/facility_clean.csv /app/dataset/data/raw_ml/facility_clean.csv
COPY dataset/data/raw_ml/tour_poi.csv /app/dataset/data/raw_ml/tour_poi.csv

# chroma_db/ 는 이미지에 넣지 않는다. gitignore 대상이라 CI 체크아웃에는 항상
# 비어 있었고, 빈 디렉터리를 구운 이미지가 배포돼 목적 기반 POI 검색이
# 계속 0건이었다(#217). 대신 EC2 호스트의 ~/kride-data/chroma_db 를
# /app/chroma_db 로 마운트한다. deploy/ec2/deploy.sh 참고. 인덱스를 갱신할
# 때 이미지를 다시 빌드할 필요가 없고, 100MB 대 인덱스가 이미지 크기에
# 얹히지도 않는다.

# graphrag_client 는 /app/models/kride_graph.json 을, ensemble_client 는
# /app/models/ensemble_ranker.pkl 을 읽는다. 두 파일이 이미지에 없으면 각각
# 조용히 빈 결과와 단순 합산으로 떨어져 추천 근거가 사라진다. 실제로 그
# 상태로 운영됐다(#217). models/ 전체가 아니라 런타임이 쓰는 두 파일만
# 넣는다. kride_graph.graphml 과 kride_graph_delta.json 은 빌드·보정
# 스크립트 전용이라 이미지에 필요 없다.
COPY models/kride_graph.json /app/models/kride_graph.json
COPY models/ensemble_ranker.pkl /app/models/ensemble_ranker.pkl

ENV KRIDE_MODELS_DIR=/app/dataset/models \
    KRIDE_RAW_DATA_DIR=/app/dataset/data/raw_ml \
    CHROMA_MODE=persistent \
    CHROMA_PATH=/app/chroma_db \
    TORCHSERVE_ENABLED=false \
    TORCHSERVE_FALLBACK=true \
    HF_HOME=/tmp/hf_cache \
    TRANSFORMERS_CACHE=/tmp/hf_cache/hub \
    PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn src.api.fastapi_server:app --host 0.0.0.0 --port ${PORT:-8000}"]
