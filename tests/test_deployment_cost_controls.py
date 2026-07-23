from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
VERCEL_CONFIG = ROOT / "subproject" / "SDUI" / "kride" / "vercel.json"
MOBILE_DEPLOYMENT = (
    ROOT / "subproject" / "SDUI" / "kride" / "apps" / "mobile" / "DEPLOYMENT.md"
)
COST_RUNBOOK = ROOT / "docs" / "deployment-cost-optimization.md"

LEGACY_WORKFLOWS = (
    "deploy-cloud-run.yml",
    "deploy-gcp.yml",
    "ec2-fix-frontend.yml",
    "ec2-fix-ssl.yml",
    "ec2-diagnose.yml",
    "ec2-apply-migration.yml",
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_vercel_git_deployments_are_main_only() -> None:
    config = json.loads(_read(VERCEL_CONFIG))

    assert config["git"]["deploymentEnabled"] == {
        "main": True,
        "*": False,
    }
    assert config["ignoreCommand"] == (
        "git diff HEAD^ HEAD --quiet -- . && exit 0 || exit 1"
    )


def test_legacy_mutating_deployment_workflows_are_removed() -> None:
    for workflow_name in LEGACY_WORKFLOWS:
        assert not (WORKFLOWS / workflow_name).exists(), workflow_name


def test_ci_and_ec2_deployment_only_auto_run_from_main() -> None:
    for workflow_name in ("ci.yml", "deploy-ec2.yml"):
        workflow = _read(WORKFLOWS / workflow_name)
        triggers, separator, _jobs = workflow.partition("\njobs:")
        assert separator
        assert 'branches: ["main"]' in triggers
        assert "refactor/krider_backup" not in triggers

    ci_workflow = _read(WORKFLOWS / "ci.yml")
    assert "tests/test_deployment_cost_controls.py" in ci_workflow


def test_runpod_builds_cancel_duplicates_and_reuse_inline_registry_cache() -> None:
    for workflow_name in ("deploy-runpod.yml", "deploy-runpod-tora.yml"):
        workflow = _read(WORKFLOWS / workflow_name)
        assert "concurrency:" in workflow
        assert "cancel-in-progress: true" in workflow
        assert "no-cache: true" not in workflow
        assert (
            "cache-from: type=registry,ref=${{ env.DOCKERHUB_IMAGE }}:latest"
            in workflow
        )
        assert "cache-to: type=inline" in workflow


def test_ec2_deploy_rotates_container_logs() -> None:
    workflow = _read(WORKFLOWS / "deploy-ec2.yml")

    assert "run_with_log_rotation() {" in workflow
    assert (
        'docker run --log-opt max-size=10m --log-opt max-file=3 "$@"'
        in workflow
    )
    for container_name in (
        "sdui-redis",
        "__CONTAINER_NAME__",
        "sdui-frontend",
        "kride-fastapi",
        "kride-celery-worker",
        "kride-celery-maintenance",
        "kride-celery-beat",
    ):
        assert (
            f"run_with_log_rotation -d --name {container_name}" in workflow
        ), container_name

    break_glass = _read(WORKFLOWS / "ec2-deploy-frontend.yml")
    marker = "docker run -d --name sdui-frontend"
    start = break_glass.index(marker)
    run_prefix = break_glass[start : start + 600]
    assert re.search(r"--log-opt\s+max-size=\S+", run_prefix)
    assert re.search(r"--log-opt\s+max-file=\S+", run_prefix)


def test_ec2_audit_is_manual_and_read_only() -> None:
    workflow = _read(WORKFLOWS / "ec2-audit.yml")
    lowered = workflow.lower()
    triggers, separator, _jobs = workflow.partition("\njobs:")

    assert separator
    assert "workflow_dispatch:" in workflow
    assert "push:" not in triggers
    assert "schedule:" not in triggers
    for diagnostic in (
        "df -h",
        "docker system df",
        "docker ps",
        "docker inspect",
        "journalctl --disk-usage",
    ):
        assert diagnostic in workflow

    for mutation in (
        " rm -rf ",
        "docker rm ",
        "docker rmi ",
        "docker image rm ",
        "docker system prune",
        "docker image prune",
        "docker container prune",
        "docker volume prune",
        "docker stop ",
        "docker restart ",
        "docker compose up",
        "systemctl restart",
        "certbot renew",
    ):
        assert mutation not in lowered


def test_gcp_cost_audit_is_manual_and_list_only() -> None:
    workflow = _read(WORKFLOWS / "gcp-cost-audit.yml")
    lowered = workflow.lower()
    triggers, separator, _jobs = workflow.partition("\njobs:")

    assert separator
    assert "workflow_dispatch:" in triggers
    assert "push:" not in triggers
    assert "schedule:" not in triggers
    assert "contents: read" in workflow
    for inventory_command in (
        "gcloud compute instances list",
        "gcloud compute disks list",
        "gcloud compute addresses list",
        "gcloud run services list",
        "gcloud artifacts repositories list",
    ):
        assert inventory_command in workflow

    assert not re.search(
        r"\bgcloud\s+\S+(?:\s+\S+){0,3}\s+"
        r"(?:create|delete|deploy|remove|set|start|stop|update)\b",
        lowered,
    )


def test_mobile_runbook_blocks_duplicate_eas_builds() -> None:
    runbook = _read(MOBILE_DEPLOYMENT)
    normalized = " ".join(runbook.split())

    for contract in (
        "EAS 비용·중복 빌드 사전 확인",
        "한 작업자만 소유",
        "eas build:list",
        "--platform android",
        "--git-commit-hash",
        "--build-profile preview",
        "--runtime-version",
        "--app-build-version",
        "`new`, `in-queue`, `in-progress`, `pending-cancel`",
        "`finished`이면 기존 artifact와 build ID를 재사용",
        "실제 `npm run eas:build:preview` 직전에 같은 조회를 다시 실행",
        "JS-only 변경은 새 native binary를 만들지 않습니다",
        "eas:update:preview",
    ):
        assert " ".join(contract.split()) in normalized


def test_cost_runbook_covers_external_gates_and_rollback() -> None:
    runbook = _read(COST_RUNBOOK)
    normalized = " ".join(runbook.split())

    for contract in (
        "#177",
        "deploy-ec2.yml",
        "canonical",
        "deploy-cloud-run.yml",
        "deploy-gcp.yml",
        "snapshot → stop → 7일 관찰 → delete",
        "2026-07-23에 `quartz-kiba` 콘솔을 직접 확인한 현재 증거",
        "최근 7일 instance-count 차트",
        "30일 request",
        "확인하기 전에는 삭제하지 않는다",
        "### GCP",
        "### RunPod",
        "### Vercel",
        "### Expo EAS",
        "## 5. 롤백",
        "워크플로를 삭제했다는 사실만으로 외부 자원 또는 과금이 중단됐다고 판단하지 않는다",
    ):
        assert " ".join(contract.split()) in normalized
