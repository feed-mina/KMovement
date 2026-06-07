from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class TravelCase:
    """One media-motion generation case."""

    case_id: str
    place: str
    image_path: Path
    tts_text: str
    bgm_key: str = "bright_travel"
    prompt: str = ""
    route: str = ""
    motion: str = "slow_zoom_in"
    motion_intensity: float = 0.03
    trajectory_points: list | None = None  # [[x,y], ...] normalized 0.0~1.0
    trajectory_preset: str = ""  # "object_pan_right", "arc_up", etc.


@dataclass(slots=True)
class BatchImageItem:
    """Individual image in a batch video request."""

    index: int
    image_path: Path
    tts_text: str
    image_type: str = "auto"  # "photo", "sketch", or "auto"


@dataclass(slots=True)
class BatchTravelCase:
    """Batch video generation request with multiple images."""

    case_id: str
    place: str
    items: list[BatchImageItem]
    bgm_key: str = "bright_travel"
    photo_route: str = "auto"  # "auto", "cogvideox_real", "3d_photo_light"
    bgm_description: str = ""  # MusicGen prompt (empty → bgm_key sine-wave fallback)
    bgm_duration: int = 15  # MusicGen generation length in seconds


@dataclass(slots=True)
class Artifact:
    """Generated artifact metadata."""

    kind: str
    path: Path
    exists: bool
    size_mb: float = 0.0
    note: str = ""

    @classmethod
    def from_path(cls, kind: str, path: Path, note: str = "") -> "Artifact":
        exists = path.exists()
        size_mb = round(path.stat().st_size / 1024 / 1024, 3) if exists else 0.0
        return cls(kind=kind, path=path, exists=exists, size_mb=size_mb, note=note)


@dataclass(slots=True)
class GenerationResult:
    """Result object for model/fallback workers."""

    route: str
    status: str
    case_id: str
    artifacts: list[Artifact] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    error: str = ""

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["artifacts"] = [
            {
                **asdict(artifact),
                "path": str(artifact.path),
            }
            for artifact in self.artifacts
        ]
        return data

