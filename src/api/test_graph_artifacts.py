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

    # 그래프에 노드가 있으면 UI 목록에서도 고를 수 있어야 한다.
    for requested, expected in (("ITZY", "Itzy"), ("IVE", "아이브")):
        assert requested in name_to_ko, f"{requested} 가 FALLBACK_ARTISTS 에 없다"
        ids = resolve(requested)
        assert ids and id_to_name[ids[0]] == expected


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="kride_graph.json 없음")
def test_region_lookup_returns_pois_for_covered_regions() -> None:
    """아티스트가 그래프에 없을 때 쓰는 대체 경로.

    그래프 아티스트는 40종뿐이라 UI 목록의 상당수가 매칭되지 않는다. 그때
    빈 일정 대신 선택한 지역의 POI 를 준다.
    """
    from src.api.graphrag_client import get_region_pois_from_graph

    seoul = get_region_pois_from_graph(["서울"], max_pois=5)
    assert len(seoul) == 5
    for poi in seoul:
        assert poi["source"] == "graphrag_region"
        assert "서울" in poi["address"][:8]
        assert poi["poi_id"] and poi["name"]

    # 여러 지역을 함께 넘길 수 있다.
    assert get_region_pois_from_graph(["강원", "부산"], max_pois=3)

    # 이미 담긴 POI 는 제외한다.
    first = seoul[0]["poi_id"]
    again = get_region_pois_from_graph(["서울"], existing_poi_ids={first}, max_pois=5)
    assert first not in {p["poi_id"] for p in again}

    assert get_region_pois_from_graph([], max_pois=5) == []


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="kride_graph.json 없음")
def test_every_ui_region_matches_its_address_spelling() -> None:
    """UI 는 축약형을, 주소는 정식 명칭을 쓴다.

    "경북" 은 "경상북도" 안에 글자가 떨어져 있어 단순 포함 검사로는 걸리지
    않는다. 그 탓에 데이터가 있는데도 5개 시·도가 빈 결과를 내고 있었다.
    """
    from src.api.graphrag_client import get_region_pois_from_graph

    # REGIONS 와 같은 17개 시·도.
    for region in (
        "서울", "경기", "인천", "강원", "충북", "충남", "전북", "전남",
        "경북", "경남", "부산", "대구", "광주", "대전", "울산", "세종", "제주",
    ):
        pois = get_region_pois_from_graph([region], max_pois=1)
        assert pois, f"{region} 이 그래프 POI 와 매칭되지 않는다"

    # 정식 명칭을 그대로 넘겨도 동작해야 한다.
    assert get_region_pois_from_graph(["경상북도"], max_pois=1)


def test_neo4j_is_retired_from_the_runtime() -> None:
    """Aura 인스턴스가 사라진 뒤 세 호출은 늘 예외를 내고 빈 리스트가 됐다.

    같은 데이터를 GraphRAG 가 kride_graph.json 에서 제공하므로 드라이버째
    걷어냈다. 되살리려면 인스턴스와 적재 절차부터 있어야 한다. 그때까지는
    죽은 호출이 다시 들어오지 않도록 막는다.
    """
    assert not (ROOT / "src" / "api" / "neo4j_client.py").exists()

    server = FASTAPI_SERVER.read_text(encoding="utf-8")
    assert "neo4j_client" not in server
    for gone in ("get_artist_pois", "get_region_pois(", "get_regions("):
        assert gone not in server, gone

    # 드라이버가 이미지에 남아 있으면 진단이 다시 붙기 쉽다.
    for name in ("requirements-docker.txt", "requirements.txt"):
        text = (ROOT / "src" / "api" / name).read_text(encoding="utf-8")
        assert not re.search(r"^neo4j==", text, re.MULTILINE), name

    # 배포에 자리표시자만 남으면 치환되지 않은 문자열이 원격에서 그대로 돈다.
    deploy = (ROOT / "deploy" / "ec2" / "deploy.sh").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "deploy-ec2.yml").read_text(encoding="utf-8")
    assert "NEO4J" not in deploy
    assert "NEO4J" not in workflow


def test_ensemble_ranker_dependency_is_pinned_for_the_image() -> None:
    """산출물을 이미지에 넣는 것만으로는 부족하다.

    ensemble_ranker.pkl 은 LightGBM LGBMRanker 라서 unpickle 에 lightgbm 이
    필요하다. #218 에서 파일은 넣었지만 의존성이 없어 ModuleNotFoundError 가
    났고, ensemble_client 가 그것을 삼켜 rank_pois 가 candidates[:top_k] 로
    떨어졌다. 순위 없이 합쳐진 순서 그대로 나가는 상태가 배포마다 반복됐다.
    """
    requirements = (ROOT / "src" / "api" / "requirements-docker.txt").read_text(
        encoding="utf-8"
    )
    assert re.search(r"^lightgbm==", requirements, re.MULTILINE), (
        "ensemble_ranker.pkl 을 열려면 lightgbm 이 필요하다"
    )

    model_path = ROOT / "models" / "ensemble_ranker.pkl"
    if model_path.exists():
        # 모델을 다른 라이브러리로 다시 학습하면 이 핀도 같이 바뀌어야 한다.
        blob = model_path.read_bytes()
        assert b"lightgbm" in blob, (
            "모델이 더는 LightGBM 이 아니다. requirements 의 핀을 맞춰야 한다"
        )


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="kride_graph.json 없음")
def test_graphrag_pois_carry_artist_names_for_the_ranker() -> None:
    """앙상블의 neo4j_artist_count 피처가 POI 의 artists 길이를 읽는다.

    호출부는 graphrag POI 를 neo4j_pois 인자로 넘긴다. 그런데 graphrag POI 에
    artists 키가 없어 그 피처가 항상 0 이었다. 8개 중 1개가 죽은 채로 랭킹이
    돌던 셈이다.
    """
    from src.api.graphrag_client import (
        get_graphrag_pois,
        get_region_pois_from_graph,
        search_artists_by_name,
    )

    artist_ids = search_artists_by_name(["방탄소년단"])
    assert artist_ids

    pois = get_graphrag_pois(artist_ids, set(), max_pois=10)
    assert pois
    for poi in pois:
        assert isinstance(poi["artists"], list)
    # 커뮤니티 확장으로 딸려온 POI 는 비어 있을 수 있다. 요청한 아티스트의
    # 촬영지는 최소 한 건 이름을 달고 있어야 한다.
    assert any(poi["artists"] for poi in pois)

    # 지역 경로도 같은 형식을 지켜야 랭커가 두 소스를 같게 다룬다.
    for poi in get_region_pois_from_graph(["서울"], max_pois=5):
        assert isinstance(poi["artists"], list)


def test_recommend_paths_fall_back_to_region_when_artist_is_unknown() -> None:
    server = FASTAPI_SERVER.read_text(encoding="utf-8")

    assert "get_region_pois_from_graph" in server
    # import 실패 시에도 서버가 뜨도록 스텁이 있어야 한다.
    assert "get_region_pois_from_graph = None" in server

    for endpoint in ('@app.post("/api/recommend/ai")', '@app.post("/api/recommend/itinerary")'):
        start = server.index(endpoint)
        block = server[start : server.index("\n@app.", start + 1)]
        assert "not graphrag_pois and regions and get_region_pois_from_graph" in block
        # 데이터 없이 나간 아티스트를 로그에 남겨야 나중에 채울 수 있다.
        assert "그래프에 없는 아티스트" in block
