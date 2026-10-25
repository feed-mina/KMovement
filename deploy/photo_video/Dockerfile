FROM python:3.12-slim
ARG PHOTO_VIDEO_REVISION=development
LABEL org.opencontainers.image.revision=$PHOTO_VIDEO_REVISION
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY deploy/photo_video/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY deploy/photo_video ./deploy/photo_video
RUN useradd --uid 10001 --create-home workflow && mkdir -p /data/photo-video && chown -R workflow:workflow /data
USER workflow
EXPOSE 8085
CMD ["python", "-m", "uvicorn", "deploy.photo_video.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8085"]

ARG PHOTO_VIDEO_REVISION=development
LABEL org.opencontainers.image.revision=$PHOTO_VIDEO_REVISION
