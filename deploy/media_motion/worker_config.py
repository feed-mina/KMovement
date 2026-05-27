from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_KO_PROMPT = (
    "\uc548\ub155\ud558\uc138\uc694. "
    "\uc9c0\uae08\ubd80\ud130 \uc778\uacf5\uc9c0\ub2a5 "
    "\uc74c\uc131 \ud569\uc131 \ud14c\uc2a4\ud2b8\ub97c "
    "\uc2dc\uc791\ud558\uaca0\uc2b5\ub2c8\ub2e4."
)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def env_path(name: str, default: str | Path = "") -> Path | None:
    value = os.environ.get(name)
    if value:
        return Path(value).expanduser()
    return Path(default).expanduser() if default else None


@dataclass(slots=True)
class WorkerConfig:
    """Environment-backed configuration for optional real model workers."""

    timeout_seconds: int = 1800
    allow_fallback: bool = True

    cogvideox_model_id: str = "THUDM/CogVideoX-2b"
    cogvideox_num_frames: int = 49
    cogvideox_num_inference_steps: int = 30
    cogvideox_fps: int = 8
    cogvideox_cpu_offload: bool = True

    gpt_sovits_dir: Path | None = None
    gpt_sovits_python: str = ""
    gpt_sovits_ref_wav: Path | None = None
    gpt_sovits_prompt_text: str = DEFAULT_KO_PROMPT
    gpt_sovits_gpt_weights: str = "GPT_SoVITS/pretrained_models/s1v3.ckpt"
    gpt_sovits_sovits_weights: str = "GPT_SoVITS/pretrained_models/s2Gv3.pth"

    animated_drawings_dir: Path | None = None
    animated_drawings_python: str = ""
    animated_drawings_motion: Path | None = None
    animated_drawings_retarget: Path | None = None

    three_d_photo_command: str = ""
    three_d_photo_command_json: str = ""


def load_worker_config(*, allow_fallback: bool | None = None) -> WorkerConfig:
    cfg = WorkerConfig(
        timeout_seconds=env_int("KRIDE_WORKER_TIMEOUT_SECONDS", 1800),
        allow_fallback=env_bool("KRIDE_WORKER_ALLOW_FALLBACK", True),
        cogvideox_model_id=os.environ.get("KRIDE_COGVIDEOX_MODEL_ID", "THUDM/CogVideoX-2b"),
        cogvideox_num_frames=env_int("KRIDE_COGVIDEOX_NUM_FRAMES", 49),
        cogvideox_num_inference_steps=env_int("KRIDE_COGVIDEOX_STEPS", 30),
        cogvideox_fps=env_int("KRIDE_COGVIDEOX_FPS", 8),
        cogvideox_cpu_offload=env_bool("KRIDE_COGVIDEOX_CPU_OFFLOAD", True),
        gpt_sovits_dir=env_path("KRIDE_GPT_SOVITS_DIR"),
        gpt_sovits_python=os.environ.get("KRIDE_GPT_SOVITS_PYTHON", ""),
        gpt_sovits_ref_wav=env_path("KRIDE_GPT_SOVITS_REF_WAV"),
        gpt_sovits_prompt_text=os.environ.get("KRIDE_GPT_SOVITS_PROMPT_TEXT", DEFAULT_KO_PROMPT),
        gpt_sovits_gpt_weights=os.environ.get(
            "KRIDE_GPT_SOVITS_GPT_WEIGHTS",
            "GPT_SoVITS/pretrained_models/s1v3.ckpt",
        ),
        gpt_sovits_sovits_weights=os.environ.get(
            "KRIDE_GPT_SOVITS_SOVITS_WEIGHTS",
            "GPT_SoVITS/pretrained_models/s2Gv3.pth",
        ),
        animated_drawings_dir=env_path("KRIDE_ANIMATED_DRAWINGS_DIR"),
        animated_drawings_python=os.environ.get("KRIDE_ANIMATED_DRAWINGS_PYTHON", ""),
        animated_drawings_motion=env_path("KRIDE_ANIMATED_DRAWINGS_MOTION"),
        animated_drawings_retarget=env_path("KRIDE_ANIMATED_DRAWINGS_RETARGET"),
        three_d_photo_command=os.environ.get("KRIDE_3D_PHOTO_COMMAND", ""),
        three_d_photo_command_json=os.environ.get("KRIDE_3D_PHOTO_COMMAND_JSON", ""),
    )
    if allow_fallback is not None:
        cfg.allow_fallback = allow_fallback
    return cfg
