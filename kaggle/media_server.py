"""
media_server.py — K-Ride 미디어 생성 FastAPI (Kaggle GPU 전용)
================================================================
노트북 B 전용: TTS, MusicGen, 3D Photo Inpainting, 인물 영상, FFmpeg 합성

[아키텍처]
  POST /api/media/tts         → 한국어 TTS (GPT-SoVITS V3 프록시, localhost:9880)
  POST /api/media/musicgen    → BGM 생성 (MusicGen, ~3-6GB VRAM)
  POST /api/media/inpaint3d   → 풍경 사진 → 카메라 무빙 영상 (Depth Anything V2 + Ken Burns)
  POST /api/media/animate     → 인물/복잡 사진 → 영상 (CogVideoX 1.5, ~12-16GB VRAM)
  POST /api/media/render      → TTS + BGM + 영상 → FFmpeg 합성
  GET  /api/media/status/{id} → 작업 상태 폴링
  GET  /api/media/download/{id} → 완성 파일 다운로드
  GET  /api/health             → 서버 + GPU 상태

[실행]
  uvicorn media_server:app --host 0.0.0.0 --port 8001 &
"""
from __future__ import annotations

import gc
import os
import time
import uuid
import shutil
import subprocess
import traceback
from concurrent.futures import ThreadPoolExecutor
from enum import Enum
from pathlib import Path
from typing import Optional

import requests as http_requests
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ══════════════════════════════════════════════════════════════════════════════
# 설정
# ══════════════════════════════════════════════════════════════════════════════
OUTPUT_DIR = Path(os.environ.get("MEDIA_OUTPUT_DIR", "/kaggle/working/media_output"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_DIR = Path(os.environ.get("MEDIA_UPLOAD_DIR", "/kaggle/working/media_upload"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# 동시 작업 제한 (T4 16GB 보호)
MAX_WORKERS = 1
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

# ── GPT-SoVITS V3 설정 ──────────────────────────────────────────────────────
SOVITS_API_URL = os.environ.get("SOVITS_API_URL", "http://127.0.0.1:9880")
SOVITS_DIR = os.environ.get("SOVITS_DIR", "/kaggle/input/kride-media-data/GPT-SoVITS")
SOVITS_REF_WAV = os.environ.get("SOVITS_REF_WAV", "/kaggle/input/kride-media-data/ref.wav")

# ── CogVideoX 설정 ──────────────────────────────────────────────────────────
COGVIDEOX_MODEL_PATH = os.environ.get("COGVIDEOX_MODEL_PATH", "/kaggle/input/kride-cogvideox")


# ══════════════════════════════════════════════════════════════════════════════
# 작업 상태 관리 (인메모리)
# ══════════════════════════════════════════════════════════════════════════════

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Job:
    def __init__(self, job_id: str, job_type: str):
        self.job_id = job_id
        self.job_type = job_type
        self.status = JobStatus.QUEUED
        self.created_at = time.time()
        self.started_at: float | None = None
        self.completed_at: float | None = None
        self.result_path: str | None = None
        self.error: str | None = None
        self.progress: str = ""

    def to_dict(self):
        elapsed = None
        if self.started_at:
            end = self.completed_at or time.time()
            elapsed = round(end - self.started_at, 1)
        return {
            "job_id": self.job_id,
            "job_type": self.job_type,
            "status": self.status.value,
            "progress": self.progress,
            "elapsed_seconds": elapsed,
            "result_path": self.result_path,
            "error": self.error,
        }


_jobs: dict[str, Job] = {}


def _create_job(job_type: str) -> Job:
    job_id = str(uuid.uuid4())[:8]
    job = Job(job_id, job_type)
    _jobs[job_id] = job
    return job


# ══════════════════════════════════════════════════════════════════════════════
# GPT-SoVITS V3 서버 관리
# ══════════════════════════════════════════════════════════════════════════════
_sovits_proc: subprocess.Popen | None = None


def _start_sovits_server():
    """GPT-SoVITS V3 API 서버를 서브프로세스로 시작"""
    global _sovits_proc

    # 이미 실행 중이면 health check
    if _sovits_proc is not None and _sovits_proc.poll() is None:
        if _sovits_health_check():
            return
        # 프로세스 살아있지만 응답 없으면 재시작
        _sovits_proc.terminate()
        _sovits_proc.wait(timeout=10)

    api_py = os.path.join(SOVITS_DIR, "api.py")
    if not os.path.exists(api_py):
        raise FileNotFoundError(
            f"GPT-SoVITS api.py 없음: {api_py}. "
            f"SOVITS_DIR={SOVITS_DIR} 경로에 GPT-SoVITS를 배치하세요."
        )

    cmd = [
        "python", api_py,
        "-a", "127.0.0.1", "-p", "9880",
        "-c", os.path.join(SOVITS_DIR, "GPT_SoVITS", "configs", "tts_infer.yaml"),
        "-g", os.path.join(SOVITS_DIR, "GPT_SoVITS", "pretrained_models", "s1v3.ckpt"),
        "-s", os.path.join(SOVITS_DIR, "GPT_SoVITS", "pretrained_models", "s2Gv3.pth"),
    ]

    print(f"[Media] GPT-SoVITS V3 서버 시작: {' '.join(cmd)}")
    _sovits_proc = subprocess.Popen(
        cmd, cwd=SOVITS_DIR,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )

    # 서버 준비 대기 (최대 60초)
    for i in range(60):
        time.sleep(1)
        if _sovits_health_check():
            print(f"[Media] GPT-SoVITS V3 서버 준비 완료 ({i+1}초)")
            return
        if _sovits_proc.poll() is not None:
            stderr = _sovits_proc.stderr.read().decode(errors="replace")[:500]
            raise RuntimeError(f"GPT-SoVITS 서버 비정상 종료: {stderr}")

    raise RuntimeError("GPT-SoVITS 서버 시작 타임아웃 (60초)")


def _sovits_health_check() -> bool:
    """GPT-SoVITS 서버 응답 확인"""
    try:
        resp = http_requests.get(SOVITS_API_URL, timeout=2)
        return resp.status_code < 500
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════════════════════
# 모델 싱글턴 (lazy loading — 사용 시점에 로드)
# ══════════════════════════════════════════════════════════════════════════════
_musicgen_model = None


def _get_musicgen():
    """MusicGen 모델 로드 (small 또는 medium)"""
    global _musicgen_model
    if _musicgen_model is None:
        from audiocraft.models import MusicGen
        model_name = os.environ.get("MUSICGEN_MODEL", "facebook/musicgen-small")
        print(f"[Media] MusicGen 로딩 중... ({model_name})")
        _musicgen_model = MusicGen.get_pretrained(model_name)
        print("[Media] MusicGen 로딩 완료")
    return _musicgen_model


def _unload_model(name: str):
    """GPU 메모리 해제 (모델 교체 시)"""
    import torch
    global _musicgen_model, _sovits_proc

    if name == "musicgen" and _musicgen_model is not None:
        del _musicgen_model
        _musicgen_model = None
    elif name == "sovits":
        if _sovits_proc is not None and _sovits_proc.poll() is None:
            _sovits_proc.terminate()
            _sovits_proc.wait(timeout=10)
            _sovits_proc = None
            print("[Media] GPT-SoVITS 서버 종료")
    elif name == "cogvideox":
        pass  # CogVideoX는 _run_animate 내에서 매번 해제됨

    torch.cuda.empty_cache()
    gc.collect()
    print(f"[Media] {name} 모델 언로드 + GPU 캐시 해제")


# ══════════════════════════════════════════════════════════════════════════════
# 작업 실행 함수들
# ══════════════════════════════════════════════════════════════════════════════

def _run_tts(job: Job, text: str, text_language: str,
             refer_wav_path: str | None, prompt_text: str | None,
             prompt_language: str):
    """TTS 작업 실행 — GPT-SoVITS V3 API 프록시"""
    try:
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        job.progress = "GPT-SoVITS 서버 확인 중"

        _start_sovits_server()

        out_path = str(OUTPUT_DIR / f"{job.job_id}_tts.wav")
        job.progress = "음성 생성 중"

        payload = {
            "text": text,
            "text_language": text_language,
        }

        # 기준 화자 음성 설정
        ref_wav = refer_wav_path or SOVITS_REF_WAV
        if ref_wav and os.path.exists(ref_wav):
            payload["refer_wav_path"] = ref_wav
            if prompt_text:
                payload["prompt_text"] = prompt_text
                payload["prompt_language"] = prompt_language

        resp = http_requests.post(SOVITS_API_URL, json=payload, timeout=120)

        if resp.status_code != 200:
            raise RuntimeError(
                f"GPT-SoVITS API 오류 {resp.status_code}: {resp.text[:300]}"
            )

        # 응답 바디 = WAV 바이너리
        with open(out_path, "wb") as f:
            f.write(resp.content)

        job.result_path = out_path
        job.status = JobStatus.COMPLETED
        job.progress = "완료"
        job.completed_at = time.time()
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        job.completed_at = time.time()
        traceback.print_exc()


def _run_musicgen(job: Job, description: str, duration: int):
    """MusicGen BGM 생성"""
    try:
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        job.progress = "MusicGen 모델 로딩 중"

        model = _get_musicgen()
        model.set_generation_params(
            duration=min(duration, 30),  # 최대 30초
            use_sampling=True,
            top_k=250,
        )

        job.progress = f"BGM 생성 중 ({duration}초)"

        from audiocraft.data.audio import audio_write
        wav = model.generate([description])

        out_path = str(OUTPUT_DIR / f"{job.job_id}_bgm")
        audio_write(out_path, wav[0].cpu(), model.sample_rate, strategy="loudness")
        out_path += ".wav"

        job.result_path = out_path
        job.status = JobStatus.COMPLETED
        job.progress = "완료"
        job.completed_at = time.time()
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        job.completed_at = time.time()
        traceback.print_exc()


def _run_inpaint3d(job: Job, image_path: str):
    """3D Photo Inpainting — 풍경 사진 카메라 무빙"""
    try:
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        job.progress = "Depth 추정 중"

        import torch
        import numpy as np
        from PIL import Image

        # Depth Anything V2 사용 (MiDaS 대체)
        from transformers import pipeline

        depth_pipe = pipeline(
            "depth-estimation",
            model="depth-anything/Depth-Anything-V2-Small-hf",
            device=0 if torch.cuda.is_available() else -1,
        )

        img = Image.open(image_path).convert("RGB")
        # 가로 512px로 리사이즈 (GPU 절약)
        w, h = img.size
        if w > 512:
            ratio = 512 / w
            img = img.resize((512, int(h * ratio)), Image.LANCZOS)

        job.progress = "Depth 맵 생성 중"
        depth_result = depth_pipe(img)
        depth_map = depth_result["depth"]

        # Depth map을 NumPy 배열로 변환
        depth_np = np.array(depth_map)

        # Ken Burns 효과: crop → zoom 애니메이션
        job.progress = "Ken Burns 카메라 무빙 생성 중"
        img_np = np.array(img)
        h, w = img_np.shape[:2]
        fps = 24
        total_frames = fps * 4  # 4초 영상

        out_path = str(OUTPUT_DIR / f"{job.job_id}_3d.mp4")

        # FFmpeg pipe로 영상 생성
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "rawvideo", "-vcodec", "rawvideo",
            "-s", f"{w}x{h}", "-pix_fmt", "rgb24",
            "-r", str(fps),
            "-i", "-",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            out_path,
        ]

        proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

        for i in range(total_frames):
            t = i / total_frames
            # 부드러운 zoom-in + pan 효과 (depth 기반 가중치)
            zoom = 1.0 + 0.15 * t  # 1.0 → 1.15x
            pan_x = int(w * 0.05 * t)
            pan_y = int(h * 0.03 * t)

            # crop 영역 계산
            cw = int(w / zoom)
            ch = int(h / zoom)
            cx = min(pan_x, w - cw)
            cy = min(pan_y, h - ch)

            from PIL import Image as PILImage
            frame = PILImage.fromarray(img_np)
            frame = frame.crop((cx, cy, cx + cw, cy + ch))
            frame = frame.resize((w, h), PILImage.LANCZOS)
            proc.stdin.write(np.array(frame).tobytes())

        proc.stdin.close()
        proc.wait()

        # depth model 해제
        del depth_pipe
        torch.cuda.empty_cache()

        job.result_path = out_path
        job.status = JobStatus.COMPLETED
        job.progress = "완료"
        job.completed_at = time.time()
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        job.completed_at = time.time()
        traceback.print_exc()


def _run_animate(job: Job, image_path: str, prompt: str,
                 num_inference_steps: int, guidance_scale: float):
    """인물/복잡 사진 → 영상 (CogVideoX 1.5 Image-to-Video)"""
    try:
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        job.progress = "CogVideoX 파이프라인 로딩 중"

        import torch
        from PIL import Image

        if not os.path.exists(COGVIDEOX_MODEL_PATH):
            raise FileNotFoundError(
                f"CogVideoX 모델 없음: {COGVIDEOX_MODEL_PATH}. "
                "Kaggle Dataset에 kride-cogvideox를 추가하세요."
            )

        from diffusers import CogVideoXImageToVideoPipeline
        from diffusers.utils import export_to_video

        pipe = CogVideoXImageToVideoPipeline.from_pretrained(
            COGVIDEOX_MODEL_PATH,
            torch_dtype=torch.float16,
            local_files_only=True,
        )
        pipe.enable_sequential_cpu_offload()
        pipe.vae.enable_slicing()
        pipe.vae.enable_tiling()

        job.progress = "이미지 로딩 중"
        image = Image.open(image_path).convert("RGB")
        # CogVideoX 권장 해상도로 리사이즈
        image = image.resize((720, 480), Image.LANCZOS)

        job.progress = f"영상 생성 중 (steps={num_inference_steps}, ~10-15분 소요)"

        video_frames = pipe(
            image=image,
            prompt=prompt,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
        ).frames[0]

        out_path = str(OUTPUT_DIR / f"{job.job_id}_animate.mp4")
        export_to_video(video_frames, out_path, fps=8)

        # VRAM 즉시 해제
        del pipe
        gc.collect()
        torch.cuda.empty_cache()

        job.result_path = out_path
        job.status = JobStatus.COMPLETED
        job.progress = "완료"
        job.completed_at = time.time()
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        job.completed_at = time.time()
        # VRAM 해제 시도
        gc.collect()
        try:
            import torch
            torch.cuda.empty_cache()
        except Exception:
            pass
        traceback.print_exc()


def _run_render(job: Job, video_path: str, tts_path: str | None,
                bgm_path: str | None, bgm_volume: float):
    """FFmpeg 합성: 영상 + TTS + BGM → 최종 mp4"""
    try:
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        job.progress = "FFmpeg 합성 준비 중"

        out_path = str(OUTPUT_DIR / f"{job.job_id}_final.mp4")

        if not os.path.exists(video_path):
            raise FileNotFoundError(f"영상 파일 없음: {video_path}")

        inputs = ["-i", video_path]
        input_idx = 1  # 0 = video

        # TTS 오디오
        if tts_path and os.path.exists(tts_path):
            inputs += ["-i", tts_path]
            input_idx += 1

        # BGM 오디오
        if bgm_path and os.path.exists(bgm_path):
            inputs += ["-i", bgm_path]
            input_idx += 1

        job.progress = "오디오 믹싱 중"

        # 오디오가 모두 있을 때: amix
        if tts_path and os.path.exists(tts_path) and bgm_path and os.path.exists(bgm_path):
            cmd = [
                "ffmpeg", "-y",
                *inputs,
                "-filter_complex",
                f"[1:a]volume=1.0[tts];[2:a]volume={bgm_volume}[bgm];[tts][bgm]amix=inputs=2:duration=first[aout]",
                "-map", "0:v", "-map", "[aout]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                out_path,
            ]
        elif tts_path and os.path.exists(tts_path):
            cmd = [
                "ffmpeg", "-y",
                *inputs,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                out_path,
            ]
        elif bgm_path and os.path.exists(bgm_path):
            cmd = [
                "ffmpeg", "-y",
                *inputs,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-shortest",
                out_path,
            ]
        else:
            # 오디오 없이 영상만
            cmd = ["ffmpeg", "-y", "-i", video_path, "-c:v", "copy", out_path]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg 실패: {result.stderr[:500]}")

        job.result_path = out_path
        job.status = JobStatus.COMPLETED
        job.progress = "완료"
        job.completed_at = time.time()
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        job.completed_at = time.time()
        traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════════
# 파일 업로드 헬퍼
# ══════════════════════════════════════════════════════════════════════════════
def _save_upload(upload: UploadFile, prefix: str) -> str:
    """업로드 파일 저장 → 경로 반환"""
    ext = Path(upload.filename).suffix if upload.filename else ""
    file_path = str(UPLOAD_DIR / f"{prefix}_{uuid.uuid4().hex[:6]}{ext}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(upload.file, f)
    return file_path


def _download_image(url: str) -> str:
    """URL에서 이미지 다운로드 → 로컬 경로 반환"""
    resp = http_requests.get(url, timeout=30)
    resp.raise_for_status()
    ext = ".jpg"
    ct = resp.headers.get("content-type", "")
    if "png" in ct:
        ext = ".png"
    elif "webp" in ct:
        ext = ".webp"
    file_path = str(UPLOAD_DIR / f"dl_{uuid.uuid4().hex[:6]}{ext}")
    with open(file_path, "wb") as f:
        f.write(resp.content)
    return file_path


# ══════════════════════════════════════════════════════════════════════════════
# FastAPI 앱
# ══════════════════════════════════════════════════════════════════════════════
app = FastAPI(
    title="K-Ride Media API (Kaggle GPU)",
    version="2.0.0-kaggle",
    description="GPT-SoVITS V3 TTS · MusicGen · 3D Photo Inpainting · CogVideoX 1.5 · FFmpeg 합성",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    gpu_info = {}
    try:
        import torch
        if torch.cuda.is_available():
            gpu_info = {
                "gpu_name": torch.cuda.get_device_name(0),
                "gpu_memory_total_gb": round(torch.cuda.get_device_properties(0).total_mem / 1e9, 1),
                "gpu_memory_used_gb": round(torch.cuda.memory_allocated(0) / 1e9, 2),
                "gpu_memory_cached_gb": round(torch.cuda.memory_reserved(0) / 1e9, 2),
            }
        else:
            gpu_info = {"gpu": "not available"}
    except ImportError:
        gpu_info = {"torch": "not installed"}

    active_jobs = sum(1 for j in _jobs.values() if j.status == JobStatus.RUNNING)

    return {
        "status": "ok",
        "runtime": "kaggle-gpu",
        **gpu_info,
        "active_jobs": active_jobs,
        "total_jobs": len(_jobs),
        "max_workers": MAX_WORKERS,
        "sovits_server": _sovits_health_check(),
    }


# ── 작업 상태 / 다운로드 ────────────────────────────────────────────────────

@app.get("/api/media/status/{job_id}")
def get_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job.to_dict()


@app.get("/api/media/jobs")
def list_jobs(limit: int = 20):
    """최근 작업 목록"""
    sorted_jobs = sorted(_jobs.values(), key=lambda j: j.created_at, reverse=True)
    return {"jobs": [j.to_dict() for j in sorted_jobs[:limit]]}


@app.get("/api/media/download/{job_id}")
def download_result(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Job {job_id} is {job.status.value}")
    if not job.result_path or not os.path.exists(job.result_path):
        raise HTTPException(status_code=404, detail="Result file not found")

    return FileResponse(
        job.result_path,
        filename=os.path.basename(job.result_path),
        media_type="application/octet-stream",
    )


# ── TTS (GPT-SoVITS V3) ─────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    text_language: str = "ko"
    refer_wav_path: Optional[str] = None    # 기준 화자 음성 경로
    prompt_text: Optional[str] = None       # 기준 음성 대본
    prompt_language: str = "ko"


@app.post("/api/media/tts")
def create_tts(req: TTSRequest):
    """한국어 TTS 음성 생성 (GPT-SoVITS V3)"""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text가 비어있습니다")

    job = _create_job("tts")
    executor.submit(
        _run_tts, job, req.text, req.text_language,
        req.refer_wav_path, req.prompt_text, req.prompt_language,
    )

    return {"job_id": job.job_id, "status": job.status.value, "message": "TTS 작업이 시작되었습니다."}


# ── MusicGen ─────────────────────────────────────────────────────────────────

class MusicGenRequest(BaseModel):
    description: str = "calm Korean traditional ambient music, gayageum, peaceful travel"
    duration: int = 15  # 초 (최대 30)


@app.post("/api/media/musicgen")
def create_musicgen(req: MusicGenRequest):
    """MusicGen BGM 생성"""
    if req.duration > 30:
        raise HTTPException(status_code=400, detail="duration은 최대 30초입니다")

    job = _create_job("musicgen")
    executor.submit(_run_musicgen, job, req.description, req.duration)

    return {"job_id": job.job_id, "status": job.status.value, "message": f"BGM 생성 시작 ({req.duration}초)"}


# ── 3D Photo Inpainting ─────────────────────────────────────────────────────

@app.post("/api/media/inpaint3d")
async def create_inpaint3d(image: UploadFile = File(...)):
    """풍경 사진 → Depth 기반 카메라 무빙 영상 (Ken Burns)"""
    image_path = _save_upload(image, "landscape")
    job = _create_job("inpaint3d")
    executor.submit(_run_inpaint3d, job, image_path)

    return {"job_id": job.job_id, "status": job.status.value, "message": "3D 카메라 무빙 생성 시작"}


# ── Animate (CogVideoX 1.5 Image-to-Video) ──────────────────────────────────

class AnimateRequest(BaseModel):
    prompt: str = "A person gently moving, cinematic Korean travel scene"
    image_url: str                                # 이미지 URL (Supabase 등)
    num_inference_steps: int = 15
    guidance_scale: float = 6.0


@app.post("/api/media/animate")
def create_animate(req: AnimateRequest):
    """인물/복잡 사진 → 영상 (CogVideoX 1.5, 10~15분 소요)"""
    if not req.image_url.strip():
        raise HTTPException(status_code=400, detail="image_url이 비어있습니다")

    # 이미지 다운로드
    try:
        image_path = _download_image(req.image_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"이미지 다운로드 실패: {e}")

    job = _create_job("animate")
    executor.submit(
        _run_animate, job, image_path, req.prompt,
        req.num_inference_steps, req.guidance_scale,
    )

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "message": "CogVideoX 영상 생성 시작 (10~15분 소요)",
    }


@app.post("/api/media/animate/upload")
async def create_animate_upload(
    prompt: str = Form("A person gently moving, cinematic scene"),
    source_image: UploadFile = File(...),
    num_inference_steps: int = Form(15),
    guidance_scale: float = Form(6.0),
):
    """인물 사진 직접 업로드 → CogVideoX 영상"""
    image_path = _save_upload(source_image, "person")

    job = _create_job("animate")
    executor.submit(
        _run_animate, job, image_path, prompt,
        num_inference_steps, guidance_scale,
    )

    return {
        "job_id": job.job_id,
        "status": job.status.value,
        "message": "CogVideoX 영상 생성 시작 (10~15분 소요)",
    }


# ── Render (FFmpeg 합성) ─────────────────────────────────────────────────────

class RenderRequest(BaseModel):
    video_job_id: str       # animate 또는 inpaint3d의 job_id
    tts_job_id: Optional[str] = None
    bgm_job_id: Optional[str] = None
    bgm_volume: float = 0.3  # BGM 볼륨 (0.0~1.0)


@app.post("/api/media/render")
def create_render(req: RenderRequest):
    """영상 + TTS + BGM → 최종 합성"""
    # 선행 작업 결과 경로 확인
    video_job = _jobs.get(req.video_job_id)
    if not video_job or video_job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"video job {req.video_job_id}이 완료되지 않았습니다")

    tts_path = None
    if req.tts_job_id:
        tts_job = _jobs.get(req.tts_job_id)
        if tts_job and tts_job.status == JobStatus.COMPLETED:
            tts_path = tts_job.result_path

    bgm_path = None
    if req.bgm_job_id:
        bgm_job = _jobs.get(req.bgm_job_id)
        if bgm_job and bgm_job.status == JobStatus.COMPLETED:
            bgm_path = bgm_job.result_path

    job = _create_job("render")
    executor.submit(_run_render, job, video_job.result_path, tts_path, bgm_path, req.bgm_volume)

    return {"job_id": job.job_id, "status": job.status.value, "message": "FFmpeg 합성 시작"}


# ── GPU 메모리 관리 ──────────────────────────────────────────────────────────

@app.post("/api/media/unload/{model_name}")
def unload_model(model_name: str):
    """GPU 메모리 해제 (musicgen | sovits | cogvideox)"""
    if model_name not in ("musicgen", "sovits", "cogvideox"):
        raise HTTPException(status_code=400, detail="model_name: musicgen, sovits, cogvideox")
    _unload_model(model_name)
    return {"status": "ok", "unloaded": model_name}


# ══════════════════════════════════════════════════════════════════════════════
# 직접 실행
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
