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

