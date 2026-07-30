# 1. Python 3.9 이미지 기반 (GPU 사용 시 nvidia/cuda 기반 이미지 권장)
FROM python:3.9-slim

# 2. 필수 시스템 패키지 설치 (OpenCV 등 실행용)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-dri \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 3. 작업 디렉토리 설정
WORKDIR /app

# 4. 라이브러리 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . .

# 6. 서버 실행 (FastAPI 예시)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]