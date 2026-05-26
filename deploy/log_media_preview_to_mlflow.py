from __future__ import annotations

import argparse
import os
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Log the K-Ride static media deployment to MLflow/DagsHub.")
    parser.add_argument("--media-dir", default=os.environ.get("KRIDE_MEDIA_DIR", "report"))
    parser.add_argument("--public-url", default=os.environ.get("KRIDE_PUBLIC_URL", ""))
    parser.add_argument("--local-url", default=os.environ.get("KRIDE_LOCAL_URL", "http://127.0.0.1:7860"))
    parser.add_argument("--repo-owner", default=os.environ.get("DAGSHUB_USERNAME", "myelin24m"))
    parser.add_argument("--repo-name", default=os.environ.get("DAGSHUB_REPO", "Kride.mlflow"))
    parser.add_argument("--experiment", default="kride-static-media-deployment")
    parser.add_argument("--run-name", default="model-less-static-media-preview")
    return parser.parse_args()


def maybe_log_artifact(mlflow, path: Path, artifact_path: str) -> None:
    if path.exists():
        mlflow.log_artifact(str(path), artifact_path=artifact_path)


def main() -> None:
    args = parse_args()
    media_dir = Path(args.media_dir).resolve()

    import dagshub
    import mlflow

    dagshub.init(repo_owner=args.repo_owner, repo_name=args.repo_name, mlflow=True)
    mlflow.set_experiment(args.experiment)

    if mlflow.active_run():
        mlflow.end_run()

    assets = {
        "animation": media_dir / "meta_combined_6.mp4",
        "animation_bgm": media_dir / "meta_combined_6_Musicgen.mp4",
        "full": media_dir / "meta_combined_6_Musicgen_tts_success.mp4",
        "notebook": media_dir / "finally-deploy-yerin.ipynb",
    }
    tts_assets = [media_dir / f"tts_torchaudito_{i}.wav" for i in range(1, 6)]

    with mlflow.start_run(run_name=args.run_name) as run:
        mlflow.log_param("mode", "static-demo")
        mlflow.log_param("modeling_enabled", False)
        mlflow.log_param("media_dir", str(media_dir))
        mlflow.log_param("local_url", args.local_url)
        if args.public_url:
            mlflow.log_param("public_url", args.public_url)

        for key, path in assets.items():
            exists = path.exists()
            mlflow.log_param(f"{key}_path", str(path))
            mlflow.log_metric(f"{key}_exists", 1 if exists else 0)
            if exists:
                mlflow.log_metric(f"{key}_size_mb", path.stat().st_size / 1024 / 1024)

        for index, path in enumerate(tts_assets, 1):
            exists = path.exists()
            mlflow.log_metric(f"tts_{index}_exists", 1 if exists else 0)
            if exists:
                mlflow.log_metric(f"tts_{index}_size_mb", path.stat().st_size / 1024 / 1024)

        maybe_log_artifact(mlflow, assets["full"], "static_media/final_video")
        maybe_log_artifact(mlflow, assets["animation_bgm"], "static_media/video")
        maybe_log_artifact(mlflow, assets["animation"], "static_media/video")
        maybe_log_artifact(mlflow, assets["notebook"], "static_media/notebook")
        for path in tts_assets:
            maybe_log_artifact(mlflow, path, "static_media/tts")

        print("Logged static media deployment.")
        print("Run ID:", run.info.run_id)
        print("MLflow URI:", mlflow.get_tracking_uri())


if __name__ == "__main__":
    main()
