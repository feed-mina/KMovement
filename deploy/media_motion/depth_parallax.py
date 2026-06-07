"""
Depth-based 3D parallax video from a single image.

Fallback chain: MoGe → MiDaS DPT-Large → caller falls back to zoompan.

Core formula (from report/3D inpainting.txt):
  Pixel_t = π(K, C_t⁻¹ · π⁻¹(K, Pixel_0, D))

Where:
  π⁻¹  = 2D→3D un-projection using depth D and intrinsics K
  C_t   = 4×4 camera pose (RT) at frame t
  π     = 3D→2D re-projection
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np

from .worker_config import WorkerConfig, load_worker_config


# ── Motion → camera translation direction mapping ───────────────────────────

_MOTION_MAP = {
    "slow_zoom_in": "dolly_in",
    "slow_zoom_out": "dolly_out",
    "left_to_right_pan": "pan_right",
    "right_to_left_pan": "pan_left",
    "gentle_dolly": "gentle_dolly",
}


# ── Depth estimation ────────────────────────────────────────────────────────

def estimate_depth(image_path: Path, cfg: WorkerConfig | None = None) -> np.ndarray:
    """Estimate per-pixel depth. MoGe first, MiDaS DPT-Large fallback."""
    import torch
    from PIL import Image

    cfg = cfg or load_worker_config()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    image = Image.open(image_path).convert("RGB")

    # 1. MoGe
    try:
        from moge.model import MoGeModel

        model = MoGeModel.from_pretrained("Ruicheng/moge-vitl").to(device).eval()
        input_tensor = torch.from_numpy(
            np.array(image.resize((512, 512))).transpose(2, 0, 1)
        ).unsqueeze(0).float().to(device) / 255.0
        with torch.no_grad():
            output = model.infer(input_tensor)
        depth = output["depth"].squeeze().cpu().numpy()
        # Resize depth to original image size
        from PIL import Image as _Img
        depth_img = _Img.fromarray(depth)
        depth_img = depth_img.resize(image.size, _Img.BILINEAR)
        depth = np.array(depth_img, dtype=np.float32)
        del model
        torch.cuda.empty_cache()
        print("[depth_parallax] MoGe depth estimation succeeded")
        return depth
    except Exception as exc:
        print(f"[depth_parallax] MoGe unavailable ({exc}), trying MiDaS DPT-Large")

    # 2. MiDaS DPT-Large (via transformers)
    from transformers import DPTForDepthEstimation, DPTImageProcessor

    processor = DPTImageProcessor.from_pretrained(cfg.depth_model_id)
    model = DPTForDepthEstimation.from_pretrained(cfg.depth_model_id).to(device)
    inputs = processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)
    depth = outputs.predicted_depth.squeeze().cpu().numpy()

    # Resize to original image dimensions
    h, w = np.array(image).shape[:2]
    from PIL import Image as _Img
    depth_img = _Img.fromarray(depth)
    depth_img = depth_img.resize((w, h), _Img.BILINEAR)
    depth = np.array(depth_img, dtype=np.float32)

    del model, processor
    torch.cuda.empty_cache()
    print("[depth_parallax] MiDaS DPT-Large depth estimation succeeded")
    return depth


# ── RT matrix sequence generation ───────────────────────────────────────────

def _generate_rt_sequence(
    motion: str,
    num_frames: int,
    intensity: float = 0.03,
) -> list[np.ndarray]:
    """Generate a list of 4×4 camera pose matrices for each frame."""
    cam_motion = _MOTION_MAP.get(motion, "dolly_in")
    rt_sequence: list[np.ndarray] = []

    for t in range(num_frames):
        frac = t / max(num_frames - 1, 1)
        C_t = np.eye(4)

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


# ── 3D projection rendering ────────────────────────────────────────────────

def render_parallax_video(
    image_path: Path,
    depth_map: np.ndarray,
    output_mp4: Path,
    motion: str = "slow_zoom_in",
    duration: int = 7,
    fps: int = 8,
) -> Path:
    """Render depth-parallax Ken Burns video using 3D re-projection.

    π⁻¹(K, Pixel_0, D) → C_t⁻¹ transform → π(K, ...) → cv2.remap per frame.
    Occlusion masking via depth gradient thresholding + cv2.inpaint for holes.
    """
    import cv2

    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h, w = image.shape[:2]
    num_frames = duration * fps

    # Camera intrinsics K (simple pinhole)
    fx = fy = float(w)
    cx, cy = w / 2.0, h / 2.0

    # Normalise depth to a usable range (avoid extreme values)
    d = depth_map.astype(np.float64)
    d_min, d_max = d.min(), d.max()
    if d_max - d_min > 1e-6:
        d = 1.0 + 4.0 * (d - d_min) / (d_max - d_min)  # range [1, 5]
    else:
        d = np.full_like(d, 3.0)

    # Pre-compute pixel grid
    x_grid, y_grid = np.meshgrid(np.arange(w, dtype=np.float64),
                                  np.arange(h, dtype=np.float64))

    # Un-project to 3D: π⁻¹(K, Pixel_0, D)
    x_3d = (x_grid - cx) * d / fx
    y_3d = (y_grid - cy) * d / fy
    z_3d = d
    ones = np.ones_like(z_3d)
    points_3d = np.stack((x_3d, y_3d, z_3d, ones), axis=-1)  # [H, W, 4]

    # Occlusion mask from depth gradient
    grad_x = np.abs(np.gradient(d, axis=1))
    grad_y = np.abs(np.gradient(d, axis=0))
    depth_gradient = grad_x + grad_y
    grad_threshold = np.percentile(depth_gradient, 95)

    # Generate RT sequence
    rt_sequence = _generate_rt_sequence(motion, num_frames, intensity=0.03)

    # Render frames
    from .ffmpeg_utils import _find_ffmpeg

    frame_dir = output_mp4.parent / f"_frames_{output_mp4.stem}"
    frame_dir.mkdir(parents=True, exist_ok=True)

    for t, C_t in enumerate(rt_sequence):
        C_t_inv = np.linalg.inv(C_t)

        # Transform 3D points: C_t⁻¹ · points_3d
        transformed = points_3d @ C_t_inv.T  # [H, W, 4]

        z_new = transformed[..., 2].copy()
        z_new[z_new < 1e-5] = 1e-5

        # Re-project: π(K, ...)
        map_x = (transformed[..., 0] * fx / z_new + cx).astype(np.float32)
        map_y = (transformed[..., 1] * fy / z_new + cy).astype(np.float32)

        # Remap pixels
        frame = cv2.remap(image, map_x, map_y, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT_101)

        # Mark occlusion holes (where depth gradient was steep)
        invalid = (depth_gradient > grad_threshold).astype(np.uint8)
        # Also mark out-of-bounds pixels
        oob = ((map_x < 0) | (map_x >= w) | (map_y < 0) | (map_y >= h)).astype(np.uint8)
        mask = np.clip(invalid + oob, 0, 1).astype(np.uint8)

        if mask.any():
            frame = cv2.inpaint(frame, mask, 3, cv2.INPAINT_TELEA)

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
) -> Path:
    """Unified entry: depth estimation → parallax rendering."""
    cfg = cfg or load_worker_config()
    depth = estimate_depth(image_path, cfg)
    return render_parallax_video(image_path, depth, output_mp4, motion, duration, fps)
