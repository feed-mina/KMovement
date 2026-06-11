"""Tora trajectory preprocessing — validate, normalize, interpolate, and write point files.

Produces the same point-file format that the official Tora ``sat/sample_video.py``
expects (``--point_path``).  Each trajectory is a list of (x, y) tuples in
normalised 0.0-1.0 coordinates.
"""
from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Presets — common trajectory patterns
# ---------------------------------------------------------------------------

TRAJECTORY_PRESETS: dict[str, list[tuple[float, float]]] = {
    "object_pan_right": [(0.3, 0.5), (0.7, 0.5)],
    "object_pan_left": [(0.7, 0.5), (0.3, 0.5)],
    "arc_up": [(0.3, 0.6), (0.5, 0.3), (0.7, 0.6)],
    "arc_down": [(0.3, 0.4), (0.5, 0.7), (0.7, 0.4)],
    "pause_then_move": [(0.5, 0.5), (0.5, 0.5), (0.7, 0.5)],
}

MAX_TRAJECTORIES = 16
MIN_POINTS_PER_TRAJECTORY = 2


def resolve_preset(preset: str) -> list[tuple[float, float]]:
    """Return trajectory coordinates for a named preset.

    Raises ``ValueError`` if the preset is unknown.
    """
    if preset not in TRAJECTORY_PRESETS:
        raise ValueError(
            f"Unknown trajectory preset '{preset}'. "
            f"Available: {sorted(TRAJECTORY_PRESETS)}"
        )
    return list(TRAJECTORY_PRESETS[preset])


def validate_trajectory(
    points: list,
    *,
    max_trajectories: int = MAX_TRAJECTORIES,
) -> list[list[tuple[float, float]]]:
    """Validate and normalise raw trajectory input.

    *points* may be:
    - A single trajectory: ``[[x, y], [x, y], ...]``
    - Multiple trajectories: ``[[[x, y], ...], [[x, y], ...]]``

    Returns a list of trajectories, each being a list of ``(x, y)`` tuples
    with coordinates clamped to 0.0-1.0.

    Raises ``ValueError`` on invalid input.
    """
    if not points:
        raise ValueError("trajectory_points must not be empty")

    # Detect single vs. multi trajectory
    first = points[0]
    if isinstance(first, (int, float)):
        raise ValueError("trajectory_points must be a list of [x,y] pairs, not scalars")

    # Single trajectory: [[x,y], [x,y]] — first element is a pair
    if isinstance(first, (list, tuple)) and len(first) == 2 and isinstance(first[0], (int, float)):
        trajectories_raw = [points]
    else:
        trajectories_raw = points

    if len(trajectories_raw) > max_trajectories:
        raise ValueError(
            f"Too many trajectories: {len(trajectories_raw)} (max {max_trajectories})"
        )

    result: list[list[tuple[float, float]]] = []
    for idx, traj in enumerate(trajectories_raw):
        if not isinstance(traj, (list, tuple)) or len(traj) < MIN_POINTS_PER_TRAJECTORY:
            raise ValueError(
                f"Trajectory {idx} must have at least {MIN_POINTS_PER_TRAJECTORY} points, got {len(traj) if isinstance(traj, (list, tuple)) else 'non-list'}"
            )
        parsed: list[tuple[float, float]] = []
        for pt_idx, pt in enumerate(traj):
            if not isinstance(pt, (list, tuple)) or len(pt) != 2:
                raise ValueError(f"Trajectory {idx}, point {pt_idx}: expected [x, y], got {pt!r}")
            x, y = float(pt[0]), float(pt[1])
            if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
                raise ValueError(
                    f"Trajectory {idx}, point {pt_idx}: coordinates ({x}, {y}) out of 0.0-1.0 range"
                )
            parsed.append((x, y))
        result.append(parsed)

    return result


def normalize_to_canvas(
    points: list[tuple[float, float]],
    canvas_size: int = 256,
) -> list[tuple[int, int]]:
    """Convert 0.0-1.0 normalised coordinates to integer canvas coordinates."""
    return [
        (int(round(x * (canvas_size - 1))), int(round(y * (canvas_size - 1))))
        for x, y in points
    ]


def interpolate_points(
    points: list[tuple[float, float]],
    num_frames: int,
) -> list[tuple[float, float]]:
    """Linearly interpolate (or downsample) trajectory to match *num_frames*.

    If the trajectory has fewer points than frames, intermediate positions
    are linearly interpolated.  If it has more, points are evenly sampled.
    """
    n = len(points)
    if n == num_frames:
        return list(points)

    if n < 2 or num_frames < 2:
        return [points[0]] * num_frames

    result: list[tuple[float, float]] = []
    for i in range(num_frames):
        t = i / (num_frames - 1)  # 0.0 … 1.0
        seg = t * (n - 1)
        lo = int(seg)
        hi = min(lo + 1, n - 1)
        frac = seg - lo
        x = points[lo][0] + (points[hi][0] - points[lo][0]) * frac
        y = points[lo][1] + (points[hi][1] - points[lo][1]) * frac
        result.append((round(x, 6), round(y, 6)))
    return result


def write_tora_point_file(
    trajectories: list[list[tuple[float, float]]],
    output_path: Path,
    num_frames: int,
    canvas_size: int = 256,
) -> list[Path]:
    """Write Tora-compatible trajectory point files (one text file per trajectory).

    The official Tora ``--point_path`` takes ``nargs="+"`` — a list of text file
    paths. Each file is parsed by ``read_points()`` as newline-separated
    ``x,y`` integer pairs in a 256x256 coordinate space (one point per frame).
    Returns the list of written file paths (to be expanded onto ``--point_path``).
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    stem = output_path.stem

    paths: list[Path] = []
    for idx, traj in enumerate(trajectories):
        interpolated = interpolate_points(traj, num_frames)
        canvas_pts = normalize_to_canvas(interpolated, canvas_size)
        traj_path = output_path.parent / f"{stem}_traj{idx}.txt"
        traj_path.write_text(
            "\n".join(f"{x},{y}" for x, y in canvas_pts) + "\n",
            encoding="utf-8",
        )
        paths.append(traj_path)

    return paths
