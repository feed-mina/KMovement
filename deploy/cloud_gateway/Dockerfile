# Build from the repository root:
# docker build -f deploy/cloud_gateway/Dockerfile -t kride-cloud-gateway .

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV KRIDE_MEDIA_DIR=/app/media
ENV KRIDE_APP_MODE=cloud_preview_gateway

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY deploy/cloud_gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY deploy/cloud_gateway /app/deploy/cloud_gateway

# Put MP4/WAV/JSON/IPYNB files here when building a demo image, or mount /app/media at runtime.
RUN mkdir -p /app/media

EXPOSE 7860

CMD ["uvicorn", "deploy.cloud_gateway.app:app", "--host", "0.0.0.0", "--port", "7860"]

