from __future__ import annotations

import json
import subprocess
from pathlib import Path

from .ffmpeg_utils import mix_video_tts_bgm
from .schemas import Artifact, GenerationResult, TravelCase
from .tts import synthesize_gtts


def build_cogvideo_fallback_filter(case_id: str, *, duration: int = 7, fps: int = 8) -> str:
    """Create a deterministic real-photo fallback for the CogVideoX branch."""
    frames = duration * fps

    if "beach" in case_id:
        return (
            "scale=768:-1,"
            "zoompan=z='min(zoom+0.0012,1.08)':"
            "x='iw/2-(iw/zoom/2)':"
            "y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s=512x320:fps={fps},"
            "eq=saturation=1.08:contrast=1.03,"
            "format=yuv420p"
        )

    if "gwanghwamun" in case_id:
        return (
            "scale=768:-1,"
            "zoompan=z='1.06':"
            f"x='(iw-iw/zoom)*on/{frames}':"
            "y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s=512x320:fps={fps},"
            "eq=saturation=1.02:contrast=1.05,"
            "format=yuv420p"
        )

    return (
        "scale=768:-1,"
        "zoompan=z='1.02+0.04*sin(on/12)':"
        "x='iw/2-(iw/zoom/2)':"
        "y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s=512x320:fps={fps},"
        "eq=saturation=1.03:contrast=1.04,"
        "format=yuv420p"
    )


def create_cogvideo_photo_fallback(case: TravelCase, output_dir: Path) -> Path:
    """Generate a fallback photo-motion video for a failed CogVideoX run."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_mp4 = output_dir / f"{case.case_id}_cogvideo_photo_fallback.mp4"
    if output_mp4.exists():
        return output_mp4

    if not case.image_path.exists():
        raise FileNotFoundError(f"missing input image: {case.image_path}")

    vf = build_cogvideo_fallback_filter(case.case_id)
    command = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-i",
        str(case.image_path),
        "-vf",
        vf,
        "-t",
        "7",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        str(output_mp4),
        "-loglevel",
        "quiet",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-2000:])

    return output_mp4


def run_cogvideo_fallback_case(case: TravelCase, output_root: Path, bgm_wav: Path) -> GenerationResult:
    """Run the real-photo CogVideoX branch fallback path.

    This does not claim to execute CogVideoX. It preserves the branch contract
    when CogVideoX crashes, OOMs, or times out in a limited GPU environment.
    """
    branch_dir = output_root / "cogvideo_photo"
    fallback_dir = branch_dir / "fallback"
    tts_dir = branch_dir / "tts"
    final_dir = branch_dir / "final"
    meta_dir = branch_dir / "metadata"

    fallback_mp4 = create_cogvideo_photo_fallback(case, fallback_dir)
    tts_wav = synthesize_gtts(case.tts_text, tts_dir / f"{case.case_id}.wav")
    final_mp4 = mix_video_tts_bgm(fallback_mp4, tts_wav, bgm_wav, final_dir / f"{case.case_id}_cogvideo_photo_final.mp4")

    metadata = {
        "route": "cogvideox",
        "case_id": case.case_id,
        "place": case.place,
        "image": str(case.image_path),
        "prompt": case.prompt,
        "model_attempted": "THUDM/CogVideoX-2b",
        "actual_model_executed": False,
        "status": "fallback_used",
        "fallback_type": "photo_motion_video",
        "fallback_reason": "CogVideoX was unavailable or unstable in the current GPU runtime.",
    }
    meta_dir.mkdir(parents=True, exist_ok=True)
    meta_path = meta_dir / f"{case.case_id}_cogvideo_route.json"
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    return GenerationResult(
        route="cogvideox",
        status="fallback_used",
        case_id=case.case_id,
        artifacts=[
            Artifact.from_path("fallback_video", fallback_mp4),
            Artifact.from_path("tts", tts_wav),
            Artifact.from_path("final_video", final_mp4),
            Artifact.from_path("metadata", meta_path),
        ],
        metadata=metadata,
    )

