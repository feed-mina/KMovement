#!/usr/bin/env python3
"""Deploy ONLY the internal media relay. No POST requests, GPU or private workers."""
from __future__ import annotations
import copy
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys
import urllib.request
import uuid

PROJECT = "kmovement-media"
SERVICE = "media-gateway"
ROOT = Path("/docker/kmovement-media")
SHA = re.compile(r"[0-9a-f]{40}")
IMAGE = re.compile(r"ghcr\.io/feed-mina/kmovement-media@sha256:[0-9a-f]{64}")


class DeployError(RuntimeError):
    pass


def literals(value, restore=False):
    if isinstance(value, str):
        return value.replace("$$", "$") if restore else value.replace("$", "$$")
    if isinstance(value, list):
        return [literals(item, restore) for item in value]
    if isinstance(value, dict):
        return {key: literals(item, restore) for key, item in value.items()}
    return value


def validate_config(config):
    if set(config.get("services", {})) != {SERVICE}:
        raise DeployError("Media deployment may contain only media-gateway.")
    service = config["services"][SERVICE]
    if service.get("command") or service.get("entrypoint"):
        raise DeployError("Relay startup command must come from the verified relay image.")
    if service.get("ports") or service.get("privileged") or service.get("network_mode") == "host":
        raise DeployError("Media relay must remain internal.")
    labels = service.get("labels", {})
    if str(labels.get("traefik.enable", "")).lower() != "false":
        raise DeployError("Public relay routing is not allowed.")
    env = service.get("environment", {})
    if env.get("KRIDE_MODEL_GENERATION_ENABLED") != "false":
        raise DeployError("Local model generation must remain disabled.")
    if not env.get("FASTAPI_INTERNAL_API_KEY") or not env.get("RUNPOD_API_KEY") or not env.get("RUNPOD_MEDIA_ENDPOINT_ID"):
        raise DeployError("Configure the private relay environment before deployment.")
    if not service.get("healthcheck"):
        raise DeployError("Relay healthcheck is required.")


def current_main():
    request = urllib.request.Request(
        "https://api.github.com/repos/feed-mina/KMovement/git/ref/heads/main",
        headers={"User-Agent": "KMovement-media-deploy", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)["object"]["sha"]


class Deployment:
    def __init__(self, sha, image, compose, root=ROOT):
        if not SHA.fullmatch(sha) or not IMAGE.fullmatch(image):
            raise DeployError("Invalid release revision or media image.")
        self.sha, self.image, self.compose, self.root = sha, image, Path(compose), Path(root)
        self.release = None
        self.changed = False
        self.rollback = None
        self.previous_image = None
        self.record = {"source_sha": sha, "image": image, "status": "preparing"}

    def command(self, args, stage, timeout=90):
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        if result.returncode:
            # stdout/stderr may contain resolved environment; never print either.
            raise DeployError(stage + " failed; inspect the server privately.")
        return result.stdout.strip()

    def read_json(self, args, stage):
        return json.loads(self.command(args, stage))

    def status(self, state):
        self.record["status"] = state
        try:
            if self.release:
                (self.release / "release.json").write_text(json.dumps(self.record, indent=2) + "\n")
        except OSError:
            pass  # Logging must not prevent rollback.
        try:
            print("Hostinger media: " + state, flush=True)
        except OSError:
            pass

    def container(self):
        ids = self.command(["docker", "ps", "-a",
                            "--filter", "label=com.docker.compose.project=" + PROJECT,
                            "--filter", "label=com.docker.compose.service=" + SERVICE,
                            "--format", "{{.ID}}"], "Find media container").splitlines()
        if len(ids) > 1:
            raise DeployError("Multiple media containers; no service changed.")
        return self.read_json(["docker", "inspect", ids[0]], "Inspect media")[0] if ids else None

    def config(self, prefix):
        return literals(self.read_json(prefix + ["config", "--format", "json"], "Resolve media Compose"), True)

    @staticmethod
    def up(prefix):
        return prefix + ["up", "-d", "--no-deps", "--no-build", "--pull", "never",
                         "--wait", "--wait-timeout", "120", SERVICE]

    def prepare(self):
        envfile = self.root / "runtime.env"
        if not envfile.is_file() or envfile.stat().st_mode & 0o077:
            raise DeployError("Create private /docker/kmovement-media/runtime.env with mode 0600 first.")
        if not self.compose.is_file():
            raise DeployError("Missing release Compose file.")
        self.release = self.root / "releases" / (self.sha + "-" + uuid.uuid4().hex[:12])
        self.release.mkdir(parents=True, mode=0o700)
        before = self.container()
        if before:
            labels = before["Config"].get("Labels", {})
            files = labels.get("com.docker.compose.project.config_files", "").split(",")
            # Keep recovery restricted to this dedicated deployment directory.
            if not all(p and Path(p).is_file() and Path(p).resolve().is_relative_to(self.root.resolve()) for p in files):
                raise DeployError("Cannot resolve existing media Compose; no service changed.")
            prefix = ["docker", "compose", "--project-directory", str(self.root), "-p", PROJECT,
                      "--env-file", str(envfile)]
            envfiles = [p for p in labels.get("com.docker.compose.project.environment_file", str(envfile)).split(",") if p]
            if not all(Path(p).is_file() and Path(p).resolve().is_relative_to(self.root.resolve()) for p in envfiles):
                raise DeployError("Cannot resolve existing media environment files.")
            prefix = ["docker", "compose", "--project-directory", str(self.root), "-p", PROJECT]
            for file in envfiles:
                prefix += ["--env-file", file]
            for file in files:
                prefix += ["-f", file]
            old_config = self.config(prefix)
            validate_config(old_config)
            old_service = old_config["services"][SERVICE]
            actual = dict(item.split("=", 1) for item in before["Config"].get("Env", []) if "=" in item)
            if (old_service["image"] != before["Config"]["Image"] or
                any(actual.get(k) != str(v) for k, v in old_service.get("environment", {}).items())):
                raise DeployError("Media runtime differs from Compose; no service changed.")
            self.previous_image = before["Image"]
            old_config["services"][SERVICE]["image"] = self.previous_image
            snapshot = self.release / "rollback.compose.json"
            snapshot.write_text(json.dumps(literals(old_config)) + "\n")
            self.rollback = ["docker", "compose", "--project-directory", str(self.root),
                             "-p", PROJECT, "-f", str(snapshot)]
        override = self.release / "image.override.json"
        override.write_text(json.dumps({"services": {SERVICE: {"image": self.image}}}) + "\n")
        image_env = self.release / "image.env"
        image_env.write_text("KMOVEMENT_MEDIA_IMAGE=" + self.image + "\n")
        self.next = ["docker", "compose", "--project-directory", str(self.root), "-p", PROJECT,
                     "--env-file", str(envfile), "--env-file", str(image_env), "-f", str(self.compose), "-f", str(override)]
        config = self.config(self.next)
        validate_config(config)
        if config["services"][SERVICE]["image"] != self.image:
            raise DeployError("Media image override did not apply.")
        self.status("prepared")

    def verify(self, image_id):
        container = self.container()
        if (not container or container["Image"] != image_id or
            container["State"].get("Health", {}).get("Status") != "healthy"):
            raise DeployError("Media image or health verification failed.")
        # GET health and unauthenticated GET only. NEVER submit generation jobs.
        script = """import json,urllib.request,urllib.error
with urllib.request.urlopen('http://127.0.0.1:7860/health',timeout=5) as r:
    assert r.status == 200
try:
    urllib.request.urlopen('http://127.0.0.1:7860/jobs/runpod/auth-probe',timeout=5)
except urllib.error.HTTPError as e:
    assert e.code == 401
else:
    raise RuntimeError('Missing internal authentication')
"""
        self.command(["docker", "exec", container["Id"], "python", "-c", script],
                     "Verify relay health and internal authentication", timeout=20)

    def execute(self):
        self.prepare()
        self.command(["docker", "pull", self.image], "Pull media image", timeout=240)
        image = self.read_json(["docker", "image", "inspect", self.image], "Inspect media image")[0]
        if image["Config"].get("Labels", {}).get("org.opencontainers.image.revision") != self.sha:
            raise DeployError("Image does not match the verified source revision.")
        if current_main() != self.sha:
            self.status("superseded")
            raise DeployError("Newer main exists; media container was not changed.")
        try:
            self.changed = True
            self.status("replacing")
            self.command(self.up(self.next), "Replace only media relay", timeout=150)
            self.verify(image["Id"])
            self.status("verified")
        except BaseException as failure:
            for name in ("SIGTERM", "SIGHUP", "SIGINT"):
                if hasattr(signal, name):
                    signal.signal(getattr(signal, name), signal.SIG_IGN)
            self.status("rolling_back")
            try:
                if self.rollback:
                    self.command(self.up(self.rollback), "Restore previous media relay", timeout=150)
                    self.verify(self.previous_image)
                    self.status("rolled_back")
                else:
                    self.command(self.next + ["stop", SERVICE], "Stop failed first relay")
                    self.status("first_install_stopped")
            except BaseException:
                self.status("rollback_failed")
                raise DeployError("Media deployment and recovery failed; operator action required.") from None
            raise DeployError("Media deployment failed; recovery completed.") from failure


def main():
    if len(sys.argv) != 4:
        raise DeployError("Usage: deploy_media.py <sha> <image> <compose>")
    if socket.gethostname() != "srv1869569":
        raise DeployError("Unexpected server; no service changed.")
    os.umask(0o077)
    ROOT.mkdir(parents=True, exist_ok=True)
    import fcntl
    with (ROOT / ".deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError("Another media deployment is running.") from None
        def interrupted(_signum, _frame):
            raise DeployError("Media deployment interrupted.")
        for name in ("SIGTERM", "SIGHUP", "SIGINT"):
            if hasattr(signal, name):
                signal.signal(getattr(signal, name), interrupted)
        deployment = Deployment(*sys.argv[1:])
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
        print(str(error) if isinstance(error, DeployError) else "Media deployment failed.",
              file=sys.stderr)
        sys.exit(1)
