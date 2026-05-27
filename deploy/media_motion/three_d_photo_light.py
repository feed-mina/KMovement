from __future__ import annotations

import json
import subprocess
from pathlib import Path

from .ffmpeg_utils import mix_video_tts_bgm
from .schemas import Artifact, GenerationResult, TravelCase
from .tts import synthesize_gtts


def build_zoompan_filter(motion: str, *, duration: int = 7, fps: int = 8) -> str:
    """Create an ffmpeg zoompan expression for a static travel photo."""
    frames = duration * fps

    if motion == "left_to_right_pan":
        return (
            "scale=768:-1,"
            "zoompan=z='1.05':"
            f"x='(iw-iw/zoom)*on/{frames}':"
            "y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s=512x320:fps={fps},"
            "format=yuv420p"
        )

    if motion == "right_to_left_pan":
        return (
            "scale=768:-1,"
            "zoompan=z='1.05':"
            f"x='(iw-iw/zoom)*(1-on/{frames})':"
            "y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s=512x320:fps={fps},"
            "format=yuv420p"
        )

    if motion == "gentle_dolly":
        return (
            "scale=768:-1,"
            "zoompan=z='1.02+0.04*sin(on/12)':"
            "x='iw/2-(iw/zoom/2)':"
            "y='ih/2-(ih/zoom/2)':"
            f"d={frames}:s=512x320:fps={fps},"
            "format=yuv420p"
        )

    return (
        "scale=768:-1,"
        "zoompan=z='min(zoom+0.0015,1.09)':"
        "x='iw/2-(iw/zoom/2)':"
        "y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s=512x320:fps={fps},"
        "format=yuv420p"
    )


def create_3d_photo_light_video(case: TravelCase, output_dir: Path) -> Path:
    """Generate a lightweight 3D-photo-style pan/zoom video."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_mp4 = output_dir / f"{case.case_id}_3d_photo_light.mp4"
    if output_mp4.exists():
        return output_mp4

    if not case.image_path.exists():
        raise FileNotFoundError(f"missing input image: {case.image_path}")

    vf = build_zoompan_filter(case.motion)
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


def run_3d_photo_light_case(case: TravelCase, output_root: Path, bgm_wav: Path) -> GenerationResult:
    """Run the complete static-photo branch: motion video + TTS + BGM mux."""
    branch_dir = output_root / "3d_photo_light"
    motion_dir = branch_dir / "motion"
    tts_dir = branch_dir / "tts"
    final_dir = branch_dir / "final"
    meta_dir = branch_dir / "metadata"

    motion_mp4 = create_3d_photo_light_video(case, motion_dir)
    tts_wav = synthesize_gtts(case.tts_text, tts_dir / f"{case.case_id}.wav")
    final_mp4 = mix_video_tts_bgm(motion_mp4, tts_wav, bgm_wav, final_dir / f"{case.case_id}_3d_photo_light_final.mp4")

    metadata = {
        "route": "3d_photo_inpainting_light",
        "case_id": case.case_id,
        "place": case.place,
        "image": str(case.image_path),
        "motion": case.motion,
        "status": "success",
        "note": "Lightweight pan/zoom/dolly branch for static real travel photos.",
    }
    meta_dir.mkdir(parents=True, exist_ok=True)
    meta_path = meta_dir / f"{case.case_id}_3d_photo_light.json"
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    return GenerationResult(
        route="3d_photo_inpainting_light",
        status="success",
        case_id=case.case_id,
        artifacts=[
            Artifact.from_path("motion_video", motion_mp4),
            Artifact.from_path("tts", tts_wav),
            Artifact.from_path("final_video", final_mp4),
            Artifact.from_path("metadata", meta_path),
        ],
        metadata=metadata,
    )

