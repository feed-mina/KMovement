from __future__ import annotations

import argparse
import os
from pathlib import Path

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Log the K-Ride cloud gateway deployment to DagsHub/MLflow.")
    parser.add_argument("--public-url", default=os.environ.get("KRIDE_PUBLIC_URL", ""))
    parser.add_argument("--local-url", default=os.environ.get("KRIDE_LOCAL_URL", "http://127.0.0.1:7860"))
    parser.add_argument("--repo-owner", default=os.environ.get("DAGSHUB_USERNAME", "myelin24m"))
    parser.add_argument("--repo-name", default=os.environ.get("DAGSHUB_REPO", "Kride"))
    parser.add_argument("--experiment", default="track-b-cloud-preview-gateway")
    parser.add_argument("--run-name", default="cloud-ready-fastapi-preview-gateway")
    parser.add_argument("--manifest-out", default=os.environ.get("KRIDE_MANIFEST_OUT", "gateway_manifest.json"))
    return parser.parse_args()


def endpoint(base_url: str, path: str) -> str:
    return base_url.rstrip("/") + path


def main() -> None:
    # STEP 1. Read CLI/env configuration.
    args = parse_args()
    base_url = args.public_url or args.local_url
    manifest_url = endpoint(base_url, "/manifest.json")
    health_url = endpoint(base_url, "/health")

    # STEP 2. Verify gateway before logging.
    health = requests.get(health_url, timeout=30).json()
    manifest = requests.get(manifest_url, timeout=30).json()

    manifest_path = Path(args.manifest_out).resolve()
    manifest_path.write_text(__import__("json").dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # STEP 3. Import MLflow only in the logging process to avoid runtime package conflicts.
    import dagshub
    import mlflow

    dagshub.init(repo_owner=args.repo_owner, repo_name=args.repo_name, mlflow=True)
    mlflow.set_experiment(args.experiment)

    if mlflow.active_run():
        mlflow.end_run()

    # STEP 4. Log deployment metadata.
    with mlflow.start_run(run_name=args.run_name) as run:
        mlflow.log_param("stage", "cloud_preview_gateway")
        mlflow.log_param("public_url", args.public_url)
        mlflow.log_param("local_url", args.local_url)
        mlflow.log_param("base_url", base_url)
        mlflow.log_param("model_generation_enabled", manifest.get("model_generation_enabled", False))
        mlflow.log_param("media_dir", manifest.get("media_dir", ""))
        mlflow.log_metric("asset_count", manifest.get("asset_count", 0))

        for group, count in health.get("counts", {}).items():
            mlflow.log_metric(f"asset_count_{group}", count)

        mlflow.log_artifact(str(manifest_path), artifact_path="gateway")

        print("Logged cloud gateway deployment.")
        print("Run ID:", run.info.run_id)
        print("MLflow URI:", mlflow.get_tracking_uri())


if __name__ == "__main__":
    main()

