#!/usr/bin/env python3
"""Replace only the existing Hostinger web image; preserve Compose and roll back failures.

Executed over pinned-key SSH: python3 - <sha> <digest-pinned-image> < deploy_web.py
No Docker config, environment values or application logs are printed.
"""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import re
import shlex
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import uuid

INTERRUPTS = tuple(getattr(signal, name) for name in ("SIGTERM", "SIGHUP", "SIGINT") if hasattr(signal, name))
PROJECT = "kmovement-web"
HOST = "kmovement.srv1869569.hstgr.cloud"
HOSTNAME = "srv1869569"
RELEASE_ROOT = Path("/docker/kmovement-web/releases")
PAGES = ("/", "/view/TOUR_EXPLORE", "/view/ROUTE_PLANNER")
SHA = re.compile(r"[0-9a-f]{40}")
IMAGE = re.compile(r"ghcr\.io/feed-mina/kmovement-web@sha256:[0-9a-f]{64}")


class DeployError(RuntimeError):
    pass


def validate_inputs(sha, image):
    if not SHA.fullmatch(sha) or not IMAGE.fullmatch(image):
        raise DeployError("Invalid release SHA or image digest.")


def env_map(container):
    return dict(item.split("=", 1) for item in container["Config"].get("Env", []) if "=" in item)


def assert_runtime_matches(config, container):
    expected = config["services"]["web"].get("environment", {})
    actual = env_map(container)
    if any(value is None or actual.get(key) != str(value) for key, value in expected.items()):
        raise DeployError("Active web environment differs from Compose; no container changed.")
    if config["services"]["web"]["image"] != container["Config"]["Image"]:
        raise DeployError("Active web image differs from Compose; no container changed.")


def assert_image_only(before, after, image):
    expected = copy.deepcopy(before)
    expected["services"]["web"]["image"] = image
    if expected != after:
        raise DeployError("Compose would change settings besides web.image; no container changed.")


def escape_compose_literals(value):
    """A resolved snapshot must not expand literal dollar signs on rollback."""
    if isinstance(value, str):
        return value.replace("$", "$$")
    if isinstance(value, list):
        return [escape_compose_literals(item) for item in value]
    if isinstance(value, dict):
        return {key: escape_compose_literals(item) for key, item in value.items()}
    return value


def unescape_compose_literals(value):
    """Compose config escapes dollars for re-reading; restore engine values for comparison."""
    if isinstance(value, str):
        return value.replace("$", "$")
    if isinstance(value, list):
        return [unescape_compose_literals(item) for item in value]
    if isinstance(value, dict):
        return {key: unescape_compose_literals(item) for key, item in value.items()}
    return value


def is_image_override(path):
    try:
        value = json.loads(path.read_text())
        image = value["services"]["web"]["image"]
        return isinstance(image, str) and value == {"services": {"web": {"image": image}}}
    except (OSError, ValueError, KeyError, TypeError):
        return False


def current_main():
    request = urllib.request.Request(
        "https://api.github.com/repos/feed-mina/KMovement/git/ref/heads/main",
        headers={"User-Agent": "KMovement-Hostinger-deploy", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)["object"]["sha"]


def public_ok(expected_sha):
    for path in PAGES:
        request = urllib.request.Request(
            "https://" + HOST + path,
            headers={"Cache-Control": "no-cache", "User-Agent": "KMovement-deploy-check"},
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            if response.status != 200:
                return False
    if expected_sha:
        request = urllib.request.Request(
            "https://" + HOST + "/health/release?deploy=" + expected_sha,
            headers={"Cache-Control": "no-cache", "User-Agent": "KMovement-deploy-check"},
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            if response.status != 200 or json.load(response).get("revision") != expected_sha:
                return False
    return True


class Deployment:
    def __init__(self, sha, image, root=RELEASE_ROOT, sleep=time.sleep):
        validate_inputs(sha, image)
        self.sha, self.image, self.root, self.sleep = sha, image, Path(root), sleep
        self.release = None
        self.changed = False
        self.record = {"source_sha": sha, "image": image, "status": "preparing"}

    def command(self, args, stage, timeout=90):
        result = subprocess.run(args, text=True, capture_output=True, timeout=timeout)
        if result.returncode:
            if self.release:
                (self.release / "last-command-error.txt").write_text(result.stderr)
            raise DeployError(stage + " failed; inspect the private release directory on the server.")
        return result.stdout.strip()

    def json_command(self, args, stage):
        return json.loads(self.command(args, stage))

    def status(self, state):
        self.record["status"] = state
        if self.release:
            try:
                (self.release / "release.json").write_text(json.dumps(self.record, indent=2) + "\n")
            except OSError:
                print("Hostinger web: record write unavailable; recovery continues.", flush=True)
        print("Hostinger web: " + state, flush=True)

    def container(self):
        ids = self.command([
            "docker", "ps", "--filter", "label=com.docker.compose.project=" + PROJECT,
            "--filter", "label=com.docker.compose.service=web", "--format", "{{.ID}}",
        ], "Find active web container").splitlines()
        if len(ids) != 1:
            raise DeployError("Expected exactly one running KMovement web container.")
        return self.json_command(["docker", "inspect", ids[0]], "Inspect active web")[0]

    def config(self, command):
        return unescape_compose_literals(self.json_command(command + ["config", "--format", "json"], "Resolve Compose"))

    def prepare(self):
        container = self.container()
        labels = container["Config"].get("Labels", {})
        if labels.get("com.docker.compose.project") != PROJECT or labels.get("com.docker.compose.service") != "web":
            raise DeployError("Unexpected Compose project or service.")
        workdir = labels.get("com.docker.compose.project.working_dir", "")
        files = labels.get("com.docker.compose.project.config_files", "").split(",")
        envfiles = [p for p in labels.get("com.docker.compose.project.environment_file", "").split(",") if p]
        if not workdir or not Path(workdir).is_dir() or not all(p and Path(p).is_file() for p in files + envfiles):
            raise DeployError("Active Compose/env file paths cannot be resolved; no container changed.")
        prefix = ["docker", "compose", "--project-directory", workdir, "-p", PROJECT]
        for envfile in envfiles:
            prefix += ["--env-file", envfile]
        base = prefix[:]
        for filename in files:
            base += ["-f", filename]
        before = self.config(base)
        assert_runtime_matches(before, container)

        # Drop old image-only overrides, but never discard other settings.
        kept = [p for p in files if not is_image_override(Path(p))]
        if not kept:
            raise DeployError("Missing base Compose file.")
        pruned = prefix[:]
        for filename in kept:
            pruned += ["-f", filename]
        pruned_config = self.config(pruned)
        assert_image_only(pruned_config, before, before["services"]["web"]["image"])

        self.root.mkdir(parents=True, exist_ok=True)
        self.release = self.root / (self.sha + "-auto-" + uuid.uuid4().hex[:12])
        self.release.mkdir(mode=0o700)
        (self.release / "before.compose.json").write_text(json.dumps(before, indent=2) + "\n")
        (self.release / "before.container.json").write_text(json.dumps(container, indent=2) + "\n")
        override = self.release / "image.override.json"
        override.write_text(json.dumps({"services": {"web": {"image": self.image}}}) + "\n")
        self.base, self.next = pruned, pruned + ["-f", str(override)]
        after = self.config(self.next)
        assert_image_only(before, after, self.image)
        (self.release / "next.compose.json").write_text(json.dumps(after, indent=2) + "\n")

        self.previous = container["Image"]
        old_revision = env_map(container).get("KMOVEMENT_RELEASE_SHA", "")
        self.previous_revision = old_revision if SHA.fullmatch(old_revision) else None
        # A fully resolved, private snapshot makes rollback independent of later env edits.
        old_override = self.release / "rollback.override.json"
        old_override.write_text(json.dumps({"services": {"web": {"image": self.previous}}}) + "\n")
        rollback_config = self.release / "rollback.compose.json"
        rollback_config.write_text(json.dumps(escape_compose_literals(before), indent=2) + "\n")
        self.rollback = ["docker", "compose", "--project-directory", workdir, "-p", PROJECT,
                         "-f", str(rollback_config), "-f", str(old_override)]
        (self.release / "rollback.sh").write_text(
            "#!/usr/bin/env bash\nset -euo pipefail\n" + shlex.join(self.up_command(self.rollback)) + "\n"
        )
        os.chmod(self.release / "rollback.sh", 0o700)
        self.record["previous_image_id"] = self.previous
        self.record["release_directory"] = str(self.release)
        self.status("prepared")
        print("Release record: " + str(self.release / "release.json"), flush=True)

    @staticmethod
    def up_command(base):
        return base + ["up", "-d", "--no-deps", "--no-build", "--pull", "never",
                       "--wait", "--wait-timeout", "120", "web"]

    def check_internal(self, container_id, expected_sha):
        # No AI generation, authentication change, or consent is involved in these GET checks.
        script = """
(async () => {
  for (const path of ['/', '/view/TOUR_EXPLORE', '/view/ROUTE_PLANNER']) {
    const response = await fetch('http://127.0.0.1:3000' + path, {signal: AbortSignal.timeout(8000)});
    if (response.status !== 200) process.exit(1);
  }
  const expected = process.argv[1];
  if (expected) {
    const response = await fetch('http://127.0.0.1:3000/health/release', {signal: AbortSignal.timeout(8000)});
    if (response.status !== 200 || (await response.json()).revision !== expected) process.exit(1);
  }
})().catch(() => process.exit(1));
"""
        self.command(["docker", "exec", container_id, "node", "-e", script, expected_sha or ""],
                     "Check internal pages and revision", timeout=40)

    def verify(self, image_id, expected_sha):
        container = self.container()
        if container["Image"] != image_id or container["State"].get("Health", {}).get("Status") != "healthy":
            raise DeployError("Running web image or health does not match the release.")
        self.check_internal(container["Id"], expected_sha)
        for attempt in range(12):
            try:
                if public_ok(expected_sha):
                    return
            except Exception:
                pass
            if attempt < 11:
                self.sleep(5)
        raise DeployError("Public pages or release revision did not match after retries.")

    def execute(self):
        self.prepare()
        self.command(["docker", "pull", self.image], "Pull digest-pinned image", timeout=240)
        image = self.json_command(["docker", "image", "inspect", self.image], "Inspect new image")[0]
        if image["Config"].get("Labels", {}).get("org.opencontainers.image.revision") != self.sha:
            raise DeployError("Pulled image revision does not match; no container changed.")
        if image["Config"].get("User") != "nextjs":
            raise DeployError("Unexpected image runtime user; no container changed.")
        if current_main() != self.sha:
            self.status("superseded")
            raise DeployError("main changed before replacement; no container changed.")
        try:
            self.changed = True  # Compose may have changed the container even if its command fails.
            self.status("replacing")
            self.command(self.up_command(self.next), "Replace web container", timeout=150)
            self.verify(image["Id"], self.sha)
            self.status("verified")
        except BaseException as failure:
            # Do not let a second disconnect/interrupt stop the recovery that is already in progress.
            for signum in INTERRUPTS:
                signal.signal(signum, signal.SIG_IGN)
            self.status("rolling_back")
            try:
                self.command(self.up_command(self.rollback), "Restore previous web container", timeout=150)
                self.verify(self.previous, self.previous_revision)
                self.status("rolled_back")
            except BaseException:
                self.status("rollback_failed")
                raise DeployError("Deployment AND rollback verification failed; operator action required.") from None
            raise DeployError("New web verification failed; previous image restored and verified.") from failure


def main():
    if len(sys.argv) != 3:
        raise DeployError("Usage: deploy_web.py <main-sha> <digest-pinned-image>")
    validate_inputs(sys.argv[1], sys.argv[2])
    if socket.gethostname() != HOSTNAME:
        raise DeployError("Unexpected server hostname; no container changed.")
    os.umask(0o077)
    import fcntl
    lock_path = RELEASE_ROOT.parent / ".web-deploy.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError("Another web deployment is running.") from None
        def interrupted(_signum, _frame):
            raise DeployError("Deployment interrupted.")
        for signum in INTERRUPTS:
            signal.signal(signum, interrupted)
        deployment = Deployment(sys.argv[1], sys.argv[2])
        try:
            deployment.execute()
        except BaseException:
            if not deployment.changed and deployment.record["status"] != "superseded":
                deployment.status("failed_before_replace")
            raise


if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        # Deliberately avoid printing exception payloads from subprocess/network/config parsers.
        print(str(error) if isinstance(error, DeployError) else "Deployment failed before verified completion.", file=sys.stderr)
        sys.exit(1)
