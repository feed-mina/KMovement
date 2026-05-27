"""
Local RunPod handler test script.
Usage:
    1. Start handler: python -m deploy.media_motion.runpod_handler --rp_serve_api --rp_api_port 8888
    2. Run this:      python deploy/media_motion/test_local.py
    3. GPU tests:     python deploy/media_motion/test_local.py cogvideox_real musicgen
"""
import base64
import json
import sys
import time
from pathlib import Path

import httpx

BASE_URL = "http://localhost:8888"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEST_IMAGE = PROJECT_ROOT / "report" / "gangneung_beach.jpg"

PASS_COUNT = 0
FAIL_COUNT = 0


def _print_result(result: dict) -> bool:
    global PASS_COUNT, FAIL_COUNT
    status = result.get("status", "")
    if status == "COMPLETED":
        output = result.get("output", {})
        print(f"  Route: {output.get('route')}")
        print(f"  Result: {output.get('status')}")
        if output.get("fallback_reason"):
            print(f"  Fallback reason: {output['fallback_reason'][:100]}")
        for a in output.get("artifacts", []):
            has_data = "yes" if a.get("data_base64") else "no"
            print(f"    {a.get('kind')}: {a.get('size_mb', 0)} MB (base64: {has_data})")
        print("  >>> PASS <<<")
        PASS_COUNT += 1
        return True
    else:
        print(f"  Error: {result.get('error', 'unknown')[:200]}")
        print("  >>> FAIL <<<")
        FAIL_COUNT += 1
        return False


def _send(payload: dict, timeout: int = 120) -> dict:
    resp = httpx.post(f"{BASE_URL}/runsync", json={"input": payload}, timeout=timeout)
    return resp.json()


def test_tts():
    """Test gTTS fallback (CPU, no GPU needed)."""
    print("\n=== Test: gpt_sovits_tts (gTTS fallback) ===")
    result = _send({
        "route": "gpt_sovits_tts",
        "case_id": "local_tts_test",
        "tts_text": "강릉 해변의 아름다운 풍경을 소개합니다.",
    })
    _print_result(result)


def test_cogvideo_fallback():
    """Test FFmpeg photo-motion fallback (CPU, no GPU needed)."""
    print("\n=== Test: cogvideo_fallback (FFmpeg photo-motion) ===")
    if not TEST_IMAGE.exists():
        print(f"  SKIP: {TEST_IMAGE}")
        return
    result = _send({
        "route": "cogvideo_fallback",
        "case_id": "local_cogvideo_test",
        "place": "Gangneung Beach",
        "image_base64": base64.b64encode(TEST_IMAGE.read_bytes()).decode(),
        "tts_text": "강릉 해변의 아름다운 풍경입니다.",
        "bgm_key": "bright_travel",
    })
    _print_result(result)


def test_3d_photo_light():
    """Test lightweight 3D photo pan/zoom (CPU, no GPU needed)."""
    print("\n=== Test: 3d_photo_light (FFmpeg zoompan) ===")
    if not TEST_IMAGE.exists():
        print(f"  SKIP: {TEST_IMAGE}")
        return
    result = _send({
        "route": "3d_photo_light",
        "case_id": "local_3d_test",
        "place": "Gangneung Beach",
        "image_base64": base64.b64encode(TEST_IMAGE.read_bytes()).decode(),
        "tts_text": "아름다운 해변 풍경입니다.",
        "motion": "gentle_dolly",
    })
    _print_result(result)


def test_cogvideox_real():
    """Test CogVideoX image-to-video (GPU required, ~10-15 min)."""
    print("\n=== Test: cogvideox_real (GPU - CogVideoX) ===")
    if not TEST_IMAGE.exists():
        print(f"  SKIP: {TEST_IMAGE}")
        return
    print("  This test requires GPU and takes 10-15 minutes...")
    print("  With allow_fallback=true, falls back to FFmpeg if no GPU.")
    result = _send({
        "route": "cogvideox_real",
        "case_id": "local_cogvideox_test",
        "place": "Gangneung Beach",
        "image_base64": base64.b64encode(TEST_IMAGE.read_bytes()).decode(),
        "tts_text": "강릉 해변의 아름다운 풍경을 AI 영상으로 만들었습니다.",
        "prompt": "A cinematic travel video of Gangneung Beach with gentle waves and golden sunset.",
        "allow_fallback": True,
    }, timeout=1200)
    _print_result(result)


def test_musicgen():
    """Test MusicGen BGM generation (GPU or sine-wave fallback)."""
    print("\n=== Test: musicgen (MusicGen / sine-wave fallback) ===")
    result = _send({
        "route": "musicgen",
        "case_id": "local_musicgen_test",
        "musicgen_description": "calm Korean traditional ambient music, gayageum, peaceful travel",
        "musicgen_duration": 10,
        "allow_fallback": True,
    }, timeout=600)
    _print_result(result)


ALL_TESTS = {
    "tts": test_tts,
    "cogvideo": test_cogvideo_fallback,
    "3d": test_3d_photo_light,
    "cogvideox_real": test_cogvideox_real,
    "musicgen": test_musicgen,
}

CPU_TESTS = ["tts", "cogvideo", "3d", "musicgen"]
GPU_TESTS = ["cogvideox_real"]

if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else CPU_TESTS

    if targets == ["all"]:
        targets = list(ALL_TESTS.keys())
    elif targets == ["gpu"]:
        targets = GPU_TESTS
    elif targets == ["cpu"]:
        targets = CPU_TESTS

    print(f"Running tests: {', '.join(targets)}")
    print(f"Server: {BASE_URL}")
    start = time.time()

    for name in targets:
        if name in ALL_TESTS:
            try:
                ALL_TESTS[name]()
            except Exception as e:
                print(f"  EXCEPTION: {e}")
                FAIL_COUNT += 1
        else:
            print(f"\nUnknown test: {name}")
            print(f"Available: {', '.join(ALL_TESTS.keys())}")
            print("Shortcuts: cpu, gpu, all")

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Results: {PASS_COUNT} PASS / {FAIL_COUNT} FAIL ({elapsed:.1f}s)")
    print(f"{'='*60}")
