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


def test_the_default_scope_neither_fails_nor_overwrites() -> None:
    """기본값은 실제로 동작하면서 잃을 것이 없는 쪽이어야 한다.

    edges-only 는 엣지가 Supabase 에 없는 노드를 가리키면 외래키에서 죽는다 —
    실제로 그렇게 죽었다. overwrite-nodes 는 기존 40,704행의 metadata 를 덮는다.
    """
    scope = _workflow()[True]["workflow_dispatch"]["inputs"]["scope"]

    assert scope["default"] == "edges-and-new-nodes"
    assert set(scope["options"]) == {"edges-only", "edges-and-new-nodes", "overwrite-nodes"}


def test_every_scope_maps_to_a_flag() -> None:
    """이름과 실제 인자가 어긋나면 고른 것과 다른 일이 벌어진다."""
    load = next(
        step
        for step in _workflow()["jobs"]["load"]["steps"]
        if step.get("name") == "Load the graph"
    )

    assert "edges-only)          SCOPE_ARGS=\"--skip-nodes\"" in load["run"]
    assert "edges-and-new-nodes) SCOPE_ARGS=\"\"" in load["run"]
    assert "overwrite-nodes)     SCOPE_ARGS=\"--update-existing-nodes\"" in load["run"]
    # 알 수 없는 값이 빈 인자로 떨어지면 조용히 전체 적재가 된다.
    assert "unknown scope" in load["run"]


# ── 쓰기 범위 ────────────────────────────────────────────────────────────────
class _FakeTable:
    def __init__(self, name: str, log: list[tuple[str, str, int]]):
        self._name = name
        self._log = log

    def select(self, *_a, **_k):
        return self

    def range(self, *_a, **_k):
        return self

    def upsert(self, rows):
        self._log.append((self._name, "upsert", len(rows)))
        return self

    def insert(self, rows):
        self._log.append((self._name, "insert", len(rows)))
        return self

    def execute(self):
        return type("R", (), {"data": []})()


class _FakeClient:
    def __init__(self) -> None:
        self.writes: list[tuple[str, str, int]] = []

    def table(self, name: str) -> _FakeTable:
        return _FakeTable(name, self.writes)


def _run(monkeypatch, argv: list[str]) -> _FakeClient:
    """빈 Supabase 를 가정하고 main() 을 돌려 쓰기 호출을 기록한다."""
    import sys
    import types

    mod = _module()
    client = _FakeClient()
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "sb_secret_test")
    monkeypatch.setattr("sys.argv", ["load_graph_to_supabase.py", *argv])

    fake = types.ModuleType("supabase")
    fake.create_client = lambda *a, **k: client
    monkeypatch.setitem(sys.modules, "supabase", fake)

    assert mod.main() == 0
    return client


def test_default_apply_writes_both_tables(monkeypatch) -> None:
    client = _run(monkeypatch, ["--limit", "10", "--apply"])
    written = {(table, op) for table, op, _ in client.writes}

    assert ("nodes", "upsert") in written
    assert ("edges", "insert") in written


def test_skip_nodes_writes_only_edges(monkeypatch) -> None:
    """가장 안전한 경로. 엣지 추가는 순수 추가다."""
    client = _run(monkeypatch, ["--limit", "10", "--apply", "--skip-nodes"])

    assert {table for table, _, _ in client.writes} == {"edges"}


def test_skip_edges_writes_only_nodes(monkeypatch) -> None:
    client = _run(monkeypatch, ["--limit", "10", "--apply", "--skip-edges"])

    assert {table for table, _, _ in client.writes} == {"nodes"}


def test_existing_nodes_are_left_alone_unless_asked(monkeypatch) -> None:
    """기본 적재가 기존 40,704행을 덮어쓰면 안 된다.

    Supabase 에는 그래프에 없는 노드가 있다 — 두 소스가 갈라져 있다는 뜻이고,
    metadata 를 통째로 upsert 하면 Supabase 쪽에만 있는 필드가 사라진다.
    """
    import sys
    import types

    mod = _module()
    client = _FakeClient()
    graph_nodes, _ = mod.load_graph()
    already_there = {str(node["id"]) for node in graph_nodes[:6]}

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "sb_secret_test")
    monkeypatch.setattr(
        "sys.argv",
        ["load_graph_to_supabase.py", "--limit", "10", "--apply", "--skip-edges"],
    )
    monkeypatch.setattr(
        mod,
        "fetch_all",
        lambda _c, table, _cols: (
            [{"id": node_id} for node_id in already_there] if table == "nodes" else []
        ),
    )

    fake = types.ModuleType("supabase")
    fake.create_client = lambda *a, **k: client
    monkeypatch.setitem(sys.modules, "supabase", fake)
    assert mod.main() == 0

    # 10건 중 6건은 이미 있다. 새 4건만 써야 한다.
    assert sum(count for _, _, count in client.writes) == 4


def test_update_existing_nodes_writes_every_row(monkeypatch) -> None:
    """명시하면 전체를 덮는다. 그때는 그것이 의도다."""
    import sys
    import types

    mod = _module()
    client = _FakeClient()
    graph_nodes, _ = mod.load_graph()
    already_there = {str(node["id"]) for node in graph_nodes[:6]}

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "sb_secret_test")
    monkeypatch.setattr(
        "sys.argv",
        [
            "load_graph_to_supabase.py",
            "--limit", "10", "--apply", "--skip-edges", "--update-existing-nodes",
        ],
    )
    monkeypatch.setattr(
        mod,
        "fetch_all",
        lambda _c, table, _cols: (
            [{"id": node_id} for node_id in already_there] if table == "nodes" else []
        ),
    )

    fake = types.ModuleType("supabase")
    fake.create_client = lambda *a, **k: client
    monkeypatch.setitem(sys.modules, "supabase", fake)
    assert mod.main() == 0

    assert sum(count for _, _, count in client.writes) == 10


# ── 참조 무결성 ──────────────────────────────────────────────────────────────
def _run_with_supabase(monkeypatch, argv: list[str], node_ids: set[str], edge_triples: set):
    """Supabase 에 특정 노드·엣지만 있다고 가정하고 main() 을 돌린다."""
    import sys
    import types

    mod = _module()
    client = _FakeClient()
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "sb_secret_test")
    monkeypatch.setattr("sys.argv", ["load_graph_to_supabase.py", *argv])
    monkeypatch.setattr(
        mod,
        "fetch_all",
        lambda _c, table, _cols: (
            [{"id": n} for n in node_ids]
            if table == "nodes"
            else [
                {"source_id": s, "target_id": t, "relation_type": r}
                for s, t, r in edge_triples
            ]
        ),
    )
    fake = types.ModuleType("supabase")
    fake.create_client = lambda *a, **k: client
    monkeypatch.setitem(sys.modules, "supabase", fake)
    return mod, client


def test_skip_nodes_refuses_when_edges_need_missing_nodes(monkeypatch, capsys) -> None:
    """--skip-nodes 로 엣지만 넣으면 외래키에서 죽는다.

    실제로 그렇게 죽었다. 무결성 검사가 "그래프 노드는 어차피 들어간다"고
    가정해서 dry-run 이 통과했고, INSERT 가 첫 배치에서 실패했다. 검사는 적재
    후의 노드 집합을 기준으로 해야 한다.
    """
    # --limit 없이 돈다. 자른 조각은 노드와 엣지가 서로 맞물리지 않아 이 검사가
    # 의미를 잃는다.
    mod, client = _run_with_supabase(
        monkeypatch,
        ["--apply", "--skip-nodes"],
        node_ids=set(),          # Supabase 에 노드가 하나도 없다
        edge_triples=set(),
    )

    with pytest.raises(SystemExit) as exit_info:
        mod.main()

    assert "적재를 중단한다" in str(exit_info.value)
    out = capsys.readouterr().out
    assert "없는 노드" in out
    assert "edges-and-new-nodes" in out
    # 중단은 쓰기 전에 일어나야 한다.
    assert client.writes == []


def test_including_nodes_clears_the_integrity_block(monkeypatch) -> None:
    """노드를 함께 넣으면 같은 엣지가 통과한다."""
    mod, client = _run_with_supabase(
        monkeypatch,
        ["--apply"],
        node_ids=set(),
        edge_triples=set(),
    )

    assert mod.main() == 0
    assert {table for table, _, _ in client.writes} == {"nodes", "edges"}


def test_dry_run_surfaces_the_block_without_exiting(monkeypatch, capsys) -> None:
    """dry-run 이 조용히 통과하면 이 문제를 실행 전에 볼 수 없다."""
    mod, _ = _run_with_supabase(
        monkeypatch,
        ["--skip-nodes"],
        node_ids=set(),
        edge_triples=set(),
    )

    assert mod.main() == 0
    assert "없는 노드" in capsys.readouterr().out


# ── 배치 실패 ────────────────────────────────────────────────────────────────
def test_a_failing_batch_names_the_offending_row(capsys) -> None:
    """트레이스백만 남으면 500행 중 무엇이 문제였는지 알 수 없다."""
    mod = _module()

    class _Table:
        def __init__(self, rows_seen):
            self._seen = rows_seen

        def insert(self, rows):
            self._rows = rows
            return self

        def execute(self):
            if any(row.get("bad") for row in self._rows):
                raise RuntimeError('violates foreign key constraint "edges_source_id_fkey"')
            self._seen.extend(self._rows)
            return type("R", (), {"data": []})()

    seen: list[dict] = []

    class _Client:
        def table(self, _name):
            return _Table(seen)

    rows = [{"source_id": "a"}, {"source_id": "b", "bad": True}, {"source_id": "c"}]

    with pytest.raises(SystemExit) as exit_info:
        mod.write_batches(_Client(), "edges", rows, "insert", 3)

    out = capsys.readouterr().out
    assert "문제 행" in out
    assert "foreign key" in out
    # 문제 행 앞의 정상 행은 개별 재시도로 들어간다.
    assert seen == [{"source_id": "a"}]
    assert "1건까지 반영됐다" in str(exit_info.value)


def test_diff_reports_metadata_keys_that_would_disappear(capsys) -> None:
    """사라지는 키가 실제 손실이다. 숫자만으로는 보이지 않는다."""
    mod = _module()

    class _Client:
        def table(self, _name):
            return self

        def select(self, *_a, **_k):
            return self

        def range(self, *_a, **_k):
            return self

        def execute(self):
            return type("R", (), {"data": []})()

    existing = [{
        "id": "poi_1",
        "name": "경복궁",
        "category": "kculture",
        "community_id": 0,
        # 그래프에는 없는 필드다. upsert 하면 사라진다.
        "metadata": {"id": "poi_1", "image_url": "https://example/x.jpg"},
    }]

    mod.fetch_all = lambda *_a, **_k: existing
    node_rows = [mod.to_node_row({"id": "poi_1", "name": "경복궁", "category": "kculture"})]
    mod.report_node_diff(_Client(), node_rows)

    out = capsys.readouterr().out
    assert "image_url" in out
    assert "사라지는 metadata 키" in out
