from __future__ import annotations

import json
import os
import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class CommandResult:
    command: list[str]
    return_code: int
    stdout_tail: str
    stderr_tail: str


def _format_value(value: Any) -> str:
    return str(value)


def command_from_template(template: str, values: dict[str, Any]) -> list[str]:
    rendered = template.format(**{key: _format_value(value) for key, value in values.items()})
    return shlex.split(rendered, posix=os.name != "nt")


def command_from_json_template(template_json: str, values: dict[str, Any]) -> list[str]:
    raw = json.loads(template_json)
    if not isinstance(raw, list) or not all(isinstance(item, str) for item in raw):
        raise ValueError("command JSON template must be a JSON string list")
    return [item.format(**{key: _format_value(value) for key, value in values.items()}) for item in raw]


def run_external_command(
    command: list[str],
    *,
    cwd: Path | None = None,
    timeout_seconds: int = 1800,
    extra_env: dict[str, str] | None = None,
) -> CommandResult:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)

    result = subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    return CommandResult(
        command=command,
        return_code=result.returncode,
        stdout_tail=(result.stdout or "")[-4000:],
        stderr_tail=(result.stderr or "")[-4000:],
    )
