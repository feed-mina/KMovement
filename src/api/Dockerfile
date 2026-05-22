FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 — torch CPU-only 먼저 설치 (CUDA 제외로 이미지 경량화)
COPY src/api/requirements-docker.txt /tmp/requirements.txt
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /tmp/requirements.txt

# 소스 코드 복사
COPY src/ /app/src/

EXPOSE 8000

CMD ["uvicorn", "src.api.fastapi_server:app", "--host", "0.0.0.0", "--port", "8000"]
