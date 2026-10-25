"""Deployment contract tests. Docker, SSH, HTTP and signals are simulated; no VPS is changed."""
import copy
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("hostinger_deploy", ROOT / "deploy/hostinger/deploy_web.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

SHA = "a" * 40
IMAGE = "ghcr.io/feed-mina/kmovement-web@sha256:" + "a" * 64
OLD_IMAGE = "ghcr.io/feed-mina/kmovement-web@sha256:" + "b" * 64
OLD_ID, NEW_ID = "sha256:" + "c" * 64, "sha256:" + "d" * 64


class FakeDeployment(runner.Deployment):
    def __init__(self, work):
        super().__init__(SHA, IMAGE, root=work / "releases", sleep=lambda _seconds: None)
        self.commands, self.up_calls = [], []
        self.fail_new_up = self.fail_old_up = self.fail_internal = False
        self.extra_container = False
        self.image_revision, self.image_user = SHA, "nextjs"
        self.config_path, self.override_path = work / "base.json", work / "image.override.json"
        self.env_path = work / "release.env"
        self.env_path.write_text("TOKEN=server-secret\n")
        self.base_config = {"name": runner.PROJECT, "services": {"web": {
            "image": "old-base-reference",
            "environment": {"TOKEN": "server-secret", "NODE_ENV": "production"},
            "networks": {"kmovement": None},
        }}, "networks": {"kmovement": {"name": "kmovement-web_kmovement"}}}
        self.config_path.write_text(json.dumps(self.base_config))
        self.override_path.write_text(json.dumps({"services": {"web": {"image": OLD_IMAGE}}}))
        self.active = {
            "Id": "container-before", "Image": OLD_ID,
            "State": {"Health": {"Status": "healthy"}},
            "Config": {"Image": OLD_IMAGE, "Env": ["TOKEN=server-secret", "NODE_ENV=production"], "Labels": {
                "com.docker.compose.project": runner.PROJECT,
                "com.docker.compose.service": "web",
                "com.docker.compose.project.working_dir": str(work),
                "com.docker.compose.project.config_files": str(self.config_path) + "," + str(self.override_path),
                "com.docker.compose.project.environment_file": str(self.env_path),
            }},
        }

    @staticmethod
    def resolve(args):
        paths = [Path(args[i + 1]) for i, part in enumerate(args) if part == "-f"]
        config = json.loads(paths[0].read_text(encoding="utf-8"))
        for path in paths[1:]:
            config["services"]["web"].update(json.loads(path.read_text(encoding="utf-8"))["services"]["web"])
        return config

    def command(self, args, stage, timeout=90):
        self.commands.append(args)
        if args[:2] == ["docker", "ps"]:
            return "container-one\ncontainer-two" if self.extra_container else "container-one"
        if args[:2] == ["docker", "inspect"]:
            return json.dumps([self.active])
        if args[:3] == ["docker", "image", "inspect"]:
            return json.dumps([{"Id": NEW_ID, "Config": {
                "User": self.image_user, "Labels": {"org.opencontainers.image.revision": self.image_revision}
            }}])
        if args[:2] == ["docker", "pull"]:
            return ""
        if args[:2] == ["docker", "exec"]:
            if self.fail_internal and self.active["Image"] == NEW_ID:
                raise runner.DeployError("Internal route failed.")
            return ""
        if args[:2] == ["docker", "compose"] and "config" in args:
            return json.dumps(self.resolve(args))
        if args[:2] == ["docker", "compose"] and "up" in args:
            self.up_calls.append(args)
            target = self.resolve(args)["services"]["web"]["image"]
            is_new = target == IMAGE
            self.active["Image"] = NEW_ID if is_new else OLD_ID
            self.active["Config"]["Image"] = target
            if (is_new and self.fail_new_up) or (not is_new and self.fail_old_up):
                raise runner.DeployError("Partial Compose failure.")
            return ""
        raise AssertionError("Unexpected command: " + args[0])


class ContractTests(unittest.TestCase):
    def setUp(self):
        # Keep test cleanup inside a resolved, explicitly designated temporary directory.
        base = Path(os.environ.get("KMOVEMENT_TEST_TMPDIR", tempfile.gettempdir())).resolve()
        self.temp = tempfile.TemporaryDirectory(prefix="kmovement-deploy-test-", dir=base)
        self.work = Path(self.temp.name).resolve()
        self.work.relative_to(base)
        self.deployment = FakeDeployment(self.work)
        self.main_patch = patch.object(runner, "current_main", return_value=SHA)
        self.public_patch = patch.object(runner, "public_ok", return_value=True)
        self.signal_patch = patch.object(runner.signal, "signal")
        self.main = self.main_patch.start()
        self.public = self.public_patch.start()
        self.signal_patch.start()

    def tearDown(self):
        self.signal_patch.stop()
        self.public_patch.stop()
        self.main_patch.stop()
        self.temp.cleanup()

    def test_rejects_mutable_image_tags(self):
        with self.assertRaises(runner.DeployError):
            runner.validate_inputs(SHA, "ghcr.io/feed-mina/kmovement-web:latest")

    def test_rejects_another_repository(self):
        with self.assertRaises(runner.DeployError):
            runner.validate_inputs(SHA, IMAGE.replace("kmovement-web@", "other-web@"))

    def test_rejects_shell_text_in_sha(self):
        with self.assertRaises(runner.DeployError):
            runner.validate_inputs("main; arbitrary-command", IMAGE)

    def test_success_changes_only_web_image_and_keeps_env_file(self):
        self.deployment.execute()
        self.assertEqual(self.deployment.record["status"], "verified")
        self.assertEqual(len(self.deployment.up_calls), 1)
        args = self.deployment.up_calls[0]
        self.assertEqual(args[-1], "web")
        self.assertIn("--no-deps", args)
        self.assertIn("--no-build", args)
        self.assertEqual(args[args.index("--pull") + 1], "never")
        self.assertIn(str(self.deployment.env_path), args)
        self.assertNotIn(str(self.deployment.override_path), args)  # old overrides do not accumulate
        self.assertEqual(self.deployment.env_path.read_text(encoding="utf-8"), "TOKEN=server-secret\n")
        saved = json.loads((self.deployment.release / "before.compose.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["services"]["web"]["image"], OLD_IMAGE)
        self.assertTrue((self.deployment.release / "rollback.sh").is_file())

    def test_wrong_image_revision_stops_before_replacement(self):
        self.deployment.image_revision = "e" * 40
        with self.assertRaises(runner.DeployError):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_calls, [])
        self.assertFalse(self.deployment.changed)

    def test_wrong_runtime_user_stops_before_replacement(self):
        self.deployment.image_user = "root"
        with self.assertRaises(runner.DeployError):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_calls, [])

    def test_stale_main_stops_before_replacement(self):
        self.main.return_value = "e" * 40
        with self.assertRaises(runner.DeployError):
            self.deployment.execute()
        self.assertEqual(self.deployment.record["status"], "superseded")
        self.assertEqual(self.deployment.up_calls, [])

    def test_environment_drift_stops_before_pull(self):
        self.deployment.active["Config"]["Env"] = ["TOKEN=different-secret", "NODE_ENV=production"]
        with self.assertRaises(runner.DeployError) as caught:
            self.deployment.execute()
        self.assertNotIn("different-secret", str(caught.exception))
        self.assertFalse(any(args[:2] == ["docker", "pull"] for args in self.deployment.commands))

    def test_partial_compose_failure_restores_previous_image(self):
        self.deployment.fail_new_up = True
        with self.assertRaisesRegex(runner.DeployError, "restored and verified"):
            self.deployment.execute()
        self.assertEqual(self.deployment.record["status"], "rolled_back")
        self.assertEqual(self.deployment.active["Image"], OLD_ID)
        self.assertEqual(len(self.deployment.up_calls), 2)

    def test_internal_page_failure_restores_previous_image(self):
        self.deployment.fail_internal = True
        with self.assertRaises(runner.DeployError):
            self.deployment.execute()
        self.assertEqual(self.deployment.record["status"], "rolled_back")
        self.assertEqual(self.deployment.active["Image"], OLD_ID)

    def test_public_router_transient_does_not_trigger_early_rollback(self):
        self.public.side_effect = [False, False, True]
        self.deployment.sleep = sleep = unittest.mock.Mock()
        self.deployment.execute()
        self.assertEqual(sleep.call_count, 2)
        self.assertEqual(len(self.deployment.up_calls), 1)
        self.assertEqual(self.deployment.record["status"], "verified")

    def test_old_public_revision_is_not_success_even_if_internal_is_healthy(self):
        self.public.side_effect = lambda sha: sha is None  # only the restored old service passes
        with self.assertRaises(runner.DeployError):
            self.deployment.execute()
        self.assertEqual(self.deployment.record["status"], "rolled_back")
        self.assertEqual(self.public.call_count, 13)

    def test_failed_rollback_is_reported_separately(self):
        self.deployment.fail_new_up = self.deployment.fail_old_up = True
        with self.assertRaisesRegex(runner.DeployError, "operator action required"):
            self.deployment.execute()
        self.assertEqual(self.deployment.record["status"], "rollback_failed")

    def test_multiple_containers_are_never_guessed(self):
        self.deployment.extra_container = True
        with self.assertRaises(runner.DeployError):
            self.deployment.execute()
        self.assertEqual(self.deployment.up_calls, [])

    def test_missing_environment_file_stops_before_pull(self):
        self.deployment.env_path.unlink()
        with self.assertRaises(runner.DeployError):
            self.deployment.execute()
        self.assertFalse(any(args[:2] == ["docker", "pull"] for args in self.deployment.commands))

    def test_non_image_compose_change_is_rejected(self):
        before = self.deployment.base_config
        after = copy.deepcopy(before)
        after["services"]["web"]["environment"]["EXTRA"] = "unexpected"
        with self.assertRaises(runner.DeployError):
            runner.assert_image_only(before, after, before["services"]["web"]["image"])

    def test_record_write_failure_cannot_block_rollback(self):
        original_write = Path.write_text
        def write(path, *args, **kwargs):
            if path.name == "release.json":
                raise OSError("simulated full disk for the status record")
            return original_write(path, *args, **kwargs)
        self.deployment.fail_new_up = True
        with patch.object(Path, "write_text", write):
            with self.assertRaises(runner.DeployError):
                self.deployment.execute()
        self.assertEqual(self.deployment.record["status"], "rolled_back")
        self.assertEqual(self.deployment.active["Image"], OLD_ID)

    def test_rollback_snapshot_escapes_literal_dollars(self):
        value = {"services": {"web": {"environment": {"TOKEN": "literal$value${MORE}"}}}}
        escaped = runner.escape_compose_literals(value)
        self.assertEqual(runner.unescape_compose_literals(escaped), value)
        self.assertEqual(escaped["services"]["web"]["environment"]["TOKEN"], "literal$$value$${MORE}")
        self.assertEqual(value["services"]["web"]["environment"]["TOKEN"], "literal$value${MORE}")

    @unittest.skipUnless(sys.platform == "linux" and shutil.which("docker"), "Docker Compose integration runs on Linux CI")
    def test_docker_compose_roundtrips_snapshot_dollars_without_starting_containers(self):
        original = {"services": {"web": {"image": "example.invalid/web:test",
                    "environment": {"TOKEN": "literal$value${MORE}"}}}}
        path = self.work / "escaped-compose.json"
        path.write_text(json.dumps(runner.escape_compose_literals(original)), encoding="utf-8")
        result = subprocess.run(["docker", "compose", "-p", "kmovement-snapshot-test", "-f", str(path),
                                 "config", "--format", "json"], check=True, text=True, capture_output=True)
        restored = runner.unescape_compose_literals(json.loads(result.stdout))
        self.assertEqual(restored["services"]["web"]["environment"]["TOKEN"], "literal$value${MORE}")

    def test_mixed_settings_override_is_never_pruned(self):
        self.deployment.override_path.write_text(json.dumps({"services": {"web": {
            "image": OLD_IMAGE, "environment": {"EXTRA": "keep-this"},
        }}}))
        self.assertFalse(runner.is_image_override(self.deployment.override_path))


class WorkflowTests(unittest.TestCase):
    def test_release_credentials_cannot_be_used_by_pull_request_deploy_job(self):
        import yaml
        workflow = yaml.load((ROOT / ".github/workflows/hostinger-web-deploy.yml").read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
        job = workflow["jobs"]["deploy"]
        guard = job["if"]
        self.assertIn("github.event_name == 'workflow_run'", guard)
        self.assertIn("github.event.workflow_run.event == 'push'", guard)
        self.assertIn("github.event.workflow_run.head_repository.full_name == github.repository", guard)
        self.assertIn("github.event.workflow_run.head_branch == 'main'", guard)
        self.assertNotIn("pull_request", guard)
        self.assertIn("needs.validate.outputs.current", guard)
        self.assertEqual(job["concurrency"]["cancel-in-progress"], "false")

    def test_host_verification_is_pinned_not_scanned_on_runner(self):
        workflow = (ROOT / ".github/workflows/hostinger-web-deploy.yml").read_text(encoding="utf-8")
        self.assertIn("StrictHostKeyChecking yes", workflow)
        self.assertNotIn("StrictHostKeyChecking=no", workflow)
        self.assertNotIn("ssh-keyscan", workflow)
        self.assertIn("HOSTINGER_SSH_KNOWN_HOSTS", workflow)
        self.assertIn("git ls-remote origin refs/heads/main", workflow)
        self.assertIn("KMOVEMENT_RELEASE_SHA=", workflow)

    def test_marker_is_a_runtime_value_not_a_claimed_build_success(self):
        dockerfile = (ROOT / "subproject/SDUI/metadata-project/Dockerfile").read_text(encoding="utf-8")
        self.assertIn("ENV KMOVEMENT_RELEASE_SHA=$KMOVEMENT_RELEASE_SHA", dockerfile.split("AS runner")[1])
        endpoint = (ROOT / "subproject/SDUI/metadata-project/app/health/release/route.ts").read_text(encoding="utf-8")
        self.assertIn("force-dynamic", endpoint)
        self.assertIn("no-store", endpoint)


if __name__ == "__main__":
    unittest.main()
