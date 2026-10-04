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

wait_for_clickable_value() {
  local needle="$1"
  local attempts="${2:-45}"
  for attempt in $(seq 1 "$attempts"); do
    dump_ui
    if python3 - "$artifact_dir/window.xml" "$needle" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, needle = sys.argv[1:]
root = ET.parse(path).getroot()
matched = any(
    node.attrib.get("clickable") == "true"
    and needle in node.attrib.get("content-desc", "")
    for node in root.iter("node")
)
raise SystemExit(0 if matched else 1)
PY
    then
      printf 'found clickable "%s" on attempt %s\n' "$needle" "$attempt"
      return 0
    fi
    sleep 2
  done
  printf 'did not find clickable "%s"\n' "$needle" >&2
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
passes = (
    ("content-desc", True, True),
    ("content-desc", True, False),
    ("text", False, True),
    ("text", False, False),
)
for attribute, require_clickable, exact in passes:
  for node in nodes:
    value = node.attrib.get(attribute, "")
    matched = value == needle if exact else needle in value
    clickable = node.attrib.get("clickable") == "true"
    if matched and (not require_clickable or clickable):
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
if ! wait_for_clickable_value '테헤란로 152' 15; then
  dump_ui
  if grep -Fq '네트워크 오류' "$artifact_dir/window.xml"; then
    printf 'retrying the address search after a transient network error\n'
    tap_value '검색'
  fi
  wait_for_clickable_value '테헤란로 152'
fi
tap_value '테헤란로 152'
wait_for_value '선택 완료: 06236 서울 강남구 테헤란로 152'

capture
printf 'android_f2_search_select=passed\n' | tee "$artifact_dir/result.txt"
