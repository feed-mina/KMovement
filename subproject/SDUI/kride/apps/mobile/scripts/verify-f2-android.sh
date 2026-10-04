#!/usr/bin/env bash
set -Eeuo pipefail

artifact_dir="${GITHUB_WORKSPACE}/artifacts/f2-android"
mkdir -p "$artifact_dir"

capture() {
  adb exec-out screencap -p > "$artifact_dir/screen.png" 2>/dev/null || true
  adb logcat -d -t 1200 > "$artifact_dir/logcat.txt" 2>/dev/null || true
  adb shell uiautomator dump /sdcard/f2-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/f2-window.xml "$artifact_dir/window.xml" >/dev/null 2>&1 || true
}
trap capture EXIT

cd "${GITHUB_WORKSPACE}/subproject/SDUI/kride/apps/mobile"
chmod +x android/gradlew
(
  cd android
  ./gradlew --no-daemon :app:assembleRelease
)

apk="android/app/build/outputs/apk/release/app-release.apk"
test -f "$apk"
adb install -r "$apk"
adb shell am force-stop com.kride.mobile
adb shell am start -W -a android.intent.action.VIEW -d 'kride://f2-address-check' com.kride.mobile

dump_ui() {
  adb shell uiautomator dump /sdcard/f2-window.xml >/dev/null
  adb pull /sdcard/f2-window.xml "$artifact_dir/window.xml" >/dev/null
}

wait_for_value() {
  local needle="$1"
  for attempt in $(seq 1 45); do
    dump_ui
    if grep -Fq "$needle" "$artifact_dir/window.xml"; then
      printf 'found "%s" on attempt %s\n' "$needle" "$attempt"
      return 0
    fi
    sleep 2
  done
  printf 'did not find "%s"\n' "$needle" >&2
  return 1
}

tap_value() {
  local needle="$1"
  dump_ui
  python3 - "$artifact_dir/window.xml" "$needle" <<'PY'
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

path, needle = sys.argv[1:]
root = ET.parse(path).getroot()
nodes = list(root.iter("node"))
for exact in (True, False):
  for node in nodes:
    values = (node.attrib.get("text", ""), node.attrib.get("content-desc", ""))
    matched = any(value == needle for value in values) if exact else any(needle in value for value in values)
    if matched:
        match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
        if match:
            left, top, right, bottom = map(int, match.groups())
            subprocess.run(["adb", "shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2)], check=True)
            raise SystemExit(0)
raise SystemExit(f"UI node not found: {needle}")
PY
}

wait_for_value '주소 검색'
tap_value '검색'
wait_for_value '테헤란로 152'
tap_value '테헤란로 152'
wait_for_value '선택 완료: 06236 서울 강남구 테헤란로 152'

capture
printf 'android_f2_search_select=passed\n' | tee "$artifact_dir/result.txt"
