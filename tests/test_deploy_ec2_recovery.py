from __future__ import annotations

import re
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS_DIR = ROOT / ".github" / "workflows"
WORKFLOW_PATH = WORKFLOWS_DIR / "deploy-ec2.yml"
DEPLOY_SCRIPT_PATH = ROOT / "deploy" / "ec2" / "deploy.sh"

# yerin.duckdns.org serves this app. subproject/SDUI/kride is a different
# frontend and its routes do not exist here.
FRONTEND_APP_DIR = ROOT / "subproject" / "SDUI" / "metadata-project" / "app"
COMPOSE_PATHS = (ROOT / "docker-compose.local.yml", ROOT / "docker-compose.gpu.yml")
SHARED_DOCKERFILE_BOUNDARY = "# End of the shared K-Ride dependency layers."

# GitHub Actions rejects the whole workflow file — startup failure, zero jobs —
# when a single run block exceeds this many characters. Observed verbatim on
# 2026-07-31: "(Line: 399, Col: 14): Exceeded max expression length 21000".
GITHUB_MAX_EXPRESSION_LENGTH = 21_000

# Stay well under the hard limit so that adding a few diagnostic lines can never
# disable deployment. The deploy script lives in deploy/ec2/deploy.sh precisely
# so that no run block has to grow anywhere near this.
RUN_BLOCK_SOFT_LIMIT = 16_000


def _deploy_script() -> str:
    return DEPLOY_SCRIPT_PATH.read_text(encoding="utf-8")


def _deploy_pipeline() -> str:
    """Workflow and deploy script together.

    Use for "this command must never run" assertions, which must hold wherever
    the command might have been written.
    """
    return WORKFLOW_PATH.read_text(encoding="utf-8") + "\n" + _deploy_script()


def _run_blocks(workflow: str) -> list[tuple[int, str]]:
    """Every `run: |` block in a workflow, as (line number, dedented body)."""
    blocks: list[tuple[int, str]] = []
    lines = workflow.split("\n")
    index = 0
    while index < len(lines):
        header = re.match(r"^(\s*)run:\s*\|[-+]?\d*\s*$", lines[index])
        if not header:
            index += 1
            continue
        indent = len(header.group(1))
        start = index + 1
        cursor = start
        body: list[str] = []
        while cursor < len(lines):
            line = lines[cursor]
            if line.strip() and len(line) - len(line.lstrip()) <= indent:
                break
            body.append(line)
            cursor += 1
        blocks.append((index + 1, dedent("\n".join(body))))
        index = cursor
    return blocks


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


def test_deploy_pre_evicts_running_services_to_free_disk_space() -> None:
    """Services being redeployed are stopped and their images removed before
    assert_minimum_docker_space so that a nearly-full disk (where every current
    image is still referenced by a running container) does not block deployment."""
    script = _deploy_script()

    free_space_gate = script.index("assert_minimum_docker_space 4194304")

    # FastAPI and Celery containers and images must be removed before the check
    fastapi_evict = script.index("remove_container kride-fastapi")
    assert fastapi_evict < free_space_gate

    celery_worker_evict = script.index("remove_container kride-celery-worker")
    assert celery_worker_evict < free_space_gate

    fastapi_img_rm = script.index(
        "docker image rm __KRIDE_FASTAPI_IMAGE__:__BRANCH_TAG__"
    )
    celery_img_rm = script.index(
        "docker image rm __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__"
    )
    assert fastapi_img_rm < free_space_gate
    assert celery_img_rm < free_space_gate

    # Backend and frontend images must also be removed before the check
    backend_img_rm = script.index(
        "docker image rm __SDUI_IMAGE__:__BRANCH_TAG__"
    )
    frontend_img_rm = script.index(
        "docker image rm __FRONTEND_IMAGE__:__BRANCH_TAG__"
    )
    assert backend_img_rm < free_space_gate
    assert frontend_img_rm < free_space_gate

    # docker image rm -f must never be used (avoids force-removing referenced layers)
    assert "docker image rm -f" not in _deploy_pipeline()


def test_deploy_pulls_services_sequentially_and_preserves_volumes() -> None:
    script = _deploy_script()

    stale_cleanup = script.index("prune_unreferenced_service_images \\")
    free_space_gate = script.index("assert_minimum_docker_space 4194304")
    backend_pull = script.index("pull_service_image __SDUI_IMAGE__:__BRANCH_TAG__")
    frontend_pull = script.index("pull_service_image __FRONTEND_IMAGE__:__BRANCH_TAG__")
    api_pull = script.index("pull_service_image __KRIDE_FASTAPI_IMAGE__:__BRANCH_TAG__")
    api_replace = script.index("remove_container kride-fastapi", api_pull)
    release_old_api = script.index("docker image prune -f || true", api_replace)
    celery_pull = script.index("pull_service_image __KRIDE_CELERY_IMAGE__:__BRANCH_TAG__")
    celery_replace = script.index("drain_celery_worker kride-celery-worker media", celery_pull)

    assert stale_cleanup < free_space_gate < backend_pull
    assert backend_pull < frontend_pull < api_pull < api_replace < release_old_api < celery_pull < celery_replace

    pipeline = _deploy_pipeline()
    assert "docker volume prune" not in pipeline
    assert "docker image prune -af" not in pipeline


def test_disk_recovery_only_removes_unreferenced_owned_service_images() -> None:
    script = _deploy_script()

    assert "prune_unreferenced_service_images()" in script
    assert "docker ps -aq" in script
    assert "docker inspect --format '{{.Image}}'" in script
    assert "grep -Fxq \"$IMAGE_ID\"" in script
    assert 'docker image ls "$SERVICE_REPOSITORY" --no-trunc' in script
    assert 'docker image rm "$IMAGE_REF"' in script
    assert "__KRIDE_FASTAPI_IMAGE__" in script
    assert "__KRIDE_CELERY_IMAGE__" in script
    assert "docker system df -v" in script

    pipeline = _deploy_pipeline()
    assert "docker image rm -f" not in pipeline
    assert "docker container prune" not in pipeline
    assert "docker system prune" not in pipeline


def test_the_deploy_script_is_a_file_rather_than_an_inline_heredoc() -> None:
    """The deploy script must stay out of the workflow YAML.

    Inlining it is what broke deployment on 2026-07-31: the script sat 913
    characters below GitHub's 21,000-character run-block limit, and a 1,040
    character diagnostic addition (#209) pushed it 127 characters over. GitHub
    then rejected the whole workflow file, so every job — including the fix
    itself — stopped running.
    """
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert DEPLOY_SCRIPT_PATH.is_file()
    assert "cp deploy/ec2/deploy.sh /tmp/deploy.sh" in workflow
    assert "DEPLOY_EOF" not in workflow

    # Placeholders are substituted by the workflow, so the script must not try
    # to resolve GitHub expressions itself.
    assert "${{" not in _deploy_script()


def test_every_placeholder_in_the_deploy_script_is_substituted_by_the_workflow() -> None:
    """An unsubstituted __TOKEN__ reaches the remote host verbatim."""
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    used = set(re.findall(r"__[A-Z0-9_]+__", _deploy_script()))
    substituted = set(re.findall(r'sed -i "s\|(__[A-Z0-9_]+__)\|', workflow))

    missing = sorted(used - substituted)
    assert not missing, f"deploy script uses placeholders the workflow never substitutes: {missing}"


def test_no_workflow_run_block_approaches_the_github_expression_limit() -> None:
    """Guards every workflow, not just the one that has already failed."""
    oversized = []
    for workflow_path in sorted(WORKFLOWS_DIR.glob("*.yml")):
        workflow = workflow_path.read_text(encoding="utf-8")
        for line_number, body in _run_blocks(workflow):
            assert len(body) < GITHUB_MAX_EXPRESSION_LENGTH, (
                f"{workflow_path.name}:{line_number} run block is {len(body)} characters; "
                f"GitHub rejects the entire workflow file above {GITHUB_MAX_EXPRESSION_LENGTH}"
            )
            if len(body) >= RUN_BLOCK_SOFT_LIMIT:
                oversized.append(f"{workflow_path.name}:{line_number} ({len(body)} chars)")

    assert not oversized, (
        "run blocks are close enough to GitHub's "
        f"{GITHUB_MAX_EXPRESSION_LENGTH}-character limit that a small addition could "
        f"disable the workflow; move the script into a file: {oversized}"
    )


def test_media_worker_is_warm_drained_before_replacement() -> None:
    script = _deploy_script()

    assert "drain_celery_worker()" in script
    assert '--timeout=5 cancel_consumer "$QUEUE_NAME"' in script
    assert '--timeout=5 shutdown' in script
    assert "sleep 1900; docker rm -f" in script


def test_ec2_workers_only_consume_reachable_media_and_maintenance_queues() -> None:
    script = _deploy_script()

    assert "-e CELERY_ML_TASKS_ENABLED=false" in script
    assert "celery -A src.api.celery_app worker -l info -c 1 -Q media" in script
    assert "celery -A src.api.celery_app worker -l info -c 1 -Q maintenance" in script
    assert "-Q ml,media" not in _deploy_pipeline()


def test_local_and_gpu_stacks_consume_the_maintenance_queue() -> None:
    for compose_path in COMPOSE_PATHS:
        compose = compose_path.read_text(encoding="utf-8")
        assert "celery-maintenance-worker:" in compose
        assert "celery -A src.api.celery_app worker -l info -c 1 -Q maintenance" in compose


def test_deploy_smoke_checks_celery_processes_and_authenticated_sse() -> None:
    script = _deploy_script()

    assert "assert_container_running kride-celery-worker" in script
    assert "assert_container_running kride-celery-maintenance" in script
    assert "assert_container_running kride-celery-beat" in script
    assert 'schedule["cleanup-orphaned-media-temp-hourly"]' in script
    assert "inspect active_queues --timeout=10" in script
    assert "celery.backend.store_result" in script
    assert "UUID task id" in script
    assert "--header 'X-Internal-Api-Key: __FASTAPI_INTERNAL_API_KEY__'" in script
    assert "SSE_HTTP_STATUS" in script
    assert "text/event-stream" in script
    assert '\"SUCCESS\"' in script
    assert "^data: \\[DONE\\]$" in script


def test_deploy_smoke_checks_that_frontend_pages_actually_render() -> None:
    """A green deploy must mean the site serves pages, not just APIs.

    Every other smoke check targets an API route, so Next.js could be down and
    the deployment would still finish green — the failure would only surface
    when someone opened the site.
    """
    script = _deploy_script()

    assert "assert_container_running sdui-frontend" in script
    # Exact lines, so that "/" is not satisfied by a longer path.
    assert "\nassert_frontend_page /\n" in script
    assert "\nassert_frontend_page /travel/kpop\n" in script

    start = script.index("assert_frontend_page() {")
    body = script[start : script.index("\npull_service_image() {", start)]

    # Routed through nginx under the real host name rather than straight at
    # :3000, so the check covers proxy config too.
    assert "--resolve yerin.duckdns.org:443:127.0.0.1" in body
    assert '"https://yerin.duckdns.org${FRONTEND_PATH}"' in body
    assert 'FRONTEND_STATUS" = "200"' in body

    # HTTP 200 alone is not enough: an nginx default page or an empty shell
    # also returns 200, so the body must carry server-rendered Next.js output.
    assert "'/_next/static'" in body

    # Next.js needs time to boot after container replacement.
    assert "sleep 5" in body
    assert "docker logs --tail 100 sdui-frontend" in body


def test_smoke_checked_frontend_paths_exist_in_the_deployed_app() -> None:
    """Smoke paths must be routes of the app the workflow actually builds.

    EC2 serves subproject/SDUI/metadata-project. subproject/SDUI/kride is a
    separate frontend, and a path taken from it 404s here — which fails every
    deploy on a fault that does not exist. That is exactly how /kpop (a kride
    route; the deployed app has /travel/kpop) broke the 2026-08-01 deploy.
    """
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "./subproject/SDUI/metadata-project" in workflow, (
        "the frontend image no longer builds from metadata-project; "
        "FRONTEND_APP_DIR in this test must follow it"
    )

    checked = re.findall(r"^assert_frontend_page (/\S*)$", _deploy_script(), re.MULTILINE)
    assert checked

    for path in checked:
        relative = path.strip("/")
        page = FRONTEND_APP_DIR / relative / "page.tsx" if relative else FRONTEND_APP_DIR / "page.tsx"
        assert page.is_file(), (
            f"deploy smoke checks {path}, but the deployed app has no route for it "
            f"(expected {page.relative_to(ROOT)})"
        )


def test_deploy_requires_internal_auth_and_durable_media_delivery() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    # Preflight and secret substitution stay in the workflow, which is the only
    # place that can read ${{ secrets }}.
    assert "Validate Celery production secrets" in workflow
    assert "FASTAPI_INTERNAL_API_KEY must be configured" in workflow
    assert "Configure CLOUDINARY_URL or all three individual Cloudinary credentials" in workflow
    assert "escape_sed_replacement" in workflow
    assert 'DEPLOY_FASTAPI_INTERNAL_API_KEY: ${{ secrets.FASTAPI_INTERNAL_API_KEY }}' in workflow
    assert 's|__CLOUDINARY_URL__|$CLOUDINARY_URL_ESCAPED|g' in workflow

    # Runtime enforcement lives in the deploy script.
    script = _deploy_script()
    assert "Cloudinary credentials are not usable" in script
    assert "Cloudinary delivery smoke failed" in script
    assert 'folder="kride/deploy-smoke"' in script
    assert "-e KRIDE_RESULT_URL_REQUIRED=true" in script


def test_frontend_ownership_preflight_uses_the_deployed_backend_container() -> None:
    assert "-e BACKEND_URL=http://__CONTAINER_NAME__:8080" in _deploy_script()
