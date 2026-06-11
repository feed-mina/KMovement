from __future__ import annotations

import shutil
from pathlib import Path

from .ffmpeg_utils import overlay_gif_on_video
from .schemas import Artifact, GenerationResult


def register_existing_meta_animation(source_mp4: Path, output_root: Path, *, case_id: str = "meta_combined_6") -> GenerationResult:
    """Register or copy an existing meta-animation artifact.

    This is the cloud-safe wrapper around the already generated AnimatedDrawings
    / meta-animation outputs. Heavy AnimatedDrawings/TorchServe generation
    remains isolated in notebook or worker runtimes.
    """
    if not source_mp4.exists():
        raise FileNotFoundError(f"missing meta-animation source: {source_mp4}")

    target_dir = output_root / "meta_animation"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / source_mp4.name
    if source_mp4.resolve() != target.resolve():
        shutil.copy2(source_mp4, target)

    return GenerationResult(
        route="animated_drawings",
        status="registered",
        case_id=case_id,
        artifacts=[Artifact.from_path("meta_animation_video", target)],
        metadata={
            "route": "animated_drawings",
            "case_id": case_id,
            "source": str(source_mp4),
            "note": "Existing AnimatedDrawings/meta-animation artifact registered for cloud gateway serving.",
        },
    )


def register_meta_animation_with_gif_overlay(
    source_mp4: Path,
    gif_overlay_path: Path | None,
    output_root: Path,
    *,
    case_id: str = "meta_combined_6",
    overlay_position: str = "main_w-overlay_w-10:main_h-overlay_h-10",
    overlay_scale: int | None = None,
) -> GenerationResult:
    """Register meta-animation MP4 with optional animated GIF overlay.
    
    The GIF will loop continuously over the video duration, positioned at the
    bottom-right by default (or custom position). GIF frames scale to ~1/5 of
    video width by default, or a custom scale value.
    
    This is useful for adding watermarks, character animations, or UI elements
    to existing video backgrounds (e.g., CogVideoX or communication videos).
    
    Args:
        source_mp4: Path to the base meta-animation MP4 video.
        gif_overlay_path: Optional path to animated GIF to overlay on the video.
                         If None or doesn't exist, returns base video without overlay.
        output_root: Root output directory.
        case_id: Case identifier.
        overlay_position: FFmpeg overlay position (e.g., "10:10" or "main_w-overlay_w-10:main_h-overlay_h-10" for bottom-right).
        overlay_scale: GIF scale in pixels (width). If None, uses ~1/5 of video width (200px default).
    
    Returns:
        GenerationResult with the final video (with or without overlay).
    
    Example:
        >>> result = register_meta_animation_with_gif_overlay(
        ...     Path("video.mp4"),
        ...     Path("watermark.gif"),
        ...     Path("output"),
        ...     case_id="my_case",
        ...     overlay_position="main_w-overlay_w-10:main_h-overlay_h-10",
        ...     overlay_scale=150,
        ... )
        >>> # Output: video_with_overlay.mp4 in output/meta_animation/
    """
    if not source_mp4.exists():
        raise FileNotFoundError(f"missing meta-animation source: {source_mp4}")

    target_dir = output_root / "meta_animation"
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # First copy/register the source MP4
    registered_mp4 = target_dir / source_mp4.name
    if source_mp4.resolve() != registered_mp4.resolve():
        shutil.copy2(source_mp4, registered_mp4)
    
    # If no GIF overlay requested, return the base registration
    if not gif_overlay_path or not gif_overlay_path.exists():
        return GenerationResult(
            route="animated_drawings",
            status="registered",
            case_id=case_id,
            artifacts=[Artifact.from_path("meta_animation_video", registered_mp4)],
            metadata={
                "route": "animated_drawings",
                "case_id": case_id,
                "source": str(source_mp4),
                "gif_overlay": None,
                "note": "Meta-animation artifact registered (no GIF overlay)",
            },
        )
    
    # Apply GIF overlay if provided
    final_mp4 = target_dir / f"{registered_mp4.stem}_with_overlay.mp4"
    
    try:
        overlay_gif_on_video(
            registered_mp4,
            gif_overlay_path,
            final_mp4,
            position=overlay_position,
            scale=overlay_scale or 200,  # default ~1/5 of typical 1920 width
        )
        
        return GenerationResult(
            route="animated_drawings",
            status="completed",
            case_id=case_id,
            artifacts=[
                Artifact.from_path("meta_animation_base", registered_mp4),
                Artifact.from_path("meta_animation_video", final_mp4),
            ],
            metadata={
                "route": "animated_drawings",
                "case_id": case_id,
                "source": str(source_mp4),
                "gif_overlay": str(gif_overlay_path),
                "overlay_position": overlay_position,
                "overlay_scale": overlay_scale or 200,
                "note": "Meta-animation with GIF overlay composited via FFmpeg.",
            },
        )
    except Exception as exc:
        raise RuntimeError(f"GIF overlay failed: {exc}") from exc

