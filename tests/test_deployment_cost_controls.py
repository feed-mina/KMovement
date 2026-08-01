from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
MOBILE_DEPLOYMENT = (
    ROOT / "subproject" / "SDUI" / "kride" / "apps" / "mobile" / "DEPLOYMENT.md"
)
COST_RUNBOOK = ROOT / "docs" / "deployment-cost-optimization.md"
EC2_DEPLOY_SCRIPT = ROOT / "deploy" / "ec2" / "deploy.sh"

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


def test_the_only_web_frontend_is_the_one_deployed_to_ec2() -> None:
    """yerin.duckdns.org is the only web deployment target.

    subproject/SDUI/kride used to hold a second Next.js app deployed by Vercel.
    Two frontends meant deploy checks could be written against the wrong one —
    that is how a smoke check ended up asserting /kpop, a kride route absent
    from the deployed app. The web app and its vercel.json are gone; kride now
    holds only the Expo app and the shared core it ships with.
    """
    kride = ROOT / "subproject" / "SDUI" / "kride"

    assert not (kride / "vercel.json").exists()
    assert not (kride / "src").exists()
    assert not (kride / "next.config.mjs").exists()

    # The mobile app ships through EAS and is unaffected by the web cleanup.
    assert (kride / "apps" / "mobile" / "package.json").is_file()
    assert (kride / "packages" / "core" / "package.json").is_file()

    root_manifest = json.loads(_read(kride / "package.json"))
    combined = {**root_manifest["dependencies"], **root_manifest["devDependencies"]}
    for web_only in ("next", "next-pwa", "react-dom", "eslint-config-next"):
        assert web_only not in combined, web_only


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
    deploy_triggers = _read(WORKFLOWS / "deploy-ec2.yml").partition("\njobs:")[0]
    assert '.github/workflows/deploy-ec2.yml' not in deploy_triggers


def test_deploy_script_changes_reach_the_host() -> None:
    """The deploy script runs on the host, so changes to it must deploy.

    The trigger deliberately excludes the workflow file itself — editing CI
    orchestration should not cost a redeploy. deploy/ec2/ is the opposite case:
    it is the procedure that runs on EC2, in the same category as src/api. It
    only sat outside the trigger because it used to be inlined in the workflow
    file (#210), which is an accident of layout rather than a cost decision.
    """
    workflow = _read(WORKFLOWS / "deploy-ec2.yml")
    triggers, separator, _jobs = workflow.partition("\njobs:")
    assert separator
    assert '- "deploy/ec2/**"' in triggers

    # A changed deploy procedure applies to every service, so all three deploy
    # again regardless of which service directories changed.
    assert (
        r"grep -Eq '^(\.github/workflows/deploy-ec2\.yml|deploy/ec2/)'" in workflow
    )


def test_runpod_builds_cancel_duplicates_and_reuse_inline_registry_cache() -> None:
    for workflow_name in ("deploy-runpod.yml", "deploy-runpod-tora.yml"):
        workflow = _read(WORKFLOWS / workflow_name)
        triggers, separator, _jobs = workflow.partition("\njobs:")
        assert separator
        assert "concurrency:" in workflow
        assert "cancel-in-progress: true" in workflow
        assert "no-cache: true" not in workflow
        assert f".github/workflows/{workflow_name}" not in triggers
        assert (
            "cache-from: type=registry,ref=${{ env.DOCKERHUB_IMAGE }}:latest"
            in workflow
        )
        assert "cache-to: type=inline" in workflow


def test_ec2_deploy_rotates_container_logs() -> None:
    deploy_script = _read(EC2_DEPLOY_SCRIPT)

    assert "run_with_log_rotation() {" in deploy_script
    assert (
        'docker run --log-opt max-size=10m --log-opt max-file=3 "$@"'
        in deploy_script
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
            f"run_with_log_rotation -d --name {container_name}" in deploy_script
        ), container_name

    break_glass = _read(WORKFLOWS / "ec2-deploy-frontend.yml")
    marker = "docker run -d --name sdui-frontend"
    start = break_glass.index(marker)
    run_prefix = break_glass[start : start + 600]
    assert re.search(r"--log-opt\s+max-size=\S+", run_prefix)
    assert re.search(r"--log-opt\s+max-file=\S+", run_prefix)


def test_ec2_cleanup_is_manual_opt_in_and_scoped() -> None:
    workflow = _read(WORKFLOWS / "deploy-ec2.yml")
    triggers, separator, _jobs = workflow.partition("\njobs:")

    assert separator
    assert "cleanup_logs_and_caches:" in triggers
    assert "default: false" in triggers
    assert "type: boolean" in triggers

    marker = "- name: Clean approved logs and caches before container recreation"
    assert marker in workflow
    cleanup_step = workflow.split(marker, 1)[1].split(
        "- name: Deploy to EC2", 1
    )[0]
    assert (
        "github.event_name == 'workflow_dispatch' && "
        "inputs.cleanup_logs_and_caches"
    ) in cleanup_step
    for approved_cleanup in (
        "sudo journalctl --vacuum-size=64M",
        "sudo apt-get clean",
        'find /app/logs -mindepth 1 -maxdepth 1 -type f -name "application-*.log" -delete',
        ": > /app/logs/application.log",
        "find /tmp/hf_cache -mindepth 1 -delete",
        'if [ "$available_kb" -lt 4194304 ]',
    ):
        assert approved_cleanup in cleanup_step

    for disallowed_cleanup in (
        "docker system prune",
        "docker volume prune",
        "docker image prune",
        "rm -rf /var/lib/docker",
        "rm -rf /home",
    ):
        assert disallowed_cleanup not in cleanup_step


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
        "log_path={{.LogPath}}",
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


def test_runpod_cost_audit_is_manual_read_only_and_redacted() -> None:
    workflow = _read(WORKFLOWS / "runpod-cost-audit.yml")
    triggers, separator, _jobs = workflow.partition("\njobs:")

    assert separator
    assert "workflow_dispatch:" in triggers
    assert "push:" not in triggers
    assert "schedule:" not in triggers
    for endpoint in (
        "https://rest.runpod.io/v1/endpoints",
        "https://rest.runpod.io/v1/pods",
        "https://rest.runpod.io/v1/networkvolumes",
        "https://rest.runpod.io/v1/billing/$resource",
    ):
        assert endpoint in workflow
    assert "includeWorkers=true" in workflow
    assert "includeTemplate=true" not in workflow
    assert "includeNetworkVolume=true" in workflow
    assert ".networkVolume.id" in workflow
    assert ".gpu.count" in workflow
    assert ".desiredStatus" in workflow
    assert "highPerformanceStorageAmount" in workflow
    assert "--request GET" in workflow
    assert not re.search(r"--request\s+(?:POST|PUT|PATCH|DELETE)\b", workflow)
    assert "jq -r" in workflow
    assert ".env" not in workflow
    assert "template.env" not in workflow.lower()

    billing_filter_marker = '--slurpfile volumes "$volume_billing_file" ' + "\\"
    assert billing_filter_marker in workflow
    billing_filter = workflow.split(billing_filter_marker, 1)[1].split("'", 2)[1]
    compiled = subprocess.run(
        [
            "jq",
            "--null-input",
            "--arg",
            "start",
            "2026-06-23T00:00:00Z",
            "--arg",
            "end",
            "2026-07-23T00:00:00Z",
            "--argjson",
            "endpoints",
            '[[{"amount": 2.5, "timeBilledMs": 5400000}]]',
            "--argjson",
            "pods",
            '[[{"amount": 1.25, "timeBilledMs": 3600000}]]',
            "--argjson",
            "volumes",
            '[[{"amount": 0.2, "highPerformanceStorageAmount": 0.3}]]',
            billing_filter,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    summary = json.loads(compiled.stdout)
    assert summary["serverless_usd"] == 2.5
    assert summary["serverless_billed_hours"] == 1.5
    assert summary["pods_usd"] == 1.25
    assert summary["pods_billed_hours"] == 1
    assert summary["network_volumes_standard_usd"] == 0.2
    assert summary["network_volumes_high_performance_usd"] == 0.3


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
        "실제 `pnpm run eas:build:preview` 직전에 같은 조회를 다시 실행",
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
