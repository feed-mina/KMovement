"""
Depth-based 3D parallax video from a single image.

Fallback chain: MoGe-2 → MiDaS DPT-Large → caller falls back to zoompan.

Core formula (from report/3D inpainting.txt):
  Pixel_t = π(K, C_t⁻¹ · π⁻¹(K, Pixel_0, D))

Rendering uses **inverse** warping: for each destination pixel we compute
where it came from in the source image, which is what cv2.remap expects.

Occlusion is detected via forward-splatting Z-buffer: pixels whose source
3D point is occluded by a closer point in the new view are masked and
inpainted.
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .worker_config import WorkerConfig, load_worker_config


# ── Structured depth result ─────────────────────────────────────────────────

@dataclass
class DepthResult:
    """Structured output from depth estimation."""
    depth: np.ndarray          # (H, W) depth map
    mask: np.ndarray           # (H, W) bool — valid pixels
    intrinsics: np.ndarray     # (3, 3) camera intrinsics (or None → use default)
    backend: str               # "moge" or "midas"


# ── Motion config ───────────────────────────────────────────────────────────

_MOTION_MAP = {
    "slow_zoom_in": "dolly_in",
    "slow_zoom_out": "dolly_out",
    "left_to_right_pan": "pan_right",
    "right_to_left_pan": "pan_left",
    "gentle_dolly": "gentle_dolly",
}

# Per-motion maximum intensity to prevent mesh tearing
_INTENSITY_LIMITS = {
    "dolly_in": 0.06,
    "dolly_out": 0.06,
    "pan_right": 0.04,
    "pan_left": 0.04,
    "gentle_dolly": 0.05,
}

_VALID_MOTIONS = set(_MOTION_MAP.keys())


def _validate_motion(motion: str) -> str:
    """Validate motion string; raise ValueError for unknown motions."""
    if motion not in _VALID_MOTIONS:
        raise ValueError(
            f"Unknown motion '{motion}'. Must be one of: {sorted(_VALID_MOTIONS)}"
        )
    return _MOTION_MAP[motion]


# ── Depth estimation ────────────────────────────────────────────────────────

def estimate_depth(
    image_path: Path,
    cfg: WorkerConfig | None = None,
    *,
    _model_cache: dict | None = None,
) -> DepthResult:
    """Estimate per-pixel depth.  MoGe-2 first, MiDaS DPT-Large fallback.

    Returns a DepthResult with depth, validity mask, intrinsics, and backend name.
    When *_model_cache* is provided (dict), the model is stored for batch reuse.
    """
    import torch
    from PIL import Image

    cfg = cfg or load_worker_config()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    image = Image.open(image_path).convert("RGB")
    w_orig, h_orig = image.size

    # 1. MoGe-2 (official API: moge.model.v2)
    try:
        from moge.model.v2 import MoGeModel

        model_id = cfg.moge_model_id
        if _model_cache is not None and "moge" in _model_cache:
            model = _model_cache["moge"]
        else:
            model = MoGeModel.from_pretrained(model_id).to(device).eval()
            if _model_cache is not None:
                _model_cache["moge"] = model

        # MoGe expects (3, H, W) float tensor in [0, 1]
        input_tensor = (
            torch.from_numpy(np.array(image).transpose(2, 0, 1))
            .float()
            .to(device) / 255.0
        )
        with torch.no_grad():
            output = model.infer(input_tensor)

        depth = output["depth"].cpu().numpy().astype(np.float32)   # (H, W)
        mask = output["mask"].cpu().numpy().astype(bool)            # (H, W)
        intrinsics = output["intrinsics"].cpu().numpy()             # (3, 3)

        # MoGe returns normalized intrinsics — scale to pixel coords
        K = intrinsics.copy().astype(np.float64)
        K[0, :] *= w_orig
        K[1, :] *= h_orig

        if _model_cache is None:
            del model
            torch.cuda.empty_cache()

        print(f"[depth_parallax] MoGe-2 depth estimation succeeded ({model_id})")
        return DepthResult(depth=depth, mask=mask, intrinsics=K, backend="moge")

    except Exception as exc:
        print(f"[depth_parallax] MoGe-2 unavailable ({exc}), trying MiDaS DPT-Large")

    # 2. MiDaS DPT-Large (via transformers)
    from transformers import DPTForDepthEstimation, DPTImageProcessor

    processor = DPTImageProcessor.from_pretrained(cfg.depth_model_id)
    model = DPTForDepthEstimation.from_pretrained(cfg.depth_model_id).to(device)
    inputs = processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)
    raw_depth = outputs.predicted_depth.squeeze().cpu().numpy()

    # Resize to original image dimensions
    import torch.nn.functional as F
    depth_tensor = torch.from_numpy(raw_depth).unsqueeze(0).unsqueeze(0)
    depth_resized = F.interpolate(
        depth_tensor, size=(h_orig, w_orig), mode="bilinear", align_corners=False,
    )
    depth = depth_resized.squeeze().numpy().astype(np.float32)

    # MiDaS has no mask/intrinsics — use defaults
    mask = np.ones((h_orig, w_orig), dtype=bool)
    K = np.array([
        [float(w_orig), 0.0, w_orig / 2.0],
        [0.0, float(w_orig), h_orig / 2.0],
        [0.0, 0.0, 1.0],
    ])

    del model, processor
    torch.cuda.empty_cache()
    print("[depth_parallax] MiDaS DPT-Large depth estimation succeeded")
    return DepthResult(depth=depth, mask=mask, intrinsics=K, backend="midas")


# ── RT matrix sequence generation ───────────────────────────────────────────

def _generate_rt_sequence(
    motion: str,
    num_frames: int,
    intensity: float = 0.03,
) -> list[np.ndarray]:
    """Generate a list of 4×4 camera pose matrices for each frame."""
    cam_motion = _validate_motion(motion)

    # Clamp intensity to safe limit
    limit = _INTENSITY_LIMITS.get(cam_motion, 0.05)
    intensity = min(intensity, limit)

    rt_sequence: list[np.ndarray] = []

    for t in range(num_frames):
        frac = t / max(num_frames - 1, 1)
        C_t = np.eye(4, dtype=np.float64)

        if cam_motion == "dolly_in":
            C_t[2, 3] = intensity * frac
        elif cam_motion == "dolly_out":
            C_t[2, 3] = -intensity * frac
        elif cam_motion == "pan_right":
            C_t[0, 3] = intensity * frac
        elif cam_motion == "pan_left":
            C_t[0, 3] = -intensity * frac
        elif cam_motion == "gentle_dolly":
            C_t[2, 3] = intensity * np.sin(frac * np.pi)

        rt_sequence.append(C_t)

    return rt_sequence


# ── Forward-splatting Z-buffer for occlusion detection ──────────────────────

def _forward_splat_zbuffer(
    map_x_fwd: np.ndarray,
    map_y_fwd: np.ndarray,
    z_new: np.ndarray,
    h: int,
    w: int,
) -> np.ndarray:
    """Build a Z-buffer via forward splatting to find occluded pixels.

    For each source pixel (y, x), its forward-projected destination is
    (map_y_fwd[y,x], map_x_fwd[y,x]) with depth z_new[y,x].
    The closest (smallest z) wins at each destination cell.

    Returns a bool mask (H, W) where True = this destination pixel is visible
    (i.e., its inverse-looked-up source is the closest contributor).
    """
    zbuf = np.full((h, w), np.inf, dtype=np.float64)
    src_index = np.full((h, w), -1, dtype=np.int64)

    # Flatten for vectorized scatter
    dst_x = np.round(map_x_fwd).astype(np.int64).ravel()
    dst_y = np.round(map_y_fwd).astype(np.int64).ravel()
    z_flat = z_new.ravel()
    idx_flat = np.arange(h * w)

    valid = (dst_x >= 0) & (dst_x < w) & (dst_y >= 0) & (dst_y < h) & (z_flat > 0)
    dst_x = dst_x[valid]
    dst_y = dst_y[valid]
    z_val = z_flat[valid]
    idx_val = idx_flat[valid]

    # Sort by depth (closest first) so the last write at each cell is closest
    order = np.argsort(-z_val)  # descending → later overwrites win = closest
    dst_x = dst_x[order]
    dst_y = dst_y[order]
    z_val = z_val[order]
    idx_val = idx_val[order]

    # Scatter — numpy fancy indexing: last write wins
    zbuf[dst_y, dst_x] = z_val
    src_index[dst_y, dst_x] = idx_val

    return zbuf, src_index


# ── 3D projection rendering (inverse warp) ─────────────────────────────────

def render_parallax_video(
    image_path: Path,
    dr: DepthResult,
    output_mp4: Path,
    motion: str = "slow_zoom_in",
    duration: int = 7,
    fps: int = 8,
    intensity: float = 0.03,
) -> Path:
    """Render depth-parallax Ken Burns video using inverse warping.

    For each destination pixel in frame t, we compute where it came from
    in the source image (inverse warp), which is what cv2.remap expects.

    Occlusion detection: forward-splat source pixels to build a Z-buffer,
    then mask destination pixels whose looked-up source is NOT the closest
    contributor.  Only actual disoccluded holes are inpainted.
    """
    import cv2

    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h, w = image.shape[:2]
    num_frames = duration * fps

    # Camera intrinsics from depth estimation
    K = dr.intrinsics.astype(np.float64)
    fx, fy = K[0, 0], K[1, 1]
    cx, cy = K[0, 2], K[1, 2]

    # Normalise depth to usable range [1, 5]
    d = dr.depth.astype(np.float64)
    valid_d = d[dr.mask] if dr.mask.any() else d.ravel()
    d_min, d_max = valid_d.min(), valid_d.max()
    if d_max - d_min > 1e-6:
        d = 1.0 + 4.0 * (d - d_min) / (d_max - d_min)
    else:
        d = np.full_like(d, 3.0)

    # Zero out invalid pixels (from MoGe mask)
    d[~dr.mask] = 0.0

    # Pre-compute pixel grid
    x_grid, y_grid = np.meshgrid(
        np.arange(w, dtype=np.float64),
        np.arange(h, dtype=np.float64),
    )

    # Un-project to 3D (source frame): π⁻¹(K, Pixel_0, D)
    x_3d = (x_grid - cx) * d / fx
    y_3d = (y_grid - cy) * d / fy
    z_3d = d
    ones = np.ones_like(z_3d)
    points_3d = np.stack((x_3d, y_3d, z_3d, ones), axis=-1)  # [H, W, 4]

    # Generate RT sequence
    rt_sequence = _generate_rt_sequence(motion, num_frames, intensity)

    # Render frames
    from .ffmpeg_utils import _find_ffmpeg

    frame_dir = output_mp4.parent / f"_frames_{output_mp4.stem}"
    frame_dir.mkdir(parents=True, exist_ok=True)

    for t, C_t in enumerate(rt_sequence):
        # ── Forward warp (source→dest) for Z-buffer ──
        C_t_inv = np.linalg.inv(C_t)
        fwd = points_3d @ C_t_inv.T  # [H, W, 4]
        z_fwd = fwd[..., 2].copy()
        z_fwd[z_fwd < 1e-5] = 1e-5
        fwd_x = (fwd[..., 0] * fx / z_fwd + cx)
        fwd_y = (fwd[..., 1] * fy / z_fwd + cy)

        zbuf, src_idx = _forward_splat_zbuffer(fwd_x, fwd_y, z_fwd, h, w)

        # ── Inverse warp (dest→source) for cv2.remap ──
        # For destination pixel (x', y'), find which source pixel maps there.
        # Inverse of C_t⁻¹ is C_t itself.
        # Dest 3D = un-project dest pixel with dest depth from zbuf,
        # then transform by C_t to get source 3D, then project to source 2D.
        #
        # But zbuf gives us the source index directly — use that for the
        # remap. Where src_idx == -1, the pixel is a disoccluded hole.
        hole_mask = (src_idx < 0).astype(np.uint8)

        # Build remap from source indices
        src_y_flat = np.zeros(h * w, dtype=np.float32)
        src_x_flat = np.zeros(h * w, dtype=np.float32)

        flat_idx = src_idx.ravel()
        valid = flat_idx >= 0

        # Source pixel coords from flat index
        src_y_flat[valid] = (flat_idx[valid] // w).astype(np.float32)
        src_x_flat[valid] = (flat_idx[valid] % w).astype(np.float32)

        map_x = src_x_flat.reshape(h, w)
        map_y = src_y_flat.reshape(h, w)

        # For holes, set to -1 (will be border-filled then inpainted)
        map_x[hole_mask == 1] = -1.0
        map_y[hole_mask == 1] = -1.0

        # Remap: destination→source (correct direction for cv2.remap)
        frame = cv2.remap(
            image, map_x, map_y, cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE,
        )

        # Also mark invalid mask pixels
        invalid_mask = hole_mask.copy()
        if not dr.mask.all():
            # Pixels from invalid depth regions
            src_invalid = np.zeros(h * w, dtype=np.uint8)
            mask_flat = dr.mask.ravel()
            src_invalid[valid] = (~mask_flat[flat_idx[valid].astype(int)]).astype(np.uint8)
            invalid_mask = np.clip(
                invalid_mask + src_invalid.reshape(h, w), 0, 1
            ).astype(np.uint8)

        # Inpaint only actual holes (disoccluded + invalid depth)
        if invalid_mask.any():
            frame = cv2.inpaint(frame, invalid_mask, 5, cv2.INPAINT_TELEA)

        frame_path = frame_dir / f"frame_{t:04d}.png"
        cv2.imwrite(str(frame_path), frame)

    # Encode to MP4 via ffmpeg
    ffmpeg = _find_ffmpeg()
    cmd = [
        ffmpeg, "-y",
        "-framerate", str(fps),
        "-i", str(frame_dir / "frame_%04d.png"),
        "-vf", "format=yuv420p",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        str(output_mp4),
        "-loglevel", "quiet",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg frame encode failed: {result.stderr[-2000:]}")

    # Clean up frame PNGs
    import shutil
    shutil.rmtree(frame_dir, ignore_errors=True)

    return output_mp4


# ── Public entry point ──────────────────────────────────────────────────────

def create_depth_parallax_video(
    image_path: Path,
    output_mp4: Path,
    motion: str = "slow_zoom_in",
    cfg: WorkerConfig | None = None,
    duration: int = 7,
    fps: int = 8,
    intensity: float = 0.03,
    _model_cache: dict | None = None,
) -> Path:
    """Unified entry: depth estimation → parallax rendering.

    Pass *_model_cache* (a dict) to reuse the depth model across batch calls.
    """
    cfg = cfg or load_worker_config()
    dr = estimate_depth(image_path, cfg, _model_cache=_model_cache)
    return render_parallax_video(
        image_path, dr, output_mp4, motion, duration, fps, intensity,
    )
