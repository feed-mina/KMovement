"""supabase_client.py — Supabase Full DB 클라이언트"""
from __future__ import annotations
import os
from supabase import create_client, Client

_client: Client | None = None

def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _client


def get_all_artists() -> list[dict]:
    """nodes 테이블에서 artist 노드 조회 → {id, name, imageUrl}"""
    resp = (
        get_client()
        .table("nodes")
        .select("id, metadata")
        .like("id", "artist_%")
        .execute()
    )
    results = []
    for row in (resp.data or []):
        meta = row.get("metadata") or {}
        name = meta.get("name", "")
        if not name:
            continue
        results.append({
            "id": row["id"],
            "name": name,
            "imageUrl": meta.get("image_url", ""),
        })
    return results


def get_poi_details(poi_ids: list[str]) -> list[dict]:
    """nodes 테이블에서 POI 상세 정보 조회"""
    resp = (
        get_client()
        .table("nodes")
        .select("id, metadata")
        .in_("id", poi_ids)
        .execute()
    )
    results = []
    for row in (resp.data or []):
        meta = row.get("metadata") or {}
        results.append({
            "id": row["id"],
            "name": meta.get("name", ""),
            "address": meta.get("address", ""),
            "lat": meta.get("lat"),
            "lon": meta.get("lon"),
            "category": meta.get("category", ""),
            "image_url": meta.get("image_url", ""),
            "avg_cost": meta.get("avg_cost"),
        })
    return results


def get_artist_poi_map(artist_ids: list[str]) -> list[dict]:
    """edges 테이블에서 FILMING_AT 관계 조회 — 아티스트별 촬영지 목록"""
    resp = (
        get_client()
        .table("edges")
        .select("source, target, relation_type")
        .eq("relation_type", "FILMING_AT")
        .execute()
    )
    # edges: source=poi_*, target=artist_*
    # artist_ids는 name 기반이므로, target(artist id)으로 필터링
    # 호출부에서 artist id 목록을 넘겨줄 수도 있으므로 양쪽 모두 반환
    results = []
    for row in (resp.data or []):
        results.append({
            "artist_id": row["target"],
            "poi_id": row["source"],
        })
    return results