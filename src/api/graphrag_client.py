"""graphrag_client.py — kride_graph.json 기반 2-hop + community POI 확장"""
from __future__ import annotations
import json
import os
from collections import defaultdict

_GRAPH_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "models", "kride_graph.json",
)

_graph: dict | None = None


def _load_graph() -> dict:
    global _graph
    if _graph is not None:
        return _graph

    with open(_GRAPH_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    nodes_by_id: dict[str, dict] = {}
    for n in raw.get("nodes", []):
        nodes_by_id[n["id"]] = n

    # 인접 리스트: source ↔ target (양방향)
    adj: dict[str, set[str]] = defaultdict(set)
    for e in raw.get("edges", []):
        adj[e["source"]].add(e["target"])
        adj[e["target"]].add(e["source"])

    # community → POI 목록
    community_pois: dict[int, list[dict]] = defaultdict(list)
    for n in raw.get("nodes", []):
        if n.get("type") == "POI" and n.get("community") is not None:
            community_pois[n["community"]].append(n)

    _graph = {
        "nodes": nodes_by_id,
        "adj": adj,
        "community_pois": community_pois,
    }
    return _graph


def get_graphrag_pois(
    artist_ids: list[str],
    existing_poi_ids: set[str],
    max_pois: int = 10,
) -> list[dict]:
    """2-hop 이웃 탐색 + 커뮤니티 기반 POI 확장

    Artist → POI → Artist → POI (2-hop)
    같은 community 내 POI 우선 추가
    """
    g = _load_graph()
    nodes = g["nodes"]
    adj = g["adj"]
    community_pois = g["community_pois"]

    found_pois: dict[str, dict] = {}
    seen_communities: set[int] = set()

    for aid in artist_ids:
        if aid not in adj:
            continue

        # 1-hop: Artist → POI
        for neighbor_id in adj[aid]:
            node = nodes.get(neighbor_id, {})
            if node.get("type") != "POI":
                continue
            if neighbor_id in existing_poi_ids:
                if node.get("community") is not None:
                    seen_communities.add(node["community"])
                continue
            found_pois[neighbor_id] = node
            if node.get("community") is not None:
                seen_communities.add(node["community"])

            # 2-hop: POI → Artist → POI
            for hop2_id in adj[neighbor_id]:
                hop2 = nodes.get(hop2_id, {})
                if hop2.get("type") != "Artist":
                    continue
                for hop2_poi_id in adj[hop2_id]:
                    hop2_poi = nodes.get(hop2_poi_id, {})
                    if hop2_poi.get("type") == "POI" and hop2_poi_id not in existing_poi_ids:
                        found_pois[hop2_poi_id] = hop2_poi
                        if hop2_poi.get("community") is not None:
                            seen_communities.add(hop2_poi["community"])

    # 커뮤니티 기반 확장: 이미 발견된 community 내 POI 추가
    for comm_id in seen_communities:
        for poi in community_pois.get(comm_id, []):
            pid = poi["id"]
            if pid not in existing_poi_ids and pid not in found_pois:
                found_pois[pid] = poi

    result = list(found_pois.values())[:max_pois]

    # 표준 POI 형식으로 변환
    formatted = []
    for p in result:
        formatted.append({
            "poi_id": p.get("id", ""),
            "name": p.get("name", ""),
            "lat": p.get("lat"),
            "lon": p.get("lon"),
            "address": p.get("address", ""),
            "category": p.get("category", ""),
            "sido": p.get("address", "").split()[0] if p.get("address") else "",
            "source": "graphrag",
        })

    return formatted
