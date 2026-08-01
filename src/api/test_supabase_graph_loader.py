"""Supabase 그래프 적재 스크립트와 조회 코드의 컬럼 계약 검증.

조회 코드가 source/target 을 쓰는 동안 실제 스키마는 source_id/target_id 였다.
PostgREST 가 42703 을 내고, 그 예외가 대체 경로 전체를 막았다(#217).
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
LOADER_PATH = ROOT / "scripts" / "load_graph_to_supabase.py"
GRAPH_PATH = ROOT / "models" / "kride_graph.json"
FASTAPI_SERVER = ROOT / "src" / "api" / "fastapi_server.py"
SUPABASE_CLIENT = ROOT / "src" / "api" / "supabase_client.py"


def _loader():
    spec = importlib.util.spec_from_file_location("graph_loader", LOADER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_edge_queries_use_the_real_column_names() -> None:
    """source/target 으로 조회하면 PostgREST 가 42703 을 낸다."""
    for path in (FASTAPI_SERVER, SUPABASE_CLIENT):
        text = path.read_text(encoding="utf-8")
        assert '.select("source, target")' not in text, path.name
        assert '.select("source, target, relation_type")' not in text, path.name

    server = FASTAPI_SERVER.read_text(encoding="utf-8")
    assert '.select("source_id, target_id")' in server
    assert 'edge["target_id"]' in server
    assert 'edge["source_id"]' in server

    client = SUPABASE_CLIENT.read_text(encoding="utf-8")
    assert '.select("source_id, target_id, relation_type")' in client
    assert 'row["target_id"]' in client
    assert 'row["source_id"]' in client


def test_artist_lookup_failure_does_not_block_the_region_path() -> None:
    """아티스트 경로의 예외가 지역 경로까지 삼키면 대체 경로 전체가 죽는다."""
    server = FASTAPI_SERVER.read_text(encoding="utf-8")

    start = server.index("# 4-1. Supabase fallback")
    block = server[start : start + 2500]

    artist_branch = block.index("if req.artists:")
    region_branch = block.index("if regions and not fallback_poi_ids:")
    inner_try = block.index("try:", artist_branch)
    inner_except = block.index("except Exception as artist_err:", artist_branch)

    # 아티스트 블록이 자체 try/except 로 감싸여 지역 블록보다 먼저 닫혀야 한다.
    assert artist_branch < inner_try < inner_except < region_branch


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="kride_graph.json 없음")
def test_loader_rows_match_the_supabase_schema() -> None:
    loader = _loader()
    nodes, edges = loader.load_graph()

    node_rows = [loader.to_node_row(n) for n in nodes]
    edge_rows = [loader.to_edge_row(e) for e in edges]

    assert set(node_rows[0]) == {"id", "name", "category", "community_id", "metadata"}
    assert set(edge_rows[0]) == {"source_id", "target_id", "relation_type", "weight"}

    # id 가 PK 이므로 중복이 있으면 upsert 가 서로를 덮어쓴다.
    ids = {row["id"] for row in node_rows}
    assert len(ids) == len(node_rows)

    # 엣지가 가리키는 노드가 없으면 조회가 조용히 빈 결과를 낸다.
    for row in edge_rows:
        assert row["source_id"] in ids
        assert row["target_id"] in ids

    # 관계 종류를 추측하지 않는다. 그래프 파일은 relationship 키를 쓴다.
    assert {row["relation_type"] for row in edge_rows} == {"FILMING_AT"}
    with pytest.raises(ValueError):
        loader.to_edge_row({"source": "poi_1", "target": "artist_1"})


def test_loader_does_not_write_without_an_explicit_flag() -> None:
    """운영 데이터에 쓰는 스크립트가 실수로 도는 것을 막는다."""
    source = LOADER_PATH.read_text(encoding="utf-8")

    assert '"--apply"' in source
    assert "if not args.apply:" in source

    # --apply 이전에는 쓰기 호출이 없어야 한다.
    guard = source.index("if not args.apply:")
    before = source[:guard]
    assert ".upsert(" not in before
    assert ".insert(" not in before
