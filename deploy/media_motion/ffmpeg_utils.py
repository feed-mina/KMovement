from __future__ import annotations

import subprocess
from pathlib import Path


def run_ffmpeg(args: list[str], *, quiet: bool = True) -> None:
    """Run ffmpeg and raise a readable error on failure."""
    command = ["ffmpeg", "-y", *args]
    if quiet:
        command.extend(["-loglevel", "quiet"])

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = result.stderr[-2000:] if result.stderr else ""
        raise RuntimeError(f"ffmpeg failed with code {result.returncode}: {stderr}")


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
        "[2:a]volume=-18dB[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]",
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
        "[0:a]volume=-18dB[a0];[1:a]volume=-22dB[a1];[a0][a1]amix=inputs=2:duration=first[aout]",
        "-map",
        "[aout]",
        "-ar",
        "44100",
        "-ac",
        "2",
        str(output_wav),
    ])
    return output_wav

