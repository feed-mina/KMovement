"""Read-only SMTP configuration audit. Never print passwords or send mail."""
import json
import pathlib
import socket
import subprocess
import sys


def docker(*args):
    result = subprocess.run(["docker", *args], capture_output=True, text=True, check=True)
    return result.stdout


def configured(value):
    return bool(value and value.strip() and value.strip() not in {
        "disabled", "disabled@localhost", "change-me-local"
    })


def main():
    if socket.gethostname() != "srv1869569":
        raise RuntimeError("Run this on the KMovement Hostinger VPS srv1869569.")
    ids = docker("ps", "-q", "--filter", "label=com.docker.compose.project=kmovement-g1",
                 "--filter", "label=com.docker.compose.service=spring").split()
    if len(ids) != 1:
        raise RuntimeError("Expected exactly one running kmovement-g1 spring container.")
    container = json.loads(docker("inspect", ids[0]))[0]
    env = dict(item.split("=", 1) for item in container["Config"].get("Env", []) if "=" in item)
    secrets = {}
    for mount in container.get("Mounts", []):
        destination = mount.get("Destination", "")
        if destination in ("/run/secrets/spring.mail.username", "/run/secrets/spring.mail.password"):
            secrets[pathlib.PurePosixPath(destination).name] = pathlib.Path(mount["Source"]).read_text().strip()
    # Direct Spring variables override imported properties; MAIL_* are YAML fallbacks.
    username = env.get("SPRING_MAIL_USERNAME", secrets.get("spring.mail.username", env.get("MAIL_USERNAME", "")))
    password = env.get("SPRING_MAIL_PASSWORD", secrets.get("spring.mail.password", env.get("MAIL_PASSWORD", "")))
    print(json.dumps({
        "container": container["Name"].lstrip("/"),
        "mail_username_supplied": configured(username),
        "mail_password_supplied": configured(password),
        "mail_username_secret_mounted": "spring.mail.username" in secrets,
        "mail_password_secret_mounted": "spring.mail.password" in secrets,
        "note": "Read-only check. Credentials were not printed. No mail was sent. SMTP login was not tested."
    }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Do not emit Docker inspect output or exception details containing configuration.
        print("Mail audit failed. Check VPS hostname, Docker access and the spring container.", file=sys.stderr)
        sys.exit(1)
