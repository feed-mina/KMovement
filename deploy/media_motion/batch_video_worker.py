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


def _resolve_photo_route(
    item: BatchImageItem,
    photo_route: str,
    cfg: WorkerConfig,
) -> str:
    """Resolve photo_route="auto" to a concrete route using BLIP-2 caption."""
    if photo_route != "auto":
        return photo_route

    if not cfg.blip2_enabled:
        return "cogvideox_real"

    try:
        from .blip2_captioning import generate_english_caption
        from .routers import route_media_motion

        en_caption = generate_english_caption(item.image_path, cfg)
        if not en_caption:
            return "cogvideox_real"

        is_sketch = _classify_image(item.image_path) == "sketch"
        resolved = route_media_motion(
            en_caption, is_doodle=is_sketch, is_static_photo=True,
        )
        print(f"[batch_video] Auto-route img{item.index}: '{en_caption}' → {resolved}")
        return resolved
    except Exception as exc:
        print(f"[batch_video] Auto-route failed for img{item.index}: {exc}")
        return "cogvideox_real"


def _generate_photo_segment(
    item: BatchImageItem,
    case_id: str,
    output_dir: Path,
    photo_route: str,
    cfg: WorkerConfig,
) -> tuple[Path, str]:
    """Generate a video segment from a photo image."""
    case = TravelCase(
        case_id=f"{case_id}_img{item.index}",
        place="Batch",
        image_path=item.image_path,
        tts_text=item.tts_text,
    )

    resolved_route = _resolve_photo_route(item, photo_route, cfg)

    if resolved_route == "tora_cogvideox_i2v":
        from .tora_cogvideox_real import create_tora_cogvideox_video

        out = output_dir / f"{case.case_id}_tora_i2v.mp4"
        try:
            return create_tora_cogvideox_video(case, out, cfg=cfg), "tora_cogvideox_i2v"
        except Exception as exc:
            print(f"[batch_video] Tora CogVideoX failed for {case.case_id}: {exc}")
            import traceback
            traceback.print_exc()
            # Fall through to cogvideox_real, then 3d_photo_light

    if resolved_route in ("cogvideox_real", "tora_cogvideox_i2v"):
        from .cogvideox_real import create_cogvideox_real_video

        out = output_dir / f"{case.case_id}_cogvideox.mp4"
        try:
            return create_cogvideox_real_video(case, out, cfg=cfg), "cogvideox_real"
        except Exception as exc:
            print(f"[batch_video] CogVideoX failed for {case.case_id}: {exc}")
            import traceback
            traceback.print_exc()

    # Default / fallback: depth parallax → zoompan (via create_3d_photo_light_video)
    from .three_d_photo_light import create_3d_photo_light_video

    out = create_3d_photo_light_video(case, output_dir)
    return out, "3d_photo_light"


def _generate_sketch_segment(
    item: BatchImageItem,
    case_id: str,
    output_dir: Path,
    cfg: WorkerConfig,
) -> tuple[Path, Path | None, str]:
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
            return (
                mp4,
                raw_gif if raw_gif.exists() else None,
                "animated_drawings_worker",
            )
        except Exception as exc:
            print(f"[batch_video] AnimatedDrawings failed for {case.case_id}: {exc}")
            import traceback
            traceback.print_exc()
            # fall through to zoompan fallback

    # Fallback: depth parallax → zoompan (via create_3d_photo_light_video)
    from .three_d_photo_light import create_3d_photo_light_video

    out = create_3d_photo_light_video(case, output_dir)
    return out, None, "3d_photo_light"


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

    # Step 1.5: Auto-caption for items with empty tts_text
    if cfg.blip2_enabled:
        from .blip2_captioning import generate_caption

        for item, _ in classified:
            if not item.tts_text.strip():
                try:
                    item.tts_text = generate_caption(item.image_path, cfg)
                    print(f"[batch_video] BLIP-2 caption for img{item.index}: {item.tts_text}")
                except Exception as exc:
                    print(f"[batch_video] BLIP-2 failed for img{item.index}: {exc}")
                    # tts_text remains empty → TTS skipped for this image

    # Step 2: Generate per-image video segments (sequential — GPU intensive)
    video_paths: dict[int, Path] = {}
    sketch_gifs: dict[int, Path] = {}
    actual_models: dict[int, str] = {}
    failed_image_indexes: list[int] = []

    for item, img_type in classified:
        try:
            if img_type == "photo":
                video, actual_model = _generate_photo_segment(
                    item, batch_case.case_id, raw_dir, batch_case.photo_route, cfg,
                )
            else:
                video, gif, actual_model = _generate_sketch_segment(
                    item, batch_case.case_id, raw_dir, cfg,
                )
                if gif:
                    sketch_gifs[item.index] = gif
            video_paths[item.index] = video
            actual_models[item.index] = actual_model
        except Exception as exc:
            failed_image_indexes.append(item.index)
            print(f"[batch_video] Segment generation failed for image {item.index} ({img_type}): {exc}")
            import traceback
            traceback.print_exc()

    # Step 3: TTS — Celery group for parallel processing
    tts_wav_paths: dict[int, Path] = {}
    tts_items = [
        (item, str(tts_dir / f"{batch_case.case_id}_img{item.index}.wav"))
        for item, _ in classified
        if item.tts_text.strip() and item.index in video_paths
    ]

    if tts_items:
        try:
            from celery import group as celery_group

            from .media_tasks import task_tts_segment

            use_gpt_sovits = bool(cfg.gpt_sovits_dir)
            gpt_sovits_dir_str = str(cfg.gpt_sovits_dir) if cfg.gpt_sovits_dir else None

            tts_tasks = [
                task_tts_segment.s(
                    item.tts_text,
                    wav_path,
                    use_gpt_sovits,
                    gpt_sovits_dir_str,
                )
                for item, wav_path in tts_items
            ]

            print(f"[batch_video] Dispatching {len(tts_tasks)} TTS tasks via Celery group")
            job = celery_group(tts_tasks)
            results = job.apply_async()
            tts_results = results.get(timeout=cfg.timeout_seconds)

            for (item, wav_path), result in zip(tts_items, tts_results):
                tts_wav_paths[item.index] = Path(result["wav_path"])
                print(f"[batch_video] TTS img{item.index}: engine={result['engine']}")
        except Exception as exc:
            print(f"[batch_video] Celery TTS failed, falling back to sequential gTTS: {exc}")
            import traceback
            traceback.print_exc()
            # Fallback: sequential gTTS
            from .tts import synthesize_gtts

            for item, wav_path in tts_items:
                if item.index not in tts_wav_paths:
                    try:
                        tts_wav_paths[item.index] = synthesize_gtts(item.tts_text, Path(wav_path))
                    except Exception as tts_exc:
                        print(f"[batch_video] gTTS fallback failed for img{item.index}: {tts_exc}")

    # Mix TTS into video segments
    segment_paths: list[Path] = []
    segment_item_indexes: list[int] = []
    for item, _ in classified:
        if item.index not in video_paths:
            continue
        video = video_paths[item.index]
        if item.index in tts_wav_paths:
            segment_with_tts = segments_dir / f"{batch_case.case_id}_seg{item.index}.mp4"
            try:
                mix_video_tts(video, tts_wav_paths[item.index], segment_with_tts)
                segment_paths.append(segment_with_tts)
            except Exception:
                segment_paths.append(video)
        else:
            segment_paths.append(video)
        segment_item_indexes.append(item.index)

    # Step 2b: If both photos and sketches, overlay sketch GIFs on photo segments
    if has_both and sketch_gifs:
        overlayed_segments: list[Path] = []
        photo_indices = [item.index for item, _ in photos]
        gif_list = list(sketch_gifs.values())
        gif_idx = 0

        for seg_idx, seg_path in enumerate(segment_paths):
            item_index = segment_item_indexes[seg_idx]
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

    # Step 5: Apply BGM — MusicGen preferred, sine-wave fallback
    bgm_dir = branch_dir / "bgm"
    bgm_wav = None

    if batch_case.bgm_description:
        try:
            from .media_tasks import task_musicgen_bgm

            print(f"[batch_video] MusicGen BGM: '{batch_case.bgm_description}' ({batch_case.bgm_duration}s)")
            result = task_musicgen_bgm.delay(
                batch_case.bgm_description,
                str(bgm_dir / f"{batch_case.case_id}_musicgen.wav"),
                batch_case.bgm_duration,
            )
            bgm_result = result.get(timeout=120)
            bgm_wav = Path(bgm_result["wav_path"])
            print(f"[batch_video] MusicGen BGM generated: {bgm_wav}")
        except Exception as exc:
            print(f"[batch_video] MusicGen BGM failed, using sine-wave fallback: {exc}")
            bgm_wav = None

    if bgm_wav is None:
        bgm_wav = ensure_fallback_bgm(bgm_dir, batch_case.bgm_key)

    final_mp4 = final_dir / f"{batch_case.case_id}_batch_final.mp4"
    apply_bgm_to_video(concat_mp4, bgm_wav, final_mp4)

    # Step 6: Build result
    executed_models = sorted(set(actual_models.values()))
    metadata = {
        "route": "batch_video",
        "case_id": batch_case.case_id,
        "total_images": len(batch_case.items),
        "processed_images": len(segment_paths),
        "failed_image_indexes": sorted(set(failed_image_indexes)),
        "actual_model": (
            executed_models[0]
            if len(executed_models) == 1
            else "mixed:" + ",".join(executed_models)
        ),
        "actual_models": {
            str(index): model for index, model in sorted(actual_models.items())
        },
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
