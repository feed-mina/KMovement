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


# ─────────────────────────────────────────────
# 이름 기반 아티스트 검색 (recommend/ai, chat/qa 용)
# ─────────────────────────────────────────────

def _build_artist_name_index() -> dict[str, str]:
    """아티스트 이름(한글/영문) → graph artist_id 매핑 생성"""
    g = _load_graph()
    index: dict[str, str] = {}
    for nid, node in g["nodes"].items():
        if node.get("type") != "Artist":
            continue
        name = node.get("name", "")
        if name:
            index[name] = nid
            index[name.upper()] = nid
            index[name.lower()] = nid
    return index


_artist_name_idx: dict[str, str] | None = None


def _get_artist_name_index() -> dict[str, str]:
    global _artist_name_idx
    if _artist_name_idx is None:
        _artist_name_idx = _build_artist_name_index()
    return _artist_name_idx


def search_artists_by_name(names: list[str]) -> list[str]:
    """아티스트 이름 리스트 → graph artist_id 리스트 반환

    영문/한글 모두 지원. 매칭 안 되는 이름은 무시.
    """
    idx = _get_artist_name_index()
    found: list[str] = []
    seen: set[str] = set()
    for name in names:
        aid = idx.get(name) or idx.get(name.upper()) or idx.get(name.lower())
        if aid and aid not in seen:
            found.append(aid)
            seen.add(aid)
    return found


def extract_artist_ids_from_text(text: str) -> list[str]:
    """자유 텍스트에서 아티스트 이름을 검색하여 artist_id 리스트 반환

    그래프에 등록된 모든 아티스트 이름(한글)을 text에서 substring 매칭.
    """
    g = _load_graph()
    idx = _get_artist_name_index()
    found: list[str] = []
    seen: set[str] = set()

    for nid, node in g["nodes"].items():
        if node.get("type") != "Artist":
            continue
        name = node.get("name", "")
        if name and name in text and nid not in seen:
            found.append(nid)
            seen.add(nid)

    return found


def get_graphrag_context_for_chat(
    message: str,
    artist_names: list[str] | None = None,
    max_pois: int = 5,
) -> list[dict]:
    """채팅 메시지에서 GraphRAG POI 컨텍스트 추출

    1. artist_names가 주어지면 이름 기반 검색
    2. 메시지 텍스트에서 아티스트 이름 추출
    3. 매칭된 아티스트의 관련 POI 반환
    """
    artist_ids: list[str] = []

    # 명시적 아티스트 이름으로 검색
    if artist_names:
        artist_ids = search_artists_by_name(artist_names)

    # 텍스트에서 아티스트 이름 추출
    text_ids = extract_artist_ids_from_text(message)
    seen = set(artist_ids)
    for aid in text_ids:
        if aid not in seen:
            artist_ids.append(aid)
            seen.add(aid)

    if not artist_ids:
        return []

    return get_graphrag_pois(artist_ids, set(), max_pois=max_pois)
