"""Supabase 의 media_location 노드를 models/kride_graph.json 에 병합한다.

Supabase 에는 그래프 파일에 없는 노드가 1,962개 있다. id 가 media_ 로 시작하고
category 가 media_location 인 것들인데, 부가 정보가 아니라 주소·좌표·아티스트·
설명을 갖춘 실제 K-pop 성지다. 메타데이터는 한글 키를 쓴다.

    {"장소명": "마돈", "주소": "제주특별자치도 서귀포시 ...", "위도": 33.437499,
     "경도": 126.921871, "아티스트": "틴탑", "장소타입": "restaurant",
     "장소설명": "틴탑이 방문한 말고기와 흑돼지 전문점", "미디어타입": "artist"}

여기 붙은 아티스트는 117종으로 그래프의 40종보다 훨씬 많다. 특히 UI 목록에는
있는데 그래프에 노드가 없어 계속 빈 결과를 내던 12종(인피니트·빅톤·지드래곤·
프로미스나인·청하·블락비·걸스데이·GOT7·하이라이트·비·뉴이스트·강다니엘)이
전부 여기 있다. 병합하면 그 요청들이 지역 대체가 아니라 실제 성지를 받는다.

장소타입은 그래프 category 로 바꾼다. restaurant/cafe 는 food 로 가는데, 지금
ChromaDB 의 kride_poi_food 컬렉션이 0건이라 이쪽이 처음으로 채워진다.

사용법

    export SUPABASE_URL=... SUPABASE_KEY=...   # secret 키여야 RLS 를 통과한다

    python scripts/merge_media_pois_into_graph.py            # 계획만 (dry-run)
    python scripts/merge_media_pois_into_graph.py --apply    # 실제로 파일을 쓴다

--apply 는 models/kride_graph.json 을 덮어쓴다. 병합 전 파일은 .bak 으로 남긴다.
병합 후에는 ChromaDB 컬렉션을 다시 만들어 EC2 로 올려야 반영된다.

    python scripts/build_poi_collections_from_graph.py
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "models" / "kride_graph.json"

PAGE = 1000

# 메타데이터 키. 소스가 한글 키를 쓴다.
K_NAME = "장소명"
K_ADDR = "주소"
K_LAT = "위도"
K_LON = "경도"
K_ARTIST = "아티스트"
K_PLACE_TYPE = "장소타입"
K_DESC = "장소설명"

# 장소타입 → 그래프 category. 그래프는 kculture / tourism / kpop 을 쓰고,
# ChromaDB 컬렉션 매핑(build_poi_collections_from_graph.py)은 food 와 nature 도
# 안다. 지금 food 컬렉션이 비어 있는데 restaurant 와 cafe 가 그쪽을 채운다.
# 나머지는 전부 아티스트 관련 장소이므로 kculture 로 둔다.
PLACE_TYPE_TO_CATEGORY = {
    "restaurant": "food",
    "cafe": "food",
    "playground": "kculture",
    "stay": "kculture",
    "store": "kculture",
    "station": "kculture",
    "shop": "kculture",
}
DEFAULT_CATEGORY = "kculture"


def fetch_media_nodes(client) -> list[dict]:
    rows: list[dict] = []
    start = 0
    while True:
        chunk = (
            client.table("nodes")
            .select("id, metadata")
            .like("id", "media_%")
            .range(start, start + PAGE - 1)
            .execute()
            .data
            or []
        )
        rows.extend(chunk)
        if len(chunk) < PAGE:
            return rows
        start += PAGE


def to_poi_node(row: dict) -> dict | None:
    """media 노드 → 그래프 POI 노드. 좌표나 이름이 없으면 버린다."""
    meta = row.get("metadata") or {}
    name = (meta.get(K_NAME) or "").strip()
    lat, lon = meta.get(K_LAT), meta.get(K_LON)
    if not name or lat is None or lon is None:
        return None

    place_type = (meta.get(K_PLACE_TYPE) or "").strip()
    node = {
        "type": "POI",
        "name": name,
        "category": PLACE_TYPE_TO_CATEGORY.get(place_type, DEFAULT_CATEGORY),
        "sub_category": place_type or "media",
        "address": (meta.get(K_ADDR) or "").strip(),
        "lat": float(lat),
        "lon": float(lon),
        # community 는 원 그래프의 클러스터링 결과다. 새 노드는 그 계산에
        # 참여하지 않았으므로 비워 둔다. get_graphrag_pois 는 community 가
        # None 이면 커뮤니티 확장에서 제외할 뿐 나머지 경로는 그대로 탄다.
        "community": None,
        "id": row["id"],
    }
    desc = (meta.get(K_DESC) or "").strip()
    if desc:
        node["description"] = desc
    return node


def dedupe_key(node: dict) -> tuple[str, str]:
    """같은 장소가 두 번 들어가지 않게 이름과 주소로 본다.

    좌표는 소수점 자리가 소스마다 달라 그대로 비교하면 중복을 놓친다.
    """
    return (node["name"], (node.get("address") or "").replace(" ", ""))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="models/kride_graph.json 을 실제로 덮어쓴다. 주지 않으면 계획만 낸다.",
    )
    args = parser.parse_args()

    if not GRAPH_PATH.exists():
        sys.exit(f"그래프 파일이 없다: {GRAPH_PATH}")
    graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    nodes: list[dict] = graph.get("nodes", [])
    edges: list[dict] = graph.get("edges", [])
    print(f"현재 그래프: 노드 {len(nodes):,}건, 엣지 {len(edges):,}건")

    for var in ("SUPABASE_URL", "SUPABASE_KEY"):
        if not os.environ.get(var):
            sys.exit(f"{var} 가 설정돼 있지 않다.")

    from supabase import create_client

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    media_rows = fetch_media_nodes(client)
    print(f"Supabase media 노드: {len(media_rows):,}건")
    if not media_rows:
        sys.exit(
            "media 노드를 읽지 못했다. publishable 키는 RLS 에 막혀 0건을 돌려준다."
        )

    existing_ids = {n["id"] for n in nodes}
    # 같은 장소가 이미 그래프에 있으면 POI 를 새로 만들지 않고 그 id 를 쓴다.
    # 장소만 건너뛰고 끝내면 "이 장소가 누구의 성지인가" 라는 연결까지 함께
    # 버려진다. media 노드 1,962건 중 882건이 여기 해당해서, 그렇게 하면 이번
    # 작업의 목적인 아티스트 매칭에서 45% 를 잃는다.
    place_to_id = {
        dedupe_key(n): n["id"] for n in nodes if n.get("type") == "POI"
    }
    artist_ids = {
        n["name"]: n["id"] for n in nodes if n.get("type") == "Artist" and n.get("name")
    }
    existing_edges = {
        (e.get("source"), e.get("target"), e.get("relationship")) for e in edges
    }
    next_artist_no = max(
        (int(n["id"].split("_")[1]) for n in nodes if n.get("type") == "Artist"), default=0
    )

    new_pois: list[dict] = []
    new_artists: list[dict] = []
    new_edges: list[dict] = []
    skipped = Counter()
    categories = Counter()
    reused = 0
    poi_artists: list[tuple[str, str]] = []

    for row in media_rows:
        if row["id"] in existing_ids:
            skipped["이미 있는 id"] += 1
            continue
        node = to_poi_node(row)
        if node is None:
            skipped["이름·좌표 없음"] += 1
            continue

        key = dedupe_key(node)
        poi_id = place_to_id.get(key)
        if poi_id is None:
            poi_id = node["id"]
            place_to_id[key] = poi_id
            new_pois.append(node)
            categories[node["category"]] += 1
        else:
            # 장소는 그대로 두고 아티스트 연결만 가져온다.
            reused += 1

        artist_name = ((row.get("metadata") or {}).get(K_ARTIST) or "").strip()
        if artist_name:
            poi_artists.append((poi_id, artist_name))
        else:
            skipped["아티스트 없음"] += 1

    # 아티스트 노드는 POI 를 다 추린 뒤에 만든다. 버려진 POI 때문에 아무 POI 도
    # 딸리지 않는 아티스트 노드가 생기지 않게 하려는 것이다.
    for poi_id, artist_name in poi_artists:
        aid = artist_ids.get(artist_name)
        if aid is None:
            next_artist_no += 1
            aid = f"artist_{next_artist_no}"
            artist_ids[artist_name] = aid
            new_artists.append(
                {
                    "type": "Artist",
                    "name": artist_name,
                    "category": "kpop",
                    "community": None,
                    "id": aid,
                }
            )
        edge = (poi_id, aid, "FILMING_AT")
        if edge in existing_edges:
            skipped["이미 있는 엣지"] += 1
            continue
        existing_edges.add(edge)
        new_edges.append(
            {"relationship": "FILMING_AT", "source": poi_id, "target": aid}
        )

    print()
    print(f"추가될 POI      {len(new_pois):,}건  {dict(categories)}")
    print(f"기존 POI 재사용 {reused:,}건  (장소는 그대로 두고 아티스트 연결만 가져옴)")
    print(f"추가될 아티스트 {len(new_artists):,}종")
    print(f"추가될 엣지     {len(new_edges):,}건")
    if skipped:
        print(f"건너뛴 것: {dict(skipped)}")
    if new_artists:
        preview = ", ".join(a["name"] for a in new_artists[:12])
        print(f"새 아티스트 예: {preview}")

    if not args.apply:
        print("\ndry-run 이다. 실제로 쓰려면 --apply 를 준다.")
        return 0

    if not new_pois:
        print("\n추가할 것이 없다. 파일을 건드리지 않는다.")
        return 0

    backup = GRAPH_PATH.with_suffix(".json.bak")
    backup.write_text(GRAPH_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"\n병합 전 파일을 {backup.name} 으로 남겼다.")

    graph["nodes"] = nodes + new_pois + new_artists
    graph["edges"] = edges + new_edges
    # 원본이 2칸 들여쓰기다. 형식을 바꾸면 11MB 파일 전체가 diff 에 뜬다.
    # 배열 끝에 덧붙이므로 형식만 지키면 추가분만 보인다.
    GRAPH_PATH.write_text(
        json.dumps(graph, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"완료. 노드 {len(graph['nodes']):,}건, 엣지 {len(graph['edges']):,}건"
    )
    print("ChromaDB 컬렉션을 다시 만들어야 반영된다:")
    print("    python scripts/build_poi_collections_from_graph.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
