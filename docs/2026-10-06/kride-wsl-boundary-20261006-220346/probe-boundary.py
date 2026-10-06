"""Collect a disposable WSL boundary probe; never opens project data or a model."""

from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


OUT = Path(__file__).with_name("boundary-evidence.json")
DISTRO = "Ubuntu-24.04"


def run(args: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)


def wsl(*args: str) -> subprocess.CompletedProcess[str]:
    return run(["wsl.exe", "-d", DISTRO, "-u", "root", "--exec", *args])


def parse_json_result(process: subprocess.CompletedProcess[str], label: str) -> dict:
    if process.returncode:
        raise RuntimeError(f"{label} failed: {process.returncode}: {process.stderr[-400:]}")
    return json.loads(process.stdout)


baseline_program = r'''
import hashlib,json,os
from pathlib import Path
c=Path('/etc/wsl.conf').read_bytes()
mounts=Path('/proc/self/mounts').read_text()
print(json.dumps({'uid':os.getuid(),'netns':os.readlink('/proc/self/ns/net'),
 'configText':c.decode(),'configSha256':hashlib.sha256(c).hexdigest(),
 'drvfsMounts':[x.split()[1] for x in mounts.splitlines() if ' drvfs ' in x],
 'windowsDriveMounts':[x.split()[1] for x in mounts.splitlines() if x.split()[1].lower() in ('/mnt/c','/mnt/d')],
 'wslInteropEnvPresent':'WSL_INTEROP' in os.environ}))
'''

probe_program = r'''
import errno,json,os,socket,stat
from pathlib import Path
status=Path('/proc/self/status').read_text().splitlines()
caps={k:v.strip() for k,v in (x.split(':',1) for x in status if x.startswith(('CapEff:','CapBnd:','NoNewPrivs:')))}
mounts=Path('/proc/self/mounts').read_text().splitlines()
s=socket.socket();s.settimeout(2)
try: result=s.connect_ex(('192.0.2.1',443))
finally: s.close()
print(json.dumps({'uid':os.getuid(),'gid':os.getgid(),'netns':os.readlink('/proc/self/ns/net'),
 'mntns':os.readlink('/proc/self/ns/mnt'),'caps':caps,'environmentKeys':sorted(os.environ),
 'drvfsMounts':[x.split()[1] for x in mounts if ' drvfs ' in x],
 'windowsDriveMounts':[x.split()[1] for x in mounts if x.split()[1].lower() in ('/mnt/c','/mnt/d')],
 'routeRows':len(Path('/proc/net/route').read_text().splitlines()),
 'egressConnectErrno':result,'expectedNetworkUnreachable':errno.ENETUNREACH,
 'windowsCmdPathPresent':Path('/mnt/c/Windows/System32/cmd.exe').exists(),
 'hostProjectPathPresent':Path('/mnt/d/KMovement').exists(),
 'wslBridgePathsPresent':{p:Path(p).exists() for p in ('/mnt/wsl','/mnt/wslg','/usr/lib/wsl/drivers','/usr/lib/wsl/lib','/tmp/.X11-unix/.X11-unix')},
 'wslInitMasked':stat.S_ISCHR(Path('/init').stat().st_mode)}))
'''

isolation_shell = r'''
/usr/bin/mount -t tmpfs -o mode=0555,nodev,nosuid,noexec tmpfs /mnt
/usr/bin/mount -t tmpfs -o mode=0555,nodev,nosuid,noexec tmpfs /usr/lib/wsl
/usr/bin/mount -t tmpfs -o mode=0555,nodev,nosuid,noexec tmpfs /tmp/.X11-unix
/usr/bin/mount --bind /dev/null /init
exec /usr/bin/setpriv --reuid kride-probe --regid kride-probe --clear-groups --bounding-set=-all --no-new-privs \
  /usr/bin/env -i PATH=/usr/bin:/bin HOME=/home/kride-probe LANG=C.UTF-8 /usr/bin/python3 -c "$1"
'''

restart = run(["wsl.exe", "--terminate", DISTRO])
if restart.returncode:
    raise RuntimeError(f"restart failed: {restart.stderr[-400:]}")
base = parse_json_result(wsl("/usr/bin/python3", "-c", baseline_program), "baseline")
candidate = parse_json_result(
    wsl(
        "/usr/bin/unshare", "--net", "--mount", "--propagation", "private", "--fork", "--",
        "/bin/sh", "-eu", "-c", isolation_shell, "probe", probe_program,
    ), "unprivileged isolated process"
)
checks = {
    "distroConfigDisablesHostMountAndInterop": "enabled=false" in base["configText"] and "mountFsTab=false" in base["configText"] and "[interop]\nenabled=false" in base["configText"],
    "hostDrivesAbsentAfterRestart": not base["drvfsMounts"] and not base["windowsDriveMounts"],
    "freshNetworkNamespace": base["netns"] != candidate["netns"],
    "unprivilegedNoCapabilities": candidate["uid"] == 999 and candidate["gid"] == 989 and candidate["caps"].get("CapEff") == "0000000000000000" and candidate["caps"].get("CapBnd") == "0000000000000000" and candidate["caps"].get("NoNewPrivs") == "1",
    "allowlistedEnvironmentOnly": candidate["environmentKeys"] == ["HOME", "LANG", "PATH"],
    "noHostDriveMountsInProcess": not candidate["drvfsMounts"] and not candidate["windowsDriveMounts"] and not candidate["windowsCmdPathPresent"] and not candidate["hostProjectPathPresent"],
    "WSLBridgesMaskedInProcess": not any(candidate["wslBridgePathsPresent"].values()) and candidate["wslInitMasked"],
    "noNetworkRouteOrEgress": candidate["routeRows"] == 0 and candidate["egressConnectErrno"] == candidate["expectedNetworkUnreachable"],
}
result = {
    "checkedAtUTC": datetime.now(timezone.utc).isoformat(),
    "distro": DISTRO,
    "testType": "synthetic boundary probe only; no POI, model, Chroma, or pilot search",
    "baseline": base,
    "isolatedProcess": candidate,
    "checks": checks,
    "boundaryProbePassed": all(checks.values()),
    "actualPilotExecutionAuthorized": False,
    "linuxRuntimePinned": False,
    "originalOrProductionDatabaseConnected": False,
}
OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
stopped = run(["wsl.exe", "--terminate", DISTRO])
result["distroTerminatedAfterProbe"] = stopped.returncode == 0
OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"checks": checks, "boundaryProbePassed": result["boundaryProbePassed"], "distroTerminatedAfterProbe": result["distroTerminatedAfterProbe"]}, ensure_ascii=False))
if not result["boundaryProbePassed"] or not result["distroTerminatedAfterProbe"]:
    raise SystemExit(1)
