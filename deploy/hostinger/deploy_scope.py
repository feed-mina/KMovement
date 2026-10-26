"""Compute an explicit deployment plan for the entire push, including deleted paths."""
import argparse
import json
from pathlib import Path
import re
import subprocess

SHA = re.compile(r"[0-9a-f]{40}")


def classify(paths):
    result = dict(web=False, media=False, spring_manual=False,
                  gpu_manual=False, private_video_manual=False)
    for path in paths:
        if (path.startswith("subproject/SDUI/metadata-project/") or
            path in {".github/workflows/hostinger-web-deploy.yml",
                     "deploy/hostinger/deploy_web.py", "deploy/hostinger/setup_ci_ssh.sh",
                     "deploy/hostinger/web.compose.yml", "deploy/hostinger/web.traefik.compose.yml",
                     "deploy/hostinger/f11-web.override.yml", "deploy/hostinger/Caddyfile"}):
            result["web"] = True
        if (path.startswith("deploy/cloud_gateway/") or
            path in {".github/workflows/hostinger-media-deploy.yml",
                     "deploy/hostinger/deploy_media.py", "deploy/hostinger/media.compose.yml"}):
            result["media"] = True
        if (path.startswith("subproject/SDUI/SDUI-server/") or
            path == "deploy/hostinger/media-spring.override.yml"):
            result["spring_manual"] = True
        if path.startswith("deploy/media_motion/"):
            result["gpu_manual"] = True
        if path.startswith("deploy/photo_video/"):
            result["private_video_manual"] = True
    return result


def plan(base, head):
    if not SHA.fullmatch(base) or not SHA.fullmatch(head):
        raise ValueError("Invalid push revision")
    if base == "0" * 40:
        raw = subprocess.check_output(["git", "ls-tree", "-rz", "--name-only", head])
    else:
        # A missing base is an error, never an implicit deploy-everything fallback.
        subprocess.run(["git", "merge-base", "--is-ancestor", base, head], check=True)
        raw = subprocess.check_output(["git", "diff", "--no-renames", "--name-only", "-z", base, head])
    paths = [p.decode("utf-8") for p in raw.split(b"\0") if p]
    return {"schema": 1, "base": base, "sha": head, "targets": classify(paths)}


def enabled(document, sha, component):
    if document.get("schema") != 1 or document.get("sha") != sha or not SHA.fullmatch(sha):
        raise ValueError("Deployment plan does not match the verified revision")
    if not SHA.fullmatch(document.get("base", "")):
        raise ValueError("Invalid plan base")
    targets = document.get("targets", {})
    if component not in {"web", "media"} or type(targets.get(component)) is not bool:
        raise ValueError("Invalid deployment target")
    return targets[component]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base")
    parser.add_argument("--sha", required=True)
    parser.add_argument("--output")
    parser.add_argument("--read")
    parser.add_argument("--component", choices=["web", "media"])
    args = parser.parse_args()
    if args.read:
        selected = enabled(json.loads(Path(args.read).read_text()), args.sha, args.component)
        print("enabled=" + str(selected).lower())
    else:
        data = plan(args.base, args.sha)
        Path(args.output).write_text(json.dumps(data, indent=2) + "\n")
        print(json.dumps(data["targets"], sort_keys=True))


if __name__ == "__main__":
    main()
