"""배포 이미지에 실려야 하는 그래프 산출물과 아티스트 해석 경로 검증.

graphrag_client 와 ensemble_client 는 파일이 없으면 예외를 내고, 호출부가 그
예외를 삼켜 빈 결과로 넘어간다. 배포는 성공하고 추천 근거만 사라진다. 실제로
두 파일 모두 이미지에 없는 채로 운영됐다(#217).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
API_DOCKERFILE = ROOT / "src" / "api" / "Dockerfile"
FASTAPI_SERVER = ROOT / "src" / "api" / "fastapi_server.py"
GRAPH_PATH = ROOT / "models" / "kride_graph.json"


def test_runtime_model_artifacts_are_copied_into_the_image() -> None:
    dockerfile = API_DOCKERFILE.read_text(encoding="utf-8")

    assert "COPY models/kride_graph.json /app/models/kride_graph.json" in dockerfile
    assert "COPY models/ensemble_ranker.pkl /app/models/ensemble_ranker.pkl" in dockerfile

    # 빌드 스크립트 전용 산출물까지 넣지 않는다. graphml 은 14MB 이고 런타임에서
    # 읽지 않는다. 주석에서의 언급은 허용하고 COPY 지시문만 본다.
    copied = [
        line for line in dockerfile.splitlines() if line.strip().startswith("COPY ")
    ]
    assert not [line for line in copied if "graphml" in line]
    assert not [line for line in copied if "kride_graph_delta" in line]


def test_runtime_reads_the_artifacts_the_dockerfile_copies() -> None:
    """이미지 경로와 코드가 기대하는 경로가 어긋나면 조용히 빈 결과가 된다."""
    graphrag = (ROOT / "src" / "api" / "graphrag_client.py").read_text(encoding="utf-8")
    ensemble = (ROOT / "src" / "api" / "ensemble_client.py").read_text(encoding="utf-8")

    assert '"models", "kride_graph.json"' in graphrag
    assert '"models", "ensemble_ranker.pkl"' in ensemble


def test_itinerary_resolves_artist_ids_by_name_not_by_position() -> None:
    """예전에는 요청 아티스트 개수만큼 artist_1, artist_2 ... 를 만들었다.

    이름과 무관한 노드를 가리켜서, ["BTS"] 가 artist_1(선재 업고 튀어)이 됐다.
    """
    server = FASTAPI_SERVER.read_text(encoding="utf-8")

    assert 'f"artist_{i+1}"' not in server

    start = server.index('@app.post("/api/recommend/itinerary")')
    end = server.index("\n@app.", start + 1)
    itinerary = server[start:end]

    assert "search_artists_by_name(search_artists)" in itinerary


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="kride_graph.json 없음")
def test_english_artist_names_resolve_to_real_graph_nodes() -> None:
    """영문 요청 → ARTIST_NAME_MAP → 한글 → graph artist_id 체인이 이어지는지.

    체인이 끊기면 GraphRAG 확장이 조용히 0건이 된다.
    """
    from src.api.graphrag_client import search_artists_by_name

    source = FASTAPI_SERVER.read_text(encoding="utf-8")
    block = source[source.index("FALLBACK_ARTISTS = [") :]
    block = block[: block.index("\n]") + 2]
    name_to_ko = dict(
        re.findall(r'"name":\s*"([^"]+)",\s*"name_ko":\s*"([^"]+)"', block)
    )
    assert name_to_ko, "FALLBACK_ARTISTS 를 읽지 못했다"

    graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    id_to_name = {
        n["id"]: n["name"] for n in graph["nodes"] if n.get("type") == "Artist"
    }

    # fastapi_server 가 만드는 search_artists 와 같은 형태로 넘긴다.
    def resolve(requested: str) -> list[str]:
        korean = name_to_ko.get(requested, requested)
        return search_artists_by_name(list({requested, korean}))

    for requested, expected in (
        ("BTS", "방탄소년단"),
        ("BLACKPINK", "블랙핑크"),
        ("IU", "아이유"),
    ):
        ids = resolve(requested)
        assert ids, f"{requested} 가 graph artist 로 해석되지 않았다"
        assert id_to_name[ids[0]] == expected

    # 한글 이름도 그대로 해석돼야 한다. 그래프에는 드라마 노드도 있다.
    assert id_to_name[search_artists_by_name(["도깨비(드라마)"])[0]] == "도깨비(드라마)"
