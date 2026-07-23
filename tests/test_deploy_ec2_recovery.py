from __future__ import annotations

from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "deploy-ec2.yml"
COMPOSE_PATHS = (ROOT / "docker-compose.local.yml", ROOT / "docker-compose.gpu.yml")
SHARED_DOCKERFILE_BOUNDARY = "# End of the shared K-Ride dependency layers."


def _shared_dockerfile_prefix(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    prefix, separator, _remainder = text.partition(SHARED_DOCKERFILE_BOUNDARY)
    assert separator, f"shared layer boundary missing from {path}"
    return prefix + separator


def test_api_and_worker_share_the_heavy_runtime_layers() -> None:
    api_dockerfile = ROOT / "src" / "api" / "Dockerfile"
    worker_dockerfile = ROOT / "Dockerfile.worker"

    assert _shared_dockerfile_prefix(api_dockerfile) == _shared_dockerfile_prefix(worker_dockerfile)

    worker_text = worker_dockerfile.read_text(encoding="utf-8")
    boundary = worker_text.index(SHARED_DOCKERFILE_BOUNDARY)
    assert worker_text.index("deploy/media_motion/requirements.txt") > boundary
    assert worker_text.index("ffmpeg") > boundary
    assert worker_text.index("COPY src/ /app/src/") > worker_text.index("requirements-media.txt")


def test_worker_changes_trigger_the_ec2_kride_build() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert '- "Dockerfile.worker"' in workflow
    assert '- "deploy/media_motion/**"' in workflow
    assert "Dockerfile\\.worker|deploy/media_motion/" in workflow


def test_deploy_pulls_services_sequentially_and_preserves_volumes() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    stale_cleanup = workflow.index("prune_unreferenced_service_images \\")
    free_space_gate = workflow.index("assert_minimum_docker_space 4194304")
    backend_pull = workflow.index("pull_service_image __SDUI_IMAGE__:__BRANCH_TAG__")
    frontend_pull = workflow.index("pull_service_image __FRONTEND_IMAGE__:__BRANCH_TAG__")
    api_pull = workflow.index("pull_service_image __KRIDE_FASTAPI_IMAGE__:__BRANCH_TAG__")
    api_replace = workflow.index("remove_container kride-fastapi", api_pull)
    release_old_api = workflow.index("docker image prune -f || true", api_replace)
    celery_pull = workflow.index("pull_service_image __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__")
    celery_replace = workflow.index("drain_celery_worker kride-celery-worker media", celery_pull)

    assert stale_cleanup < free_space_gate < backend_pull
    assert backend_pull < frontend_pull < api_pull < api_replace < release_old_api < celery_pull < celery_replace
    assert "docker volume prune" not in workflow
    assert "docker image prune -af" not in workflow


def test_disk_recovery_only_removes_unreferenced_owned_service_images() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "prune_unreferenced_service_images()" in workflow
    assert "docker ps -aq" in workflow
    assert "docker inspect --format '{{.Image}}'" in workflow
    assert "grep -Fxq \"$IMAGE_ID\"" in workflow
    assert 'docker image ls "$SERVICE_REPOSITORY" --no-trunc' in workflow
    assert 'docker image rm "$IMAGE_REF"' in workflow
    assert "docker image rm -f" not in workflow
    assert "docker container prune" not in workflow
    assert "docker system prune" not in workflow
    assert "__KRIDE_FASTAPI_IMAGE__" in workflow
    assert "__KRIDE_CELERY_IMAGE__" in workflow
    assert "docker system df -v" in workflow


def test_create_deploy_script_stays_below_github_expression_limit() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    step = workflow.index("      - name: Create deploy script")
    run_marker = "        run: |\n"
    run_start = workflow.index(run_marker, step) + len(run_marker)
    run_end = workflow.index("\n      - name:", run_start)
    run_body = dedent(workflow[run_start:run_end])

    # GitHub rejects a single run expression at 21,000 characters. Keep enough
    # headroom that a small diagnostic addition cannot disable the workflow.
    assert len(run_body) < 20_500


def test_media_worker_is_warm_drained_before_replacement() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "drain_celery_worker()" in workflow
    assert '--timeout=5 cancel_consumer "$QUEUE_NAME"' in workflow
    assert '--timeout=5 shutdown' in workflow
    assert "sleep 1900; docker rm -f" in workflow


def test_ec2_workers_only_consume_reachable_media_and_maintenance_queues() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "-e CELERY_ML_TASKS_ENABLED=false" in workflow
    assert "celery -A src.api.celery_app worker -l info -c 1 -Q media" in workflow
    assert "celery -A src.api.celery_app worker -l info -c 1 -Q maintenance" in workflow
    assert "-Q ml,media" not in workflow


def test_local_and_gpu_stacks_consume_the_maintenance_queue() -> None:
    for compose_path in COMPOSE_PATHS:
        compose = compose_path.read_text(encoding="utf-8")
        assert "celery-maintenance-worker:" in compose
        assert "celery -A src.api.celery_app worker -l info -c 1 -Q maintenance" in compose


def test_deploy_smoke_checks_celery_processes_and_authenticated_sse() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "assert_container_running kride-celery-worker" in workflow
    assert "assert_container_running kride-celery-maintenance" in workflow
    assert "assert_container_running kride-celery-beat" in workflow
    assert 'schedule["cleanup-orphaned-media-temp-hourly"]' in workflow
    assert "inspect active_queues --timeout=10" in workflow
    assert "celery.backend.store_result" in workflow
    assert "UUID task id" in workflow
    assert "--header 'X-Internal-Api-Key: __FASTAPI_INTERNAL_API_KEY__'" in workflow
    assert "SSE_HTTP_STATUS" in workflow
    assert "text/event-stream" in workflow
    assert '\"SUCCESS\"' in workflow
    assert "^data: \\[DONE\\]$" in workflow


def test_deploy_requires_internal_auth_and_durable_media_delivery() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "Validate Celery production secrets" in workflow
    assert "FASTAPI_INTERNAL_API_KEY must be configured" in workflow
    assert "Configure CLOUDINARY_URL or all three individual Cloudinary credentials" in workflow
    assert "escape_sed_replacement" in workflow
    assert 'DEPLOY_FASTAPI_INTERNAL_API_KEY: ${{ secrets.FASTAPI_INTERNAL_API_KEY }}' in workflow
    assert 's|__CLOUDINARY_URL__|$CLOUDINARY_URL_ESCAPED|g' in workflow
    assert "Cloudinary credentials are not usable" in workflow
    assert "Cloudinary delivery smoke failed" in workflow
    assert 'folder="kride/deploy-smoke"' in workflow
    assert "-e KRIDE_RESULT_URL_REQUIRED=true" in workflow


def test_frontend_ownership_preflight_uses_the_deployed_backend_container() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert "-e BACKEND_URL=http://__CONTAINER_NAME__:8080" in workflow
