"""
Batch Video Worker — orchestrates multi-image video generation.

Flow:
  1. Classify each image as photo or sketch (color-count heuristic)
  2. Generate per-image video segments
  3. Synthesize per-image TTS and mix into segments
  4. Concatenate all segments
  5. Apply MusicGen / fallback BGM
  6. Return GenerationResult with the final video
"""
from __future__ import annotations

import json
from pathlib import Path

from .animated_drawings_worker import gif_to_mp4, run_animated_drawings_pipeline
from .bgm import ensure_fallback_bgm
from .ffmpeg_utils import (
    apply_bgm_to_video,
    concat_videos,
    mix_video_tts,
    overlay_gif_on_video,
    run_ffmpeg,
)
from .schemas import (
    Artifact,
    BatchImageItem,
    BatchTravelCase,
    GenerationResult,
    TravelCase,
)
from .tts import synthesize_gtts
from .worker_config import WorkerConfig, load_worker_config


def _classify_image(image_path: Path) -> str:
    """Classify an image as 'photo' or 'sketch' based on unique color count."""
    try:
        from PIL import Image

        img = Image.open(image_path).convert("RGB").resize((128, 128))
        colors = img.getcolors(maxcolors=16384)
        unique = len(colors) if colors else 16384
        return "sketch" if unique < 800 else "photo"
    except Exception:
        return "photo"


def _resolve_type(item: BatchImageItem) -> str:
    """Resolve 'auto' image_type to 'photo' or 'sketch'."""
    if item.image_type in ("photo", "sketch"):
        return item.image_type
    return _classify_image(item.image_path)


def _generate_photo_segment(
    item: BatchImageItem,
    case_id: str,
    output_dir: Path,
    photo_route: str,
    cfg: WorkerConfig,
) -> Path:
    """Generate a video segment from a photo image."""
    case = TravelCase(
        case_id=f"{case_id}_img{item.index}",
        place="Batch",
        image_path=item.image_path,
        tts_text=item.tts_text,
    )

    if photo_route == "cogvideox_real":
        from .cogvideox_real import create_cogvideox_real_video

        out = output_dir / f"{case.case_id}_cogvideox.mp4"
        try:
            return create_cogvideox_real_video(case.image_path, out, cfg=cfg)
        except Exception:
            pass

    # Default / fallback: 3d_photo_light (ffmpeg zoompan)
    out = output_dir / f"{case.case_id}_zoompan.mp4"
    run_ffmpeg([
        "-loop", "1",
        "-i", str(item.image_path),
        "-vf", "zoompan=z='min(zoom+0.001,1.3)':d=150:s=512x512,format=yuv420p",
        "-t", "5",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        str(out),
    ])
    return out


def _generate_sketch_segment(
    item: BatchImageItem,
    case_id: str,
    output_dir: Path,
    cfg: WorkerConfig,
) -> tuple[Path, Path | None]:
    """Generate a video and optionally a GIF from a sketch image.

    Returns (mp4_path, gif_path_or_None).
    """
    case = TravelCase(
        case_id=f"{case_id}_img{item.index}",
        place="Batch",
        image_path=item.image_path,
        tts_text=item.tts_text,
    )

    # Try AnimatedDrawings if available, fallback to zoompan
    ad_available = bool(cfg.animated_drawings_dir and cfg.animated_drawings_dir.resolve().exists())

    if ad_available:
        try:
            gif_path = run_animated_drawings_pipeline(case, output_dir, cfg)
            work_dir = output_dir / f"{case.case_id}_animated_drawings_work"
            raw_gif = work_dir / "video.gif"
            mp4 = output_dir / f"{case.case_id}_animated_drawings.mp4"
            if not mp4.exists():
                mp4 = gif_to_mp4(raw_gif, mp4) if raw_gif.exists() else gif_path
            return mp4, raw_gif if raw_gif.exists() else None
        except Exception:
            pass  # fall through to zoompan fallback

    # Fallback: simple zoompan for sketch
    out = output_dir / f"{case.case_id}_sketch_zoom.mp4"
    run_ffmpeg([
        "-loop", "1",
        "-i", str(item.image_path),
        "-vf", "zoompan=z='min(zoom+0.001,1.2)':d=100:s=512x512,format=yuv420p",
        "-t", "4",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        str(out),
    ])
    return out, None


def run_batch_video_case(
    batch_case: BatchTravelCase,
    output_root: Path,
    cfg: WorkerConfig | None = None,
) -> GenerationResult:
    """Orchestrate batch video generation from multiple images."""
    cfg = cfg or load_worker_config()
    branch_dir = output_root / "batch_video"
    raw_dir = branch_dir / "raw"
    tts_dir = branch_dir / "tts"
    segments_dir = branch_dir / "segments"
    final_dir = branch_dir / "final"
    meta_dir = branch_dir / "metadata"

    for d in (raw_dir, tts_dir, segments_dir, final_dir, meta_dir):
        d.mkdir(parents=True, exist_ok=True)

    # Step 1: Classify images
    classified: list[tuple[BatchImageItem, str]] = [
        (item, _resolve_type(item)) for item in batch_case.items
    ]

    photos = [(item, t) for item, t in classified if t == "photo"]
    sketches = [(item, t) for item, t in classified if t == "sketch"]
    has_both = bool(photos) and bool(sketches)

    # Step 2 & 3: Generate per-image segments with TTS
    segment_paths: list[Path] = []
    sketch_gifs: dict[int, Path] = {}

    for item, img_type in classified:
        if img_type == "photo":
            video = _generate_photo_segment(
                item, batch_case.case_id, raw_dir, batch_case.photo_route, cfg,
            )
        else:
            video, gif = _generate_sketch_segment(
                item, batch_case.case_id, raw_dir, cfg,
            )
            if gif:
                sketch_gifs[item.index] = gif

        # TTS for this segment
        if item.tts_text.strip():
            tts_wav = synthesize_gtts(
                item.tts_text,
                tts_dir / f"{batch_case.case_id}_img{item.index}.wav",
            )
            segment_with_tts = segments_dir / f"{batch_case.case_id}_seg{item.index}.mp4"
            mix_video_tts(video, tts_wav, segment_with_tts)
            segment_paths.append(segment_with_tts)
        else:
            segment_paths.append(video)

    # Step 2b: If both photos and sketches, overlay sketch GIFs on photo segments
    if has_both and sketch_gifs:
        overlayed_segments: list[Path] = []
        photo_indices = [item.index for item, _ in photos]
        gif_list = list(sketch_gifs.values())
        gif_idx = 0

        for seg_idx, seg_path in enumerate(segment_paths):
            item_index = classified[seg_idx][0].index
            if item_index in photo_indices and gif_idx < len(gif_list):
                overlay_out = segments_dir / f"{batch_case.case_id}_overlay{seg_idx}.mp4"
                try:
                    overlay_gif_on_video(seg_path, gif_list[gif_idx], overlay_out)
                    overlayed_segments.append(overlay_out)
                    gif_idx += 1
                except Exception:
                    overlayed_segments.append(seg_path)
            else:
                overlayed_segments.append(seg_path)
        segment_paths = overlayed_segments

    # Step 4: Concatenate all segments
    if not segment_paths:
        return GenerationResult(
            route="batch_video",
            status="failed",
            case_id=batch_case.case_id,
            error="No video segments were generated.",
        )

    # Normalize all segments to same resolution/codec before concat
    normalized: list[Path] = []
    for i, seg in enumerate(segment_paths):
        norm = segments_dir / f"{batch_case.case_id}_norm{i}.mp4"
        try:
            run_ffmpeg([
                "-i", str(seg),
                "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac", "-ar", "44100", "-ac", "2",
                str(norm),
            ])
            normalized.append(norm)
        except Exception:
            normalized.append(seg)

    concat_mp4 = final_dir / f"{batch_case.case_id}_concat.mp4"
    concat_videos(normalized, concat_mp4)

    # Step 5: Apply BGM
    bgm_wav = ensure_fallback_bgm(branch_dir / "bgm", batch_case.bgm_key)
    final_mp4 = final_dir / f"{batch_case.case_id}_batch_final.mp4"
    apply_bgm_to_video(concat_mp4, bgm_wav, final_mp4)

    # Step 6: Build result
    metadata = {
        "route": "batch_video",
        "case_id": batch_case.case_id,
        "total_images": len(batch_case.items),
        "classification": {
            str(item.index): img_type for item, img_type in classified
        },
        "photo_route": batch_case.photo_route,
        "bgm_key": batch_case.bgm_key,
        "status": "success",
    }
    meta_path = meta_dir / f"{batch_case.case_id}_batch_video.json"
    meta_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8",
    )

    return GenerationResult(
        route="batch_video",
        status="success",
        case_id=batch_case.case_id,
        artifacts=[
            Artifact.from_path("final_video", final_mp4),
            Artifact.from_path("concat_video", concat_mp4),
            Artifact.from_path("metadata", meta_path),
        ],
        metadata=metadata,
    )
