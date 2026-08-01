"""models/kride_graph.json 을 Supabase nodes/edges 로 적재한다.

기존 dataset/노드마이그레이션.py 는 Colab 전용이다. 소스 경로가
/content/drive/MyDrive/... 로 고정돼 있고 Neo4j 적재와 한 파일에 묶여 있어
Neo4j 인스턴스가 사라진 지금은 실행할 수 없다. 저장소의 그래프 파일만으로
재실행 가능한 형태로 다시 쓴다.

기본은 조회만 하는 dry-run 이다. 실제 쓰기는 --apply 를 줘야 한다. 운영
데이터에 쓰는 스크립트가 실수로 도는 것을 막는다.

사용법

    export SUPABASE_URL=... SUPABASE_KEY=...

    python scripts/load_graph_to_supabase.py                 # 현황만 확인
    python scripts/load_graph_to_supabase.py --limit 20 --apply   # 소량 시험
    python scripts/load_graph_to_supabase.py --apply         # 전체 적재

스키마 (dataset/노드마이그레이션.py 가 만든 것과 동일)

    nodes  id(PK), name, category, community_id, metadata(jsonb)
    edges  source_id, target_id, relation_type, weight

nodes 는 id 가 PK 이므로 upsert 로 멱등하다. edges 는 유니크 제약을 확인할 수
없어 upsert 를 믿지 않는다. 기존 행을 먼저 읽어 (source_id, target_id,
relation_type) 조합이 없는 것만 넣는다. 여러 번 돌려도 중복되지 않는다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "models" / "kride_graph.json"

NODE_BATCH = 500
EDGE_BATCH = 500
# PostgREST 의 기본 응답 상한이 1000행이라 그보다 작게 끊어 읽는다.
PAGE = 1000


def load_graph() -> tuple[list[dict], list[dict]]:
    if not GRAPH_PATH.exists():
        sys.exit(f"그래프 파일이 없다: {GRAPH_PATH}")
    data = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    return data.get("nodes", []), data.get("edges", [])


def to_node_row(node: dict) -> dict:
    return {
        "id": str(node["id"]),
        "name": node.get("name"),
        "category": node.get("category"),
        "community_id": node.get("community", 0),
        "metadata": node,
    }


def to_edge_row(edge: dict) -> dict:
    # 그래프 파일은 relationship 키를 쓴다. 예전 스크립트는 type 을 읽고
    # 기본값으로 FILMING_AT 을 넣었는데, 그러면 다른 관계가 생겼을 때 조용히
    # 잘못된 값이 들어간다. 실제 키를 우선한다.
    relation = edge.get("relationship") or edge.get("relation_type") or edge.get("type")
    if not relation:
        raise ValueError(f"관계 종류를 알 수 없는 엣지: {edge}")
    return {
        "source_id": str(edge["source"]),
        "target_id": str(edge["target"]),
        "relation_type": relation,
        "weight": float(edge.get("weight", 1.0)),
    }


def fetch_all(client, table: str, columns: str) -> list[dict]:
    """PostgREST 응답 상한을 넘겨 전부 읽는다."""
    rows: list[dict] = []
    start = 0
    while True:
        chunk = (
            client.table(table)
            .select(columns)
            .range(start, start + PAGE - 1)
            .execute()
            .data
            or []
        )
        rows.extend(chunk)
        if len(chunk) < PAGE:
            return rows
        start += PAGE


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="실제로 쓴다. 주지 않으면 현황만 보고하고 종료한다.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="노드·엣지를 각각 N개까지만 처리한다. 0이면 전체.",
    )
    args = parser.parse_args()

    nodes, edges = load_graph()
    if args.limit:
        nodes, edges = nodes[: args.limit], edges[: args.limit]

    print(f"그래프 파일: 노드 {len(nodes):,}건, 엣지 {len(edges):,}건")

    for var in ("SUPABASE_URL", "SUPABASE_KEY"):
        if not os.environ.get(var):
            sys.exit(f"{var} 가 설정돼 있지 않다.")

    from supabase import create_client

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    existing_nodes = {r["id"] for r in fetch_all(client, "nodes", "id")}
    existing_edges = {
        (r["source_id"], r["target_id"], r["relation_type"])
        for r in fetch_all(client, "edges", "source_id, target_id, relation_type")
    }
    print(f"Supabase 현재: 노드 {len(existing_nodes):,}건, 엣지 {len(existing_edges):,}건")

    node_rows = [to_node_row(n) for n in nodes]
    edge_rows = [to_edge_row(e) for e in edges]
    new_edges = [
        row
        for row in edge_rows
        if (row["source_id"], row["target_id"], row["relation_type"]) not in existing_edges
    ]
    new_nodes = [row for row in node_rows if row["id"] not in existing_nodes]

    print(f"추가될 노드 {len(new_nodes):,}건, 갱신될 노드 {len(node_rows) - len(new_nodes):,}건")
    print(f"추가될 엣지 {len(new_edges):,}건, 이미 있는 엣지 {len(edge_rows) - len(new_edges):,}건")

    # 참조 무결성 확인. 엣지가 가리키는 노드가 없으면 조회가 빈 결과를 낸다.
    node_ids = {row["id"] for row in node_rows} | existing_nodes
    dangling = [
        row
        for row in edge_rows
        if row["source_id"] not in node_ids or row["target_id"] not in node_ids
    ]
    if dangling:
        print(f"⚠️ 양쪽 노드가 없는 엣지 {len(dangling)}건 — 예: {dangling[0]}")

    if not args.apply:
        print("\ndry-run 이다. 실제로 쓰려면 --apply 를 준다.")
        return 0

    print("\n노드 적재 중...")
    for i in range(0, len(node_rows), NODE_BATCH):
        batch = node_rows[i : i + NODE_BATCH]
        client.table("nodes").upsert(batch).execute()
        print(f"  {min(i + NODE_BATCH, len(node_rows)):,}/{len(node_rows):,}")

    print("엣지 적재 중...")
    for i in range(0, len(new_edges), EDGE_BATCH):
        batch = new_edges[i : i + EDGE_BATCH]
        client.table("edges").insert(batch).execute()
        print(f"  {min(i + EDGE_BATCH, len(new_edges)):,}/{len(new_edges):,}")

    after_nodes = len(fetch_all(client, "nodes", "id"))
    after_edges = len(fetch_all(client, "edges", "source_id"))
    print(f"\n완료. Supabase 노드 {after_nodes:,}건, 엣지 {after_edges:,}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
