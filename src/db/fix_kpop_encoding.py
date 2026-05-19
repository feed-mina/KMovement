"""
fix_kpop_encoding.py
====================
Colab 마이그레이션에서 인코딩 깨진 K-pop 데이터를
로컬에서 직접 Supabase + Neo4j에 정상 UTF-8로 덮어쓰기.

delta JSON(정상 인코딩)을 읽어서 upsert.

[ 실행 ]
  python src/db/fix_kpop_encoding.py
"""
import json
import os
from dotenv import load_dotenv

load_dotenv()

DELTA_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "models", "kride_graph_delta.json",
)


def fix_supabase(nodes, edges):
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    client = create_client(url, key)

    print(f"\n[Supabase] Fixing {len(nodes)} nodes...")
    for node in nodes:
        nid = str(node["id"])
        try:
            client.table("nodes").upsert({
                "id": nid,
                "name": node.get("name", ""),
                "category": node.get("category", ""),
                "community_id": node.get("community", 0),
                "metadata": node,
            }).execute()
        except Exception as e:
            print(f"  Node {nid} error: {e}")
    print(f"  Nodes done.")

    print(f"[Supabase] Fixing {len(edges)} edges...")
    for edge in edges:
        sid = str(edge["source"])
        tid = str(edge["target"])
        etype = edge.get("type", edge.get("relationship", "FILMING_AT"))
        try:
            client.table("edges").upsert({
                "source_id": sid,
                "target_id": tid,
                "relation_type": etype,
                "weight": float(edge.get("weight", 1.0)),
            }).execute()
        except Exception as e:
            print(f"  Edge {sid}->{tid} error: {e}")
    print(f"  Edges done.")


def fix_neo4j(nodes, edges):
    from neo4j import GraphDatabase

    uri = os.environ["NEO4J_URI"]
    user = os.environ["NEO4J_USERNAME"]
    pwd = os.environ["NEO4J_PASSWORD"]
    db = os.environ.get("NEO4J_DATABASE", "neo4j")
    driver = GraphDatabase.driver(uri, auth=(user, pwd))

    print(f"\n[Neo4j] Fixing {len(nodes)} nodes...")
    with driver.session(database=db) as session:
        for node in nodes:
            label = node.get("type", "Node")
            props = {k: v for k, v in node.items() if k not in ["id", "type"]}
            # str 변환으로 None 방지
            for k, v in props.items():
                if v is None:
                    props[k] = ""
            session.run(
                f"MERGE (n:{label} {{id: $id}}) SET n += $props",
                id=str(node["id"]),
                props=props,
            )
        print(f"  Nodes done.")

        print(f"[Neo4j] Fixing {len(edges)} edges...")
        for edge in edges:
            etype = edge.get("type", edge.get("relationship", "FILMING_AT"))
            session.run(
                f"MATCH (a {{id: $s}}), (b {{id: $t}}) "
                f"MERGE (a)-[r:{etype}]->(b) SET r.weight = $w",
                s=str(edge["source"]),
                t=str(edge["target"]),
                w=float(edge.get("weight", 1.0)),
            )
        print(f"  Edges done.")

    driver.close()


def main():
    path = os.path.normpath(DELTA_PATH)
    print(f"Reading delta: {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    print(f"Delta: {len(nodes)} nodes, {len(edges)} edges")

    # 샘플 확인
    artists = [n for n in nodes if n.get("type") == "Artist"]
    if artists:
        print(f"\nSample artists (encoding check):")
        for a in artists[:3]:
            print(f"  {a['id']}: {a.get('name', '?')}")

    fix_supabase(nodes, edges)
    fix_neo4j(nodes, edges)

    print(f"\nDone! {len(nodes)} nodes + {len(edges)} edges fixed.")


if __name__ == "__main__":
    main()
