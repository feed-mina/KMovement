from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def _find_ffmpeg() -> str:
    """Find ffmpeg binary: system PATH first, then imageio-ffmpeg bundle."""
    system = shutil.which("ffmpeg")
    if system:
        return system
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError):
        pass
    return "ffmpeg"


def run_ffmpeg(args: list[str], *, quiet: bool = True) -> None:
    """Run ffmpeg and raise a readable error on failure."""
    ffmpeg_bin = _find_ffmpeg()
    command = [ffmpeg_bin, "-y", *args]
    if quiet:
        # "error" (not "quiet") keeps the verbose banner suppressed while still
        # printing the actual failure to stderr, so a non-zero exit is diagnosable.
        command.extend(["-loglevel", "error"])

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = (result.stderr or "")[-2000:]
        stdout = (result.stdout or "")[-1000:]
        raise RuntimeError(
            f"ffmpeg failed with code {result.returncode}: {stderr}\n"
            f"cmd: {' '.join(command)}\nstdout: {stdout}"
        )


def ensure_parent(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def mp3_to_wav(mp3_path: Path, wav_path: Path) -> Path:
    """Convert gTTS MP3 output to 44.1kHz stereo WAV."""
    ensure_parent(wav_path)
    run_ffmpeg([
        "-i",
        str(mp3_path),
        "-ar",
        "44100",
        "-ac",
        "2",
        str(wav_path),
    ])
    return wav_path


def mix_video_tts_bgm(video_path: Path, tts_wav: Path, bgm_wav: Path, output_mp4: Path) -> Path:
    """Combine a video, one narration file, and looped BGM."""
    ensure_parent(output_mp4)
    run_ffmpeg([
        "-i",
        str(video_path),
        "-i",
        str(tts_wav),
        "-stream_loop",
        "-1",
        "-i",
        str(bgm_wav),
        "-filter_complex",
        # amix's `normalize` option only exists on ffmpeg >= 4.4; the Tora image
        # ships an older ffmpeg. Omit it and compensate for amix's built-in
        # /N attenuation with an explicit volume=2.0 (works on old and new alike).
        "[2:a]volume=-8dB[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=0,volume=2.0[aout]",
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        str(output_mp4),
    ])
    return output_mp4


def concat_videos(video_paths: list[Path], output_mp4: Path) -> Path:
    """Concatenate multiple videos sequentially using FFmpeg concat demuxer."""
    if len(video_paths) == 1:
        shutil.copy2(video_paths[0], ensure_parent(output_mp4))
        return output_mp4

    import tempfile

    concat_list = tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8",
    )
    try:
        for vp in video_paths:
            concat_list.write(f"file '{vp.resolve()}'\n")
        concat_list.close()

        ensure_parent(output_mp4)
        run_ffmpeg([
            "-f", "concat", "-safe", "0",
            "-i", concat_list.name,
            "-c", "copy",
            str(output_mp4),
        ])
    finally:
        Path(concat_list.name).unlink(missing_ok=True)

    return output_mp4


def overlay_gif_on_video(
    video: Path,
    gif: Path,
    output: Path,
    *,
    position: str = "10:10",
    scale: int | None = 200,
    scale_ratio: float | None = None,
    alpha: float = 1.0,
    speed: float = 1.0,
    remove_white_background: bool = False,
) -> Path:
    """Overlay an animated GIF on top of a video."""
    ensure_parent(output)

    if alpha <= 0.0 or alpha > 1.0:
        raise ValueError("alpha must be between 0.0 and 1.0")
    if speed <= 0.0:
        raise ValueError("speed must be greater than 0.0")
    if scale_ratio is not None and (scale_ratio <= 0.0 or scale_ratio > 1.0):
        raise ValueError("scale_ratio must be between 0.0 and 1.0")
    if scale_ratio is None and (scale is None or scale <= 0):
        raise ValueError("scale must be greater than 0")

    gif_filter: list[str] = []
    if speed != 1.0:
        gif_filter.append(f"setpts=PTS/{speed}")
    gif_filter.append("format=rgba")
    if remove_white_background:
        gif_filter.append("colorkey=0xFFFFFF:0.12:0.06")
    if alpha != 1.0:
        gif_filter.append(f"colorchannelmixer=aa={alpha}")

    gif_filter_expr = ",".join(gif_filter)
    if scale_ratio is not None:
        filter_complex = (
            f"[1:v]{gif_filter_expr}[gif];"
            f"[gif][0:v]scale2ref=w=main_w*{scale_ratio}:h=-1[ovr][base];"
            f"[base][ovr]overlay={position}:shortest=1"
        )
    else:
        filter_complex = (
            f"[1:v]{gif_filter_expr},scale={scale}:-1[ovr];"
            f"[0:v][ovr]overlay={position}:shortest=1"
        )

    run_ffmpeg([
        "-i", str(video),
        "-ignore_loop", "0", "-i", str(gif),
        "-filter_complex",
        filter_complex,
        "-c:a", "copy",
        str(output),
    ])
    return output


def mix_video_tts(video: Path, tts_wav: Path, output: Path) -> Path:
    """Combine a video with TTS audio only (no BGM)."""
    ensure_parent(output)
    run_ffmpeg([
        "-i", str(video),
        "-i", str(tts_wav),
        "-map", "0:v",
        "-map", "1:a",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        str(output),
    ])
    return output


def apply_bgm_to_video(video: Path, bgm_wav: Path, output: Path) -> Path:
    """Apply looped BGM to a video that already has audio (TTS)."""
    ensure_parent(output)
    run_ffmpeg([
        "-i", str(video),
        "-stream_loop", "-1",
        "-i", str(bgm_wav),
        "-filter_complex",
        # See mix_video_tts_bgm: avoid amix `normalize` (ffmpeg >= 4.4 only).
        "[1:a]volume=-8dB[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=0,volume=2.0[aout]",
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        str(output),
    ])
    return output


def make_sine_bgm(output_wav: Path, *, frequency_a: str, frequency_b: str, duration: int = 45) -> Path:
    """Create a deterministic fallback BGM from two quiet sine tones."""
    ensure_parent(output_wav)
    run_ffmpeg([
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency={frequency_a}:duration={duration}",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency={frequency_b}:duration={duration}",
        "-filter_complex",
        "[0:a]volume=-10dB[a0];[1:a]volume=-14dB[a1];[a0][a1]amix=inputs=2:duration=first[aout]",
        "-map",
        "[aout]",
        "-ar",
        "44100",
        "-ac",
        "2",
        str(output_wav),
    ])
    return output_wav

