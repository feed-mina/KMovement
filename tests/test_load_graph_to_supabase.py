"""그래프 → Supabase 적재 경로의 안전장치 검증.

이 스크립트는 운영 데이터에 쓴다. 그리고 그 쓰기는 "기존 행을 읽어 없는 것만
넣는다"에 기대고 있다. 읽기가 조용히 막히면 판정 자체가 무너져 중복이 들어간다.
그 조건을 코드로 고정해 둔다.
"""
from __future__ import annotations

import base64
import importlib.util
import json
from pathlib import Path

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "load_graph_to_supabase.py"
WORKFLOW = ROOT / ".github" / "workflows" / "load-graph-to-supabase.yml"
DEPLOY_SCRIPT = ROOT / "deploy" / "ec2" / "deploy.sh"


def _module():
    spec = importlib.util.spec_from_file_location("load_graph_to_supabase", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _jwt(role: str) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps({"role": role}).encode()
    ).decode().rstrip("=")
    return f"eyJhbGciOiJIUzI1NiJ9.{payload}.signature"


# ── 키 분류 ──────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "key, expected",
    [
        ("", "missing"),
        ("sb_secret_abc", "secret"),
        ("sb_publishable_abc", "publishable"),
        (_jwt("service_role"), "legacy-service_role"),
        (_jwt("anon"), "legacy-anon"),
        ("eyJnot-a-jwt", "legacy-unknown"),
        ("something-else", "unknown"),
    ],
)
def test_key_kinds_are_classified(key: str, expected: str) -> None:
    assert _module().supabase_key_kind(key) == expected


def test_classification_matches_the_deploy_probe() -> None:
    """배포 진단과 분류가 어긋나면 안 된다.

    진단이 'publishable' 이라고 말한 키로 여기서 쓰기가 통과하면, 두 곳이 같은
    키를 서로 다르게 판정한다는 뜻이다.
    """
    deploy = DEPLOY_SCRIPT.read_text(encoding="utf-8")
    for marker in ('"sb_secret_"', '"sb_publishable_"', '"legacy-"'):
        assert marker in deploy, marker
        assert marker in SCRIPT.read_text(encoding="utf-8"), marker


def test_the_key_value_never_reaches_the_log() -> None:
    """워크플로 로그는 공개다. 종류만 찍고 값은 찍지 않는다."""
    text = SCRIPT.read_text(encoding="utf-8")
    assert "print(f\"SUPABASE_KEY 종류: {key_kind}\")" in text
    assert "print(key" not in text


# ── 쓰기 거부 ────────────────────────────────────────────────────────────────
def test_only_secret_keys_may_write() -> None:
    """RLS 를 적용받는 키로는 쓰지 않는다.

    읽기가 막히면 existing_edges 가 비고, 그러면 이미 있는 엣지가 전부 '새 행'이
    되어 통째로 중복 삽입된다. nodes 는 PK upsert 라 멱등하지만 edges 는 아니다.
    """
    writable = _module().WRITABLE_KEY_KINDS

    assert "secret" in writable
    assert "legacy-service_role" in writable
    for blocked in ("publishable", "legacy-anon", "missing", "unknown", "legacy-unknown"):
        assert blocked not in writable


def test_apply_exits_before_creating_a_client_with_a_browser_safe_key(monkeypatch, capsys) -> None:
    """거부는 접속보다 먼저 일어나야 한다. 뒤에 있으면 이미 조회가 돈다."""
    mod = _module()
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "sb_publishable_abc")
    monkeypatch.setattr("sys.argv", ["load_graph_to_supabase.py", "--apply", "--limit", "1"])

    # supabase 패키지가 있든 없든, 거부가 먼저면 import 에 닿지 않는다.
    with pytest.raises(SystemExit) as exit_info:
        mod.main()

    assert "쓰기를 거부한다" in str(exit_info.value)
    assert "sb_secret_" in str(exit_info.value)


def test_dry_run_does_not_need_a_secret_key(monkeypatch) -> None:
    """현황 확인까지 막으면 무엇이 있는지 볼 방법이 없다.

    browser-safe 키로도 dry-run 은 통과해 접속 단계까지 가야 한다. 그래야
    "0건인데 이 키로는 확신할 수 없다"는 판단 자체를 할 수 있다.
    """
    import sys
    import types

    mod = _module()
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "sb_publishable_abc")
    monkeypatch.setattr("sys.argv", ["load_graph_to_supabase.py", "--limit", "1"])

    reached = RuntimeError("create_client 까지 도달했다")
    fake = types.ModuleType("supabase")
    fake.create_client = lambda *a, **k: (_ for _ in ()).throw(reached)
    monkeypatch.setitem(sys.modules, "supabase", fake)

    with pytest.raises(RuntimeError) as exit_info:
        mod.main()

    assert exit_info.value is reached


# ── 행 변환 ──────────────────────────────────────────────────────────────────
def test_edge_rows_use_the_real_relationship_key() -> None:
    """그래프 파일은 relationship 을 쓴다. 기본값으로 FILMING_AT 을 넣지 않는다."""
    mod = _module()
    row = mod.to_edge_row({"relationship": "NEAR", "source": "poi_1", "target": "poi_2"})

    assert row == {
        "source_id": "poi_1",
        "target_id": "poi_2",
        "relation_type": "NEAR",
        "weight": 1.0,
    }


def test_edge_without_a_relationship_is_rejected() -> None:
    """조용히 FILMING_AT 으로 채우면 잘못된 관계가 운영에 들어간다."""
    with pytest.raises(ValueError):
        _module().to_edge_row({"source": "poi_1", "target": "poi_2"})


def test_node_rows_keep_the_whole_node_as_metadata() -> None:
    """런타임은 metadata 에서 address·lat·lon 을 읽는다. 빠지면 POI 가 좌표를 잃는다."""
    mod = _module()
    node = {
        "id": "poi_1",
        "name": "경복궁",
        "category": "kculture",
        "community": 7,
        "address": "서울 종로구",
        "lat": 37.58,
        "lon": 126.97,
    }

    row = mod.to_node_row(node)

    assert row["id"] == "poi_1"
    assert row["community_id"] == 7
    assert row["metadata"] == node


def test_the_committed_graph_converts_without_error() -> None:
    """적재 대상은 저장소의 그래프 파일이다. 지금 형태 그대로 변환돼야 한다."""
    mod = _module()
    nodes, edges = mod.load_graph()

    assert nodes and edges
    for node in nodes[:200]:
        mod.to_node_row(node)
    for edge in edges[:200]:
        mod.to_edge_row(edge)


# ── 워크플로 ─────────────────────────────────────────────────────────────────
def _workflow() -> dict:
    # PyYAML 은 `on:` 을 불리언 True 로 읽는다.
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def test_the_workflow_never_runs_on_its_own() -> None:
    """운영 데이터에 쓰는 경로가 푸시나 일정으로 돌면 안 된다."""
    assert set(_workflow()[True]) == {"workflow_dispatch"}


def test_writing_is_opt_in() -> None:
    """기본 실행은 조회만 한다."""
    inputs = _workflow()[True]["workflow_dispatch"]["inputs"]

    assert inputs["apply"]["default"] is False
    assert inputs["apply"]["type"] == "boolean"


def test_the_current_state_is_reported_before_writing() -> None:
    """적재 후 로그만 남으면 무엇이 있던 자리인지 되짚을 수 없다."""
    steps = _workflow()["jobs"]["load"]["steps"]
    names = [step.get("name") for step in steps]

    assert names.index("Report current state") < names.index("Load the graph")
    # 현황 보고에는 --apply 가 없어야 한다.
    report = steps[names.index("Report current state")]
    assert "--apply" not in report["run"]


def test_the_load_step_is_gated_on_apply() -> None:
    steps = _workflow()["jobs"]["load"]["steps"]
    load = next(step for step in steps if step.get("name") == "Load the graph")

    assert load["if"] == "${{ inputs.apply }}"
    assert "--apply" in load["run"]


def test_the_workflow_cannot_write_to_the_repository() -> None:
    """산출물은 Supabase 쪽에만 생긴다. 저장소를 바꿀 이유가 없다."""
    assert _workflow()["permissions"] == {"contents": "read"}


def test_inputs_never_reach_the_shell_directly() -> None:
    """run 에 ${{ inputs.* }} 를 박으면 입력 문자열이 그대로 명령이 된다."""
    for step in _workflow()["jobs"]["load"]["steps"]:
        run = step.get("run", "")
        assert "${{ inputs." not in run, step.get("name")
