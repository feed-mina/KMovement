from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Log a media-motion worker result JSON to MLflow/DagsHub.")
    parser.add_argument("--result-json", required=True)
    parser.add_argument("--repo-owner", default=os.environ.get("DAGSHUB_REPO_OWNER", "myelin24m"))
    parser.add_argument("--repo-name", default=os.environ.get("DAGSHUB_REPO_NAME", "Kride"))
    parser.add_argument("--experiment", default="track-b-media-motion-workers")
    parser.add_argument("--run-name", default="")
    return parser.parse_args()


def _artifact_paths(result: dict[str, Any]) -> list[Path]:
    paths: list[Path] = []
    for artifact in result.get("artifacts", []):
        path = Path(str(artifact.get("path", "")))
        if path.exists() and path.is_file():
            paths.append(path)
    return paths


def main() -> None:
    # STEP 1. Import MLflow only in this logging process. This avoids mixing
    # MLflow/numpy/pandas dependencies into fragile GPU model runtimes.
    import mlflow

    args = parse_args()
    result_path = Path(args.result_json).resolve()
    result = json.loads(result_path.read_text(encoding="utf-8"))

    tracking_uri = os.environ.get(
        "MLFLOW_TRACKING_URI",
        f"https://dagshub.com/{args.repo_owner}/{args.repo_name}.mlflow",
    )
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(args.experiment)

    run_name = args.run_name or f"{result.get('route', 'media-motion')}-{result.get('case_id', 'case')}"

    with mlflow.start_run(run_name=run_name) as run:
        # STEP 2. Log routing and status metadata.
        mlflow.log_param("route", result.get("route", ""))
        mlflow.log_param("case_id", result.get("case_id", ""))
        mlflow.log_param("status", result.get("status", ""))
        mlflow.log_param("error", str(result.get("error", ""))[:500])

        metadata = result.get("metadata", {})
        for key in [
            "actual_model_executed",
            "model_id",
            "model_attempted",
            "fallback_type",
            "fallback_reason",
            "real_model_attempted",
        ]:
            if key in metadata:
                mlflow.log_param(key, str(metadata[key])[:500])

        # STEP 3. Log result JSON and every generated artifact that exists.
        mlflow.log_artifact(str(result_path), artifact_path="result")
        artifacts = _artifact_paths(result)
        mlflow.log_metric("artifact_count", len(artifacts))
        for path in artifacts:
            mlflow.log_artifact(str(path), artifact_path="artifacts")

        print("MLflow URI:", mlflow.get_tracking_uri())
        print("Run ID:", run.info.run_id)


if __name__ == "__main__":
    main()
