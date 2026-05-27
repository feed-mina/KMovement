from __future__ import annotations

import shutil
from pathlib import Path

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

