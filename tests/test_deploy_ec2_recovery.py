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


def test_chroma_index_is_mounted_from_the_host_not_baked_into_the_image() -> None:
    """chroma_db/ is gitignored, so a CI checkout never has it.

    Copying it in the Dockerfile meant every deploy shipped an empty index and
    purpose-based POI search returned nothing, while the deploy stayed green
    (#217). The workflow even created the empty directory to keep the build
    from failing on the missing COPY source. Mounting a host directory keeps
    the index across deploys and out of the image.
    """
    dockerfile = (ROOT / "src" / "api" / "Dockerfile").read_text(encoding="utf-8")
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    script = _deploy_script()

    copied = [line for line in dockerfile.splitlines() if line.strip().startswith("COPY ")]
    assert not [line for line in copied if "chroma_db" in line]

    # Nothing may recreate the placeholder: a `mkdir -p chroma_db` in the build
    # context would silently restore the empty-index deploy.
    assert "mkdir -p chroma_db" not in workflow
    assert "Prepare chroma_db build context" not in workflow

    # The path the container reads must be the path the host directory lands on.
    assert "CHROMA_HOST_DIR=" in script
    assert 'mkdir -p "$CHROMA_HOST_DIR"' in script
    assert '-v "$CHROMA_HOST_DIR":/app/chroma_db \\' in script
    assert "-e CHROMA_PATH=/app/chroma_db \\" in script
    assert "CHROMA_PATH=/app/chroma_db" in dockerfile

    # Chroma writes to sqlite inside the mount, so it cannot be read-only.
    assert ":/app/chroma_db:ro" not in script

    # The mount belongs to kride-fastapi only. Celery does not read Chroma, and
    # a second writer on the same sqlite file risks lock contention.
    fastapi_run = script[script.index("run_with_log_rotation -d --name kride-fastapi") :]
    fastapi_run = fastapi_run[: fastapi_run.index("\n\n")]
    assert "/app/chroma_db" in fastapi_run
    assert script.count(':/app/chroma_db') == 1


def test_deploy_reports_optional_datasource_health_without_failing() -> None:
    """These sources degrade silently, so the deploy must say so.

    The recommend paths swallow every exception, so a dead datasource looks
    identical to a healthy deploy. All four were dead at once for an unknown
    period and no deploy log showed it (#217).

    The check must not fail the deploy: the service works without either
    datasource, and failing here would block unrelated changes from shipping.
    """
    script = _deploy_script()

    assert "report_optional_datasource_health() {" in script
    assert "\nreport_optional_datasource_health\n" in script

    start = script.index("report_optional_datasource_health() {")
    body = script[start : script.index("\npull_service_image() {", start)]

    # Report-only: no exit inside the diagnostic, and the exec cannot abort the
    # script under `set -e`.
    assert "exit 1" not in body
    assert "|| true)" in body

    # Every source the recommendation path depends on is reported. Each one
    # degrades silently on its own, so a missing probe hides a real outage.
    for source in ("chroma=", "graphrag=", "ensemble=", "supabase="):
        assert source in body, source

    # Degraded states must be visible in the Actions UI rather than buried.
    assert body.count("::warning::") >= 5

    # Secret hosts must not reach a public repository's Actions log.
    assert "<supabase-host>" in body

    # GraphRAG is exercised through the public API rather than a file check, so
    # a present-but-unreadable graph is caught too.
    assert "search_artists_by_name" in body
    assert "get_region_pois_from_graph" in body

    # Missing container must skip rather than error.
    assert "docker inspect kride-fastapi" in body


def test_nginx_leaves_a_path_for_certificate_renewal_on_port_80() -> None:
    """Renewal was configured with the standalone authenticator, which binds
    port 80 itself. This nginx already holds it, so every attempt failed with
    "Could not bind TCP port 80" — silently, since nothing reads the certbot
    timer's output. The certificate was still the one issued months earlier
    and was heading for expiry.

    Serving the challenge from nginx removes the conflict. The catch is that
    this server block redirects everything to HTTPS, and a server-level
    `return` applies to any request no location matches — so the challenge
    needs its own location or it is redirected away.
    """
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    start = workflow.index("# HTTP → HTTPS redirect")
    block = workflow[start : workflow.index("# HTTPS server", start)]

    assert "location ^~ /.well-known/acme-challenge/" in block
    assert "root /var/www/certbot;" in block

    # Compare directives, not the prose around them — the comment explaining
    # this ordering mentions `return 301` too.
    directives = [
        line.strip()
        for line in block.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    challenge = next(i for i, l in enumerate(directives) if "acme-challenge" in l)
    redirect = next(i for i, l in enumerate(directives) if l.startswith("return 301"))
    assert challenge < redirect

    # The directory has to exist or nginx serves 404 into the challenge.
    assert "sudo mkdir -p /var/www/certbot" in _deploy_script()


def _embedded_diagnostic_python() -> str:
    """The Python the diagnostic runs inside kride-fastapi."""
    script = _deploy_script()
    marker = "docker exec kride-fastapi python -c '"
    start = script.index(marker) + len(marker)
    return script[start : script.index("' 2>&1 || true)\"", start)]


def test_diagnostic_python_is_valid_and_shell_safe() -> None:
    """It is passed through `python -c '...'`, so a stray quote ends the string.

    A broken diagnostic does not fail the deploy — it is wrapped in `|| true` —
    so nothing else would catch this.
    """
    import ast

    code = _embedded_diagnostic_python()
    assert "'" not in code, "single quote would terminate the shell string early"
    ast.parse(code)


def test_supabase_probe_reports_the_key_kind_without_leaking_the_key() -> None:
    """A row count of 0 means two different things and they need different fixes.

    Publishable and anon keys are subject to RLS, and when a policy blocks the
    read PostgREST answers 200 with count 0 rather than an error. The deploy
    reported nodes=0 for a table holding 41,586 rows, and acting on that number
    would have overwritten live data. The key kind separates the two cases.
    """
    import base64
    import json as _json
    import os

    code = _embedded_diagnostic_python()
    assert "def supabase_key_kind():" in code
    assert "key=" in code

    # The key itself must never reach a public Actions log.
    assert "os.environ.get(\"SUPABASE_KEY\", \"\")" in code
    assert "print(key" not in code
    assert "+ key" not in code

    namespace: dict[str, object] = {"os": os}
    start = code.index("def supabase_key_kind():")
    exec(code[start : code.index("\n# Supabase", start)], namespace)  # noqa: S102
    classify = namespace["supabase_key_kind"]

    def legacy(role: str) -> str:
        body = base64.urlsafe_b64encode(_json.dumps({"role": role}).encode()).decode()
        return "eyJhbGciOiJIUzI1NiJ9." + body.rstrip("=") + ".signature"

    original = os.environ.get("SUPABASE_KEY")
    try:
        for key, expected in (
            ("", "missing"),
            ("sb_secret_abc", "secret"),
            ("sb_publishable_abc", "publishable"),
            (legacy("anon"), "legacy-anon"),
            (legacy("service_role"), "legacy-service_role"),
            ("eyJnot-a-jwt", "legacy-unknown"),
            ("something-else", "unknown"),
        ):
            os.environ["SUPABASE_KEY"] = key
            assert classify() == expected, key[:20]
    finally:
        if original is None:
            os.environ.pop("SUPABASE_KEY", None)
        else:
            os.environ["SUPABASE_KEY"] = original


def test_zero_rows_on_a_browser_safe_key_is_reported_as_probable_rls() -> None:
    script = _deploy_script()
    start = script.index("*supabase=OK\\ nodes=0")
    block = script[start : script.index("esac", start)]

    assert "key=publishable" in block
    assert "key=legacy-anon" in block
    # The RLS branch must come before the plain empty-table branch, otherwise
    # the generic pattern swallows it.
    assert block.index("key=publishable") < block.index(
        "Supabase nodes table is empty"
    )
    assert "do not load data" in block.lower()


def test_route_history_write_path_is_probed() -> None:
    """Saving a route is the only write. An RLS block there is caught and logged,
    so the response stays 200 and the row is quietly lost."""
    code = _embedded_diagnostic_python()
    assert "route_history=OK" in code
    assert "KRIDE_ROUTE_HISTORY_TABLE" in code

    # The diagnostic must not write to the production table.
    probe = code[code.index("route_history") :]
    for write in (".insert(", ".upsert(", ".delete("):
        assert write not in probe, write

    script = _deploy_script()
    assert "*route_history=OK*) ;;" in script


def test_ensemble_warning_separates_a_missing_file_from_a_missing_dependency() -> None:
    """The two causes need different fixes, so one message cannot serve both.

    The ranker pickle was present in the image and the warning still told the
    reader to check that the image copies it. The real cause was that lightgbm
    was not installed, so unpickling raised ModuleNotFoundError — and the
    message pointed at the wrong file.
    """
    script = _deploy_script()
    start = script.index("*ensemble=OK*) ;;")
    block = script[start : script.index("esac", start)]

    assert "*ensemble=NO_MODEL*)" in block
    assert "*ensemble=UNAVAILABLE\\ ModuleNotFoundError*)" in block

    # Only the missing-file branch may send the reader to the COPY line.
    file_branch = block[block.index("*ensemble=NO_MODEL*)") : block.index("*ensemble=UNAVAILABLE")]
    dependency_branch = block[block.index("*ensemble=UNAVAILABLE") :]
    assert "models/ensemble_ranker.pkl" in file_branch
    assert "models/ensemble_ranker.pkl" not in dependency_branch
    assert "requirements-docker.txt" in dependency_branch


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
