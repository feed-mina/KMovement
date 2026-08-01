"""models/kride_graph.json → ChromaDB POI 컬렉션 4종 생성.

기존 scripts/build_poi_collections.py 는 Neo4j 에서 POI 를 읽는다. Aura
인스턴스가 사라져 그대로는 실행할 수 없다(#217). 같은 POI 가 저장소의 그래프
파일에 그대로 있으므로 그쪽에서 읽도록 다시 쓴다.

문서 텍스트와 메타데이터 형식은 기존 스크립트와 동일하게 맞춘다. rag_client 의
search_pois_by_purpose 가 메타데이터를 그대로 POI 로 돌려주므로 형식이 어긋나면
추천 응답의 필드가 빈다.

임베딩 모델은 런타임(src/api/torchserve_client.py)과 같은 것을 쓴다. 다른
모델로 만들면 차원이나 벡터 공간이 어긋나 검색이 엉뚱한 결과를 낸다.

사용법

    pip install chromadb sentence-transformers

    python scripts/build_poi_collections_from_graph.py --dry-run   # 계획만
    python scripts/build_poi_collections_from_graph.py --limit 200 # 소량 시험
    python scripts/build_poi_collections_from_graph.py             # 전체

39,584건 임베딩은 CPU 에서 수십 분 걸린다. --limit 로 먼저 확인하는 편이 낫다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "models" / "kride_graph.json"

CHROMA_PATH = os.environ.get("CHROMA_PATH", str(ROOT / "chroma_db"))
# 런타임 기본값과 같아야 한다. src/api/torchserve_client.py 참고.
EMBED_MODEL = os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small")
BATCH_SIZE = 200

# 기존 build_poi_collections.py 의 매핑을 그대로 따른다.
CATEGORY_TO_COLLECTION = {
    "kculture": "kride_poi_kculture",
    "kpop": "kride_poi_kculture",
    "food": "kride_poi_food",
    "nature": "kride_poi_nature",
    "history": "kride_poi_history",
    "tourism": "kride_poi_history",
}
ALL_COLLECTIONS = sorted(set(CATEGORY_TO_COLLECTION.values()))


def build_document_text(poi: dict) -> str:
    """POI → 검색용 텍스트. 기존 스크립트와 같은 형식."""
    parts = []
    if poi.get("name"):
        parts.append(poi["name"])
    if poi.get("category"):
        parts.append(f"카테고리: {poi['category']}")
    if poi.get("address"):
        parts.append(poi["address"])
    if poi.get("sido"):
        parts.append(poi["sido"])
    artists = [a for a in (poi.get("artists") or []) if a]
    if artists:
        parts.append(f"아티스트: {', '.join(artists)}")
    return " | ".join(parts) if parts else poi.get("id", "unknown")


def build_metadata(poi: dict) -> dict:
    """ChromaDB 는 None 을 허용하지 않는다. 빈 문자열과 0.0 으로 채운다."""
    meta = {
        "id": poi.get("id", ""),
        "name": poi.get("name") or "",
        "category": poi.get("category") or "",
        "address": poi.get("address") or "",
        "sido": poi.get("sido") or "",
        "lat": float(poi["lat"]) if poi.get("lat") is not None else 0.0,
        "lon": float(poi["lon"]) if poi.get("lon") is not None else 0.0,
        "image_url": poi.get("image_url") or "",
    }
    artists = [a for a in (poi.get("artists") or []) if a]
    if artists:
        meta["artists"] = ", ".join(artists)
    return meta


def load_pois() -> list[dict]:
    """POI 노드에 시·도와 출연 아티스트를 붙여서 돌려준다."""
    if not GRAPH_PATH.exists():
        sys.exit(f"그래프 파일이 없다: {GRAPH_PATH}")
    graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))

    nodes = {n["id"]: n for n in graph.get("nodes", [])}

    # FILMING_AT 은 poi → artist 방향이다. 검색 텍스트에 아티스트 이름을 넣으면
    # "방탄소년단 촬영지" 같은 질의가 걸린다.
    poi_artists: dict[str, list[str]] = defaultdict(list)
    for edge in graph.get("edges", []):
        artist = nodes.get(edge.get("target"))
        if artist and artist.get("type") == "Artist" and artist.get("name"):
            poi_artists[edge.get("source")].append(artist["name"])

    pois = []
    for node in graph.get("nodes", []):
        if node.get("type") != "POI":
            continue
        address = node.get("address") or ""
        pois.append(
            {
                **node,
                "sido": address.split()[0] if address else "",
                "artists": poi_artists.get(node["id"], []),
            }
        )
    return pois


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="계획만 출력하고 끝낸다.")
    parser.add_argument("--limit", type=int, default=0, help="POI 를 N개까지만 처리한다.")
    args = parser.parse_args()

    pois = load_pois()
    if args.limit:
        pois = pois[: args.limit]

    grouped: dict[str, list[dict]] = defaultdict(list)
    unmapped: dict[str, int] = defaultdict(int)
    for poi in pois:
        collection = CATEGORY_TO_COLLECTION.get(poi.get("category") or "")
        if collection:
            grouped[collection].append(poi)
        else:
            unmapped[poi.get("category") or "(없음)"] += 1

    print(f"POI {len(pois):,}건")
    for name in ALL_COLLECTIONS:
        count = len(grouped.get(name, []))
        note = "  ← 그래프에 해당 카테고리 POI 가 없다" if count == 0 else ""
        print(f"  {name:<22} {count:>7,}{note}")
    if unmapped:
        print(f"  매핑되지 않은 category: {dict(unmapped)}")
    print(f"\nChromaDB 경로: {CHROMA_PATH}")
    print(f"임베딩 모델: {EMBED_MODEL}")

    if args.dry_run:
        print("\ndry-run 이다. 실제로 만들려면 --dry-run 을 빼고 실행한다.")
        return 0

    import chromadb
    from sentence_transformers import SentenceTransformer

    embedder = SentenceTransformer(EMBED_MODEL)
    client = chromadb.PersistentClient(path=CHROMA_PATH)

    for name in ALL_COLLECTIONS:
        col_pois = grouped.get(name, [])
        if not col_pois:
            # 빈 컬렉션이라도 만들어 둔다. get_collection 이 예외를 내면
            # rag_client 가 그 목적 전체를 건너뛴다.
            client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})
            print(f"{name}: 대상 POI 가 없어 빈 컬렉션만 만든다")
            continue

        try:
            client.delete_collection(name)
        except Exception:
            pass
        collection = client.create_collection(name=name, metadata={"hnsw:space": "cosine"})

        print(f"{name}: {len(col_pois):,}건 인덱싱")
        for start in range(0, len(col_pois), BATCH_SIZE):
            batch = col_pois[start : start + BATCH_SIZE]
            documents = [build_document_text(p) for p in batch]
            vectors = embedder.encode(
                documents, normalize_embeddings=True, batch_size=64
            ).tolist()
            collection.upsert(
                ids=[p["id"] for p in batch],
                documents=documents,
                metadatas=[build_metadata(p) for p in batch],
                embeddings=vectors,
            )
            print(f"  {min(start + BATCH_SIZE, len(col_pois)):,}/{len(col_pois):,}")

    print("\n완료")
    for name in ALL_COLLECTIONS:
        print(f"  {name}: {client.get_collection(name).count():,}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
