from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from .external_command import run_external_command
from .schemas import Artifact, GenerationResult
from .tts import synthesize_gtts
from .worker_config import WorkerConfig, load_worker_config


def synthesize_gpt_sovits(
    text: str,
    output_wav: Path,
    *,
    cfg: WorkerConfig | None = None,
) -> tuple[Path, dict[str, object]]:
    """Run GPT-SoVITS through an isolated subprocess entrypoint."""
    cfg = cfg or load_worker_config()
    output_wav.parent.mkdir(parents=True, exist_ok=True)

    if not cfg.gpt_sovits_dir:
        raise RuntimeError("KRIDE_GPT_SOVITS_DIR is required for GPT-SoVITS production TTS.")

    entry = Path(__file__).with_name("gpt_sovits_infer_entry.py")
    python_exe = cfg.gpt_sovits_python or sys.executable
    command = [
        python_exe,
        str(entry),
        "--gpt-dir",
        str(cfg.gpt_sovits_dir),
        "--text",
        text,
        "--output",
        str(output_wav),
        "--prompt-text",
        cfg.gpt_sovits_prompt_text,
        "--gpt-weights",
        cfg.gpt_sovits_gpt_weights,
        "--sovits-weights",
        cfg.gpt_sovits_sovits_weights,
    ]
    if cfg.gpt_sovits_ref_wav is not None:
        command.extend(["--ref-wav", str(cfg.gpt_sovits_ref_wav)])

    command_result = run_external_command(
        command,
        cwd=cfg.gpt_sovits_dir,
        timeout_seconds=cfg.timeout_seconds,
    )
    log_path = output_wav.with_suffix(".gpt_sovits_command.json")
    log_path.write_text(
        json.dumps(
            {
                "command": command_result.command,
                "return_code": command_result.return_code,
                "stdout_tail": command_result.stdout_tail,
                "stderr_tail": command_result.stderr_tail,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    if command_result.return_code != 0 or not output_wav.exists():
        raise RuntimeError(command_result.stderr_tail or command_result.stdout_tail)

    return output_wav, {"command_log": str(log_path), "actual_model_executed": True}


def run_gpt_sovits_tts_case(
    *,
    case_id: str,
    text: str,
    output_root: Path,
    cfg: WorkerConfig | None = None,
) -> GenerationResult:
    """Produce a production TTS artifact with GPT-SoVITS, falling back to gTTS if configured."""
    cfg = cfg or load_worker_config()
    branch_dir = output_root / "gpt_sovits_tts"
    tts_dir = branch_dir / "tts"
    meta_dir = branch_dir / "metadata"
    output_wav = tts_dir / f"{case_id}.wav"

    try:
        wav_path, metadata = synthesize_gpt_sovits(text, output_wav, cfg=cfg)
        status = "success"
    except Exception as exc:
        if not cfg.allow_fallback:
            raise
        wav_path = synthesize_gtts(text, output_wav)
        metadata = {
            "actual_model_executed": False,
            "fallback_type": "gtts",
            "real_model_error": str(exc)[:2000],
        }
        status = "fallback_used"

    meta_dir.mkdir(parents=True, exist_ok=True)
    meta_path = meta_dir / f"{case_id}_gpt_sovits_tts.json"
    metadata = {
        **metadata,
        "route": "gpt_sovits_tts",
        "case_id": case_id,
        "status": status,
    }
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    copied_meta = meta_path
    if status == "success":
        command_log = Path(str(metadata.get("command_log", "")))
        if command_log.exists():
            copied_meta = command_log

    return GenerationResult(
        route="gpt_sovits_tts",
        status=status,
        case_id=case_id,
        artifacts=[
            Artifact.from_path("tts", wav_path),
            Artifact.from_path("metadata", meta_path),
            Artifact.from_path("command_log", copied_meta, note="Subprocess command log" if copied_meta != meta_path else ""),
        ],
        metadata=metadata,
        error="" if status == "success" else str(metadata.get("real_model_error", "")),
    )


def copy_gpt_sovits_artifact(source_wav: Path, output_wav: Path) -> Path:
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_wav, output_wav)
    return output_wav
