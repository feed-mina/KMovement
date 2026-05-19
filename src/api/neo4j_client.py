"""neo4j_client.py — Neo4j Aura 드라이버 + Cypher 헬퍼"""
from __future__ import annotations
import os
from neo4j import GraphDatabase

_driver = None

def get_driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            os.environ["NEO4J_URI"],
            auth=(os.environ["NEO4J_USERNAME"], os.environ["NEO4J_PASSWORD"]),
        )
    return _driver


def close_driver():
    global _driver
    if _driver:
        _driver.close()
        _driver = None


def get_artist_pois(artist_ids: list[str], limit: int = 20) -> list[dict]:
    """선택 아티스트의 FILMING_AT POI 조회"""
    query = """
    MATCH (p:POI)-[:FILMING_AT]->(a:Artist)
    WHERE a.name IN $artist_ids
    RETURN DISTINCT
        p.id        AS poi_id,
        p.name      AS name,
        p.lat       AS lat,
        p.lon       AS lon,
        p.category  AS category,
        p.sido      AS sido,
        p.address   AS address,
        p.image_url AS image_url,
        collect(a.name) AS artists
    LIMIT $limit
    """
    db = os.environ.get("NEO4J_DATABASE", "") or None
    with get_driver().session(database=db) as session:
        result = session.run(query, artist_ids=artist_ids, limit=limit)
        return [dict(r) for r in result]


def get_region_pois(region_names: list[str], limit: int = 20) -> list[dict]:
    """선택 지역의 POI 조회 (address CONTAINS 매칭 — Region 노드 없음)"""
    query = """
    MATCH (p:POI)
    WHERE ANY(r IN $region_names WHERE p.address CONTAINS r)
    RETURN DISTINCT
        p.id        AS poi_id,
        p.name      AS name,
        p.lat       AS lat,
        p.lon       AS lon,
        p.category  AS category,
        p.sido      AS sido,
        p.address   AS address,
        p.image_url AS image_url,
        [r IN $region_names WHERE p.address CONTAINS r][0] AS region
    LIMIT $limit
    """
    db = os.environ.get("NEO4J_DATABASE", "") or None
    with get_driver().session(database=db) as session:
        result = session.run(query, region_names=region_names, limit=limit)
        return [dict(r) for r in result]


def get_regions(limit: int = 20) -> list[dict]:
    """Region 노드 전체 조회 (안전점수 내림차순)"""
    query = """
    MATCH (r:Region)
    RETURN r.id AS id, r.name AS name, r.image_url AS image_url,
           r.safety_score AS safety_score
    ORDER BY r.safety_score DESC
    LIMIT $limit
    """
    db = os.environ.get("NEO4J_DATABASE", "") or None
    with get_driver().session(database=db) as session:
        result = session.run(query, limit=limit)
        return [dict(r) for r in result]


def get_region_profile(region_name: str) -> dict:
    """Region 안전점수 + 날씨/소비 프로파일 조회"""
    query = """
    MATCH (r:Region {name: $region_name})
    OPTIONAL MATCH (r)-[:HAS_WEATHER]->(w:WeatherProfile)
    OPTIONAL MATCH (r)-[:HAS_SPEND]->(s:SpendProfile)
    RETURN r.safety_score AS safety_score,
           w.avg_temp     AS avg_temp,
           w.rainy_days   AS rainy_days,
           s.avg_spend    AS avg_spend,
           s.budget_tier  AS budget_tier
    """
    db = os.environ.get("NEO4J_DATABASE", "") or None
    with get_driver().session(database=db) as session:
        result = session.run(query, region_name=region_name)
        record = result.single()
        return dict(record) if record else {}