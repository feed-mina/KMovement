"""models/kride_graph.json 을 Supabase nodes/edges 로 적재한다.

기존 dataset/노드마이그레이션.py 는 Colab 전용이다. 소스 경로가
/content/drive/MyDrive/... 로 고정돼 있고 Neo4j 적재와 한 파일에 묶여 있어
Neo4j 인스턴스가 사라진 지금은 실행할 수 없다. 저장소의 그래프 파일만으로
재실행 가능한 형태로 다시 쓴다.

기본은 조회만 하는 dry-run 이다. 실제 쓰기는 --apply 를 줘야 한다. 운영
데이터에 쓰는 스크립트가 실수로 도는 것을 막는다.

쓰기는 secret 키로만 한다. publishable/anon 키는 RLS 를 적용받는데, 정책이
SELECT 를 막으면 PostgREST 는 에러가 아니라 "0건"을 정상 응답으로 돌려준다.
이 스크립트는 기존 행을 읽어서 무엇이 새 행인지 정하므로, 읽기가 막힌 채로
쓰면 이미 있는 엣지를 전부 새 행으로 보고 통째로 중복 삽입한다. 실제로 배포
진단이 41,586건이 든 테이블을 여러 번 "비었다"고 보고한 적이 있다(#226).

사용법

    export SUPABASE_URL=... SUPABASE_KEY=...   # 쓰려면 sb_secret_... 키

    python scripts/load_graph_to_supabase.py                 # 현황만 확인
    python scripts/load_graph_to_supabase.py --diff-nodes    # 덮으면 뭐가 바뀌나
    python scripts/load_graph_to_supabase.py --skip-nodes --apply   # 엣지만
    python scripts/load_graph_to_supabase.py --apply         # 엣지 + 새 노드

기본은 새 노드만 넣는다. 이미 있는 노드를 그래프 값으로 덮으려면
--update-existing-nodes 를 명시해야 한다. 두 소스는 갈라져 있고(Supabase 에
그래프에 없는 노드가 있다) upsert 는 metadata 를 통째로 갈아치우므로, 무엇이
사라지는지 --diff-nodes 로 먼저 본다.

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

# RLS 를 우회해 실제 행을 보는 키만 쓰기를 허용한다. 나머지는 읽기가 조용히
# 막힐 수 있고, 그러면 이 스크립트의 "새 행" 판정 자체가 무너진다.
WRITABLE_KEY_KINDS = frozenset({"secret", "legacy-service_role"})


def supabase_key_kind(key: str) -> str:
    """키 값을 노출하지 않고 종류만 판정한다.

    deploy/ec2/deploy.sh 의 같은 이름 함수와 분류가 일치해야 한다. 진단이
    'publishable' 이라고 말한 키로 여기서 쓰기가 되면 안 된다.
    """
    if not key:
        return "missing"
    if key.startswith("sb_secret_"):
        return "secret"
    if key.startswith("sb_publishable_"):
        return "publishable"
    if key.startswith("eyJ"):
        # 구형 JWT 키는 payload 의 role 로 구분한다. 서명은 검증하지 않는다 —
        # 권한 판정이 아니라 사람에게 보여 줄 분류다.
        try:
            import base64
            body = key.split(".")[1]
            body += "=" * (-len(body) % 4)
            role = json.loads(base64.urlsafe_b64decode(body)).get("role", "")
            return "legacy-" + (role or "unknown")
        except Exception:
            return "legacy-unknown"
    return "unknown"


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


def report_node_diff(client, node_rows: list[dict]) -> None:
    """이미 있는 노드를 그래프 값으로 덮으면 무엇이 바뀌는지 보고한다.

    두 소스는 갈라져 있다 — Supabase 에는 그래프에 없는 노드가 있고, 그렇다면
    같은 노드의 metadata 에도 그래프에 없는 필드가 있을 수 있다. upsert 는 그
    필드를 조용히 지운다. 지우기 전에 무엇을 지우는지 본다.
    """
    print("\n기존 노드 비교 중... (metadata 까지 읽는다)")
    existing = {
        row["id"]: row
        for row in fetch_all(client, "nodes", "id, name, category, community_id, metadata")
    }

    changed = 0
    dropped_keys: dict[str, int] = {}
    samples: list[str] = []

    for row in node_rows:
        before = existing.get(row["id"])
        if before is None:
            continue

        fields = [
            field
            for field in ("name", "category", "community_id", "metadata")
            if before.get(field) != row[field]
        ]
        if not fields:
            continue
        changed += 1

        # 사라지는 metadata 키가 실제 손실이다. 값 변경보다 먼저 본다.
        old_meta = before.get("metadata") or {}
        if isinstance(old_meta, dict):
            for key in set(old_meta) - set(row["metadata"]):
                dropped_keys[key] = dropped_keys.get(key, 0) + 1

        if len(samples) < 3:
            samples.append(f"  {row['id']}: {', '.join(fields)}")

    print(f"바뀌는 노드 {changed:,}건 / 이미 있는 노드 {len(existing):,}건")
    for sample in samples:
        print(sample)
    if dropped_keys:
        top = sorted(dropped_keys.items(), key=lambda kv: -kv[1])[:10]
        print("⚠️ upsert 로 사라지는 metadata 키:")
        for key, count in top:
            print(f"   {key}: {count:,}건")
        print("   이 값이 필요하면 --update-existing-nodes 를 주지 않는다.")
    else:
        print("사라지는 metadata 키는 없다.")


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
    parser.add_argument("--skip-nodes", action="store_true", help="노드는 건드리지 않는다.")
    parser.add_argument("--skip-edges", action="store_true", help="엣지는 건드리지 않는다.")
    parser.add_argument(
        "--update-existing-nodes",
        action="store_true",
        help=(
            "이미 있는 노드도 그래프 값으로 덮어쓴다. 주지 않으면 새 노드만 넣는다. "
            "먼저 --diff-nodes 로 무엇이 바뀌는지 본다."
        ),
    )
    parser.add_argument(
        "--diff-nodes",
        action="store_true",
        help="이미 있는 노드가 어떻게 바뀌는지 보고한다. metadata 까지 읽어 느리다.",
    )
    args = parser.parse_args()

    nodes, edges = load_graph()
    if args.limit:
        nodes, edges = nodes[: args.limit], edges[: args.limit]

    print(f"그래프 파일: 노드 {len(nodes):,}건, 엣지 {len(edges):,}건")

    for var in ("SUPABASE_URL", "SUPABASE_KEY"):
        if not os.environ.get(var):
            sys.exit(f"{var} 가 설정돼 있지 않다.")

    key_kind = supabase_key_kind(os.environ["SUPABASE_KEY"])
    print(f"SUPABASE_KEY 종류: {key_kind}")
    if args.apply and key_kind not in WRITABLE_KEY_KINDS:
        sys.exit(
            f"쓰기를 거부한다 — SUPABASE_KEY 가 {key_kind} 키다.\n"
            "이 키는 RLS 를 적용받고, 정책이 SELECT 를 막으면 조회가 에러 없이\n"
            "0건을 돌려준다. 그 상태로 쓰면 이미 있는 엣지를 전부 새 행으로 보고\n"
            "중복 삽입한다. sb_secret_ 키로 다시 실행한다."
        )

    from supabase import create_client

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    existing_nodes = {r["id"] for r in fetch_all(client, "nodes", "id")}
    existing_edges = {
        (r["source_id"], r["target_id"], r["relation_type"])
        for r in fetch_all(client, "edges", "source_id, target_id, relation_type")
    }
    print(f"Supabase 현재: 노드 {len(existing_nodes):,}건, 엣지 {len(existing_edges):,}건")
    if not existing_nodes and key_kind not in WRITABLE_KEY_KINDS:
        # 이 0 은 "비었다"가 아니라 "안 보인다"일 수 있다. 이 구분 없이 숫자를
        # 근거로 적재를 결정하면 안 된다(#226).
        print(
            "⚠️ 0건은 빈 테이블이라는 뜻이 아니다 — 이 키로는 RLS 가 읽기를 막았을\n"
            "   때에도 같은 숫자가 나온다. secret 키로 다시 확인하기 전에는 아무\n"
            "   결론도 내지 않는다."
        )

    node_rows = [to_node_row(n) for n in nodes]
    edge_rows = [to_edge_row(e) for e in edges]
    new_edges = [
        row
        for row in edge_rows
        if (row["source_id"], row["target_id"], row["relation_type"]) not in existing_edges
    ]
    new_nodes = [row for row in node_rows if row["id"] not in existing_nodes]

    # 실제로 쓸 노드를 여기서 정한다. 기본은 새 노드만이다 — 기존 행 덮어쓰기는
    # metadata 를 통째로 갈아치우므로 명시적으로 골라야 한다.
    write_nodes = node_rows if args.update_existing_nodes else new_nodes

    print(f"추가될 노드 {len(new_nodes):,}건, 갱신될 노드 {len(node_rows) - len(new_nodes):,}건")
    print(f"추가될 엣지 {len(new_edges):,}건, 이미 있는 엣지 {len(edge_rows) - len(new_edges):,}건")
    print(
        "쓰기 대상: "
        + ("노드 건너뜀" if args.skip_nodes else f"노드 {len(write_nodes):,}건")
        + " · "
        + ("엣지 건너뜀" if args.skip_edges else f"엣지 {len(new_edges):,}건")
    )
    if not args.skip_nodes and not args.update_existing_nodes and new_nodes != node_rows:
        print(
            "기존 노드는 그대로 둔다. 그래프 값으로 덮으려면 --update-existing-nodes "
            "를 준다."
        )

    # 참조 무결성 확인. 엣지가 가리키는 노드가 없으면 조회가 빈 결과를 낸다.
    node_ids = {row["id"] for row in node_rows} | existing_nodes
    dangling = [
        row
        for row in edge_rows
        if row["source_id"] not in node_ids or row["target_id"] not in node_ids
    ]
    if dangling:
        print(f"⚠️ 양쪽 노드가 없는 엣지 {len(dangling)}건 — 예: {dangling[0]}")

    if args.diff_nodes:
        report_node_diff(client, node_rows)

    if not args.apply:
        print("\ndry-run 이다. 실제로 쓰려면 --apply 를 준다.")
        return 0

    if args.skip_nodes:
        print("\n노드 건너뜀.")
    else:
        print("\n노드 적재 중...")
        for i in range(0, len(write_nodes), NODE_BATCH):
            batch = write_nodes[i : i + NODE_BATCH]
            client.table("nodes").upsert(batch).execute()
            print(f"  {min(i + NODE_BATCH, len(write_nodes)):,}/{len(write_nodes):,}")

    if args.skip_edges:
        print("엣지 건너뜀.")
    else:
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
