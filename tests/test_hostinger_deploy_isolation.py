"""No real SSH, Docker mutations, RunPod submissions or GPU workers are used."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "deploy/hostinger" / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


scope = load("deploy_scope")
media = load("deploy_media")
SHA, OLD_SHA = "a" * 40, "b" * 40
IMAGE = "ghcr.io/feed-mina/kmovement-media@sha256:" + "c" * 64
OLD_IMAGE = "ghcr.io/feed-mina/kmovement-media@sha256:" + "d" * 64


class ScopeTests(unittest.TestCase):
    def test_media_change_never_selects_web(self):
        plan = scope.classify(["deploy/cloud_gateway/app.py", "deploy/hostinger/media.compose.yml"])
        self.assertTrue(plan["media"])
        self.assertFalse(plan["web"])

    def test_web_change_never_selects_relay(self):
        plan = scope.classify(["subproject/SDUI/metadata-project/app/page.tsx"])
        self.assertTrue(plan["web"])
        self.assertFalse(plan["media"])

    def test_documentation_tests_and_shared_ci_do_not_redeploy(self):
        plan = scope.classify(["docs/example.md", "tests/test_hostinger_deploy_isolation.py",
                               ".github/workflows/ci.yml"])
        self.assertFalse(any(plan.values()))

    def test_mixed_release_selects_both_without_starting_workers(self):
        plan = scope.classify(["deploy/cloud_gateway/app.py",
                               "subproject/SDUI/metadata-project/app/page.tsx"])
        self.assertTrue(plan["web"] and plan["media"])
        self.assertFalse(plan["gpu_manual"] or plan["private_video_manual"])

    def test_shared_spring_and_gpu_private_workers_require_explicit_release(self):
        plan = scope.classify(["subproject/SDUI/SDUI-server/src/main/Foo.java",
                               "deploy/media_motion/runpod_handler.py", "deploy/photo_video/worker.py"])
        self.assertFalse(plan["web"] or plan["media"])
        self.assertTrue(plan["spring_manual"] and plan["gpu_manual"] and plan["private_video_manual"])

    def test_video_ui_is_explicitly_a_shared_web_build(self):
        plan = scope.classify(["subproject/SDUI/metadata-project/app/travel/video/page.tsx"])
        self.assertTrue(plan["web"])
        self.assertFalse(plan["media"])

    def test_full_push_range_and_deleted_paths_are_checked(self):
        with patch.object(scope.subprocess, "run") as ancestor, patch.object(
                scope.subprocess, "check_output", return_value=b"deploy/cloud_gateway/removed.py\0") as diff:
            plan = scope.plan(OLD_SHA, SHA)
        ancestor.assert_called_once_with(["git", "merge-base", "--is-ancestor", OLD_SHA, SHA], check=True)
        self.assertIn("--no-renames", diff.call_args.args[0])
        self.assertTrue(plan["targets"]["media"])

    def test_unreadable_base_does_not_deploy_everything(self):
        with patch.object(scope.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "git")):
            with self.assertRaises(subprocess.CalledProcessError):
                scope.plan(OLD_SHA, SHA)

    def test_plan_must_match_verified_sha_and_real_boolean(self):
        document = {"schema": 1, "base": OLD_SHA, "sha": SHA, "targets": {"web": False, "media": True}}
        self.assertTrue(scope.enabled(document, SHA, "media"))
        with self.assertRaises(ValueError):
            scope.enabled(document, OLD_SHA, "media")
        document["targets"]["media"] = "false"
        with self.assertRaises(ValueError):
            scope.enabled(document, SHA, "media")


def config(image=OLD_IMAGE):
    return {"services": {"media-gateway": {
        "image": image, "labels": {"traefik.enable": "false"},
        "environment": {"KRIDE_MODEL_GENERATION_ENABLED": "false", "FASTAPI_INTERNAL_API_KEY": "private-key",
                        "RUNPOD_API_KEY": "provider-key", "RUNPOD_MEDIA_ENDPOINT_ID": "media"},
        "healthcheck": {"test": ["CMD", "python", "-c", "pass"]},
    }}}


class FakeMedia(media.Deployment):
    def __init__(self, root, existing=True):
        self.base_path = root / "base.json"
        self.base_path.write_text(json.dumps(config()))
        (root / "runtime.env").write_text("SERVER_ONLY=yes\n")
        os.chmod(root / "runtime.env", 0o600)
        super().__init__(SHA, IMAGE, self.base_path, root=root)
        self.commands = []
        self.new_failure = self.rollback_failure = self.health_failure = False
        self.revision = SHA
        self.active = self.make_container("old-id", OLD_IMAGE) if existing else None

    def make_container(self, image_id, image):
        return {"Id": "relay-container", "Image": image_id, "State": {"Health": {"Status": "healthy"}},
                "Config": {"Image": image, "Env": [k + "=" + v for k, v in config()["services"]["media-gateway"]["environment"].items()],
                           "Labels": {"com.docker.compose.project.config_files": str(self.base_path),
                                      "com.docker.compose.project.environment_file": str(self.root / "runtime.env")}}}

    def resolved(self, args):
        files = [Path(args[i + 1]) for i, word in enumerate(args) if word == "-f"]
        value = json.loads(files[0].read_text())
        for file in files[1:]:
            value["services"]["media-gateway"].update(json.loads(file.read_text())["services"]["media-gateway"])
        return value

    def command(self, args, stage, timeout=90):
        self.commands.append(args)
        if args[:2] == ["docker", "ps"]:
            return "relay-container" if self.active else ""
        if args[:2] == ["docker", "inspect"]:
            return json.dumps([self.active])
        if args[:3] == ["docker", "image", "inspect"]:
            return json.dumps([{"Id": "new-id", "Config": {"Labels": {"org.opencontainers.image.revision": self.revision}}}])
        if args[:2] == ["docker", "pull"]:
            return ""
        if args[:2] == ["docker", "exec"]:
            if self.health_failure and self.active["Image"] == "new-id":
                raise media.DeployError("Failed health")
            return ""
        if "config" in args:
            return json.dumps(self.resolved(args))
        if "up" in args:
            target = self.resolved(args)["services"]["media-gateway"]["image"]
            is_new = target == IMAGE
            self.active = self.make_container("new-id" if is_new else "old-id", target)
            if (is_new and self.new_failure) or (not is_new and self.rollback_failure):
                raise media.DeployError("Simulated replacement failure")
            return ""
        if "stop" in args:
            self.active = None
            return ""
        raise AssertionError(stage)


class MediaDeployTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        # Windows cannot represent Unix 0600; simulate only those permission bits.
        if os.name == "nt":
            original_stat = Path.stat
            def unix_private_stat(path, *args, **kwargs):
                result = original_stat(path, *args, **kwargs)
                if path.name == "runtime.env":
                    fields = list(result)
                    fields[0] &= ~0o077
                    return os.stat_result(fields)
                return result
            self.permissions = patch.object(Path, "stat", unix_private_stat)
            self.permissions.start()
            self.addCleanup(self.permissions.stop)
        self.main = patch.object(media, "current_main", return_value=SHA)
        self.main.start()
        self.addCleanup(self.main.stop)
        # Tests must never modify this process's signal handling.
        self.signal = patch.object(media.signal, "signal")
        self.signal.start()
        self.addCleanup(self.signal.stop)

    def test_success_only_replaces_the_media_service(self):
        deployment = FakeMedia(self.root)
        deployment.execute()
        self.assertEqual(deployment.record["status"], "verified")
        mutations = [c for c in deployment.commands if "up" in c or "stop" in c]
        self.assertEqual(len(mutations), 1)
        self.assertEqual(mutations[0][-1], "media-gateway")
        self.assertIn("--no-deps", mutations[0])
        self.assertEqual(mutations[0][mutations[0].index("-p") + 1], "kmovement-media")
        probes = [c[-1] for c in deployment.commands if c[:2] == ["docker", "exec"]]
        self.assertIn("/health", probes[0])
        self.assertNotIn("/jobs/runpod/batch", probes[0])
        self.assertNotIn("httpx.post", probes[0])
        self.assertNotIn("method='POST'", probes[0])

    def test_failed_replacement_restores_previous_relay(self):
        deployment = FakeMedia(self.root)
        deployment.new_failure = True
        with self.assertRaises(media.DeployError):
            deployment.execute()
        self.assertEqual(deployment.record["status"], "rolled_back")
        self.assertEqual(deployment.active["Image"], "old-id")

    def test_failed_health_restores_previous_relay(self):
        deployment = FakeMedia(self.root)
        deployment.health_failure = True
        with self.assertRaises(media.DeployError):
            deployment.execute()
        self.assertEqual(deployment.record["status"], "rolled_back")

    def test_failed_rollback_is_not_reported_as_success(self):
        deployment = FakeMedia(self.root)
        deployment.new_failure = deployment.rollback_failure = True
        with self.assertRaisesRegex(media.DeployError, "operator action"):
            deployment.execute()
        self.assertEqual(deployment.record["status"], "rollback_failed")

    def test_failed_first_install_stops_only_the_new_relay(self):
        deployment = FakeMedia(self.root, existing=False)
        deployment.new_failure = True
        with self.assertRaises(media.DeployError):
            deployment.execute()
        self.assertEqual(deployment.record["status"], "first_install_stopped")
        self.assertIsNone(deployment.active)
        self.assertEqual(deployment.commands[-1][-2:], ["stop", "media-gateway"])

    def test_wrong_revision_does_not_replace_container(self):
        deployment = FakeMedia(self.root)
        deployment.revision = OLD_SHA
        with self.assertRaises(media.DeployError):
            deployment.execute()
        self.assertFalse(any("up" in c for c in deployment.commands))

    def test_newer_main_does_not_replace_container(self):
        deployment = FakeMedia(self.root)
        with patch.object(media, "current_main", return_value=OLD_SHA):
            with self.assertRaises(media.DeployError):
                deployment.execute()
        self.assertFalse(any("up" in c for c in deployment.commands))

    def test_missing_private_environment_cannot_start_container(self):
        deployment = FakeMedia(self.root)
        (self.root / "runtime.env").unlink()
        with self.assertRaises(media.DeployError):
            deployment.execute()
        self.assertEqual(deployment.commands, [])

    def test_other_services_or_generation_cannot_be_added(self):
        value = config()
        value["services"]["spring"] = {}
        with self.assertRaises(media.DeployError):
            media.validate_config(value)
        value = config()
        value["services"]["media-gateway"]["environment"]["KRIDE_MODEL_GENERATION_ENABLED"] = "true"
        with self.assertRaises(media.DeployError):
            media.validate_config(value)

    def test_public_ports_cannot_be_added(self):
        value = config()
        value["services"]["media-gateway"]["ports"] = ["7860:7860"]
        with self.assertRaises(media.DeployError):
            media.validate_config(value)

    def test_snapshot_preserves_literal_dollars(self):
        secret = {"secret": "a$value${MORE}"}
        self.assertEqual(media.literals(media.literals(secret), True), secret)


class WorkflowTests(unittest.TestCase):
    def test_both_workflows_require_own_scope_verified_push_and_pinned_ssh(self):
        import yaml
        for component in ("web", "media"):
            text = (ROOT / ".github/workflows" / ("hostinger-" + component + "-deploy.yml")).read_text(encoding="utf-8")
            workflow = yaml.load(text, Loader=yaml.BaseLoader)
            job = workflow["jobs"]["deploy"]
            guard = job["if"]
            self.assertIn("needs.validate.outputs.enabled == 'true'", guard)
            self.assertIn("github.event.workflow_run.event == 'push'", guard)
            self.assertIn("github.event.workflow_run.head_repository.full_name == github.repository", guard)
            self.assertNotIn("pull_request", guard)
            self.assertIn("--component " + component, text)
            self.assertIn("StrictHostKeyChecking yes", text)
            self.assertNotIn("ssh-keyscan", text)
            self.assertEqual(job["concurrency"]["group"], "hostinger-" + component + "-production")

    def test_plan_comes_from_exact_ci_run_not_latest_artifact(self):
        text = (ROOT / ".github/workflows/hostinger-media-deploy.yml").read_text(encoding="utf-8")
        self.assertIn("CI_RUN_ID: ${{ github.event.workflow_run.id }}", text)
        self.assertIn('gh run download "$CI_RUN_ID"', text)
        self.assertNotIn("deploy_web.py", text)
        self.assertNotIn("Dockerfile.runpod", text)
        self.assertNotIn("RUNPOD_API_KEY:", text)

    def test_plan_job_uses_full_push_range(self):
        import yaml
        workflow = yaml.load((ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
        steps = workflow["jobs"]["deployment-plan"]["steps"]
        self.assertEqual(steps[0]["with"]["fetch-depth"], "0")
        self.assertIn("PUSH_BEFORE: ${{ github.event.before }}",
                      (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
