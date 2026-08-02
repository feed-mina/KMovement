"""media_location 노드를 그래프 POI 로 옮기는 변환 검증.

Supabase 에는 그래프 파일에 없는 K-pop 성지 1,962곳이 media_ 접두사로 들어 있다.
메타데이터가 한글 키라 변환이 필요하고, 형식이 어긋나면 추천 응답의 필드가 빈
채로 나간다. 실제로 그래프·앙상블·ChromaDB 가 각각 다른 키를 읽는다.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / "scripts" / "merge_media_pois_into_graph.py"
GRAPH_PATH = ROOT / "models" / "kride_graph.json"


def _script():
    spec = importlib.util.spec_from_file_location("media_merge", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SAMPLE = {
    "id": "media_2023_1596",
    "metadata": {
        "경도": 126.921871,
        "위도": 33.437499,
        "주소": "제주특별자치도 서귀포시 성산읍 섭지코지로 56",
        "장소명": "마돈",
        "아티스트": "틴탑",
        "장소설명": "틴탑이 방문한 말고기와 흑돼지 전문점",
        "장소타입": "restaurant",
        "미디어타입": "artist",
    },
}


def test_converted_node_matches_the_graph_poi_schema() -> None:
    """graphrag_client 는 type 이 POI 인 노드만 본다. 키가 하나라도 어긋나면
    조용히 빠지거나 응답의 필드가 빈다."""
    node = _script().to_poi_node(SAMPLE)

    assert node["type"] == "POI"
    assert node["id"] == "media_2023_1596"
    assert node["name"] == "마돈"
    assert node["address"].startswith("제주특별자치도")
    assert node["lat"] == pytest.approx(33.437499)
    assert node["lon"] == pytest.approx(126.921871)
    assert node["description"]

    if GRAPH_PATH.exists():
        graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
        existing = next(n for n in graph["nodes"] if n.get("type") == "POI")
        # 기존 POI 가 가진 키는 전부 있어야 한다. description 만 더 갖는다.
        assert set(existing) <= set(node), set(existing) - set(node)


def test_place_types_map_to_categories_the_collection_builder_knows() -> None:
    """category 는 ChromaDB 컬렉션 분류에 그대로 쓰인다.

    build_poi_collections_from_graph.py 의 매핑에 없는 값을 쓰면 그 POI 는 어느
    컬렉션에도 들어가지 않고 목적 기반 검색에서 사라진다.
    """
    script = _script()
    builder_source = (
        ROOT / "scripts" / "build_poi_collections_from_graph.py"
    ).read_text(encoding="utf-8")

    for place_type, category in script.PLACE_TYPE_TO_CATEGORY.items():
        assert f'"{category}"' in builder_source, (place_type, category)
    assert f'"{script.DEFAULT_CATEGORY}"' in builder_source

    # 식당과 카페는 food 로 가야 한다. 지금 kride_poi_food 컬렉션이 0건인데
    # 이 1,130곳이 그 컬렉션을 처음 채운다.
    assert script.PLACE_TYPE_TO_CATEGORY["restaurant"] == "food"
    assert script.PLACE_TYPE_TO_CATEGORY["cafe"] == "food"


def test_incomplete_rows_are_dropped_rather_than_written_with_holes() -> None:
    """좌표 없는 POI 는 지도 마커에서 빠지고 거리 피처도 계산되지 않는다."""
    script = _script()

    for broken in (
        {"id": "media_1", "metadata": {"장소명": "이름만"}},
        {"id": "media_2", "metadata": {"위도": 1.0, "경도": 2.0}},
        {"id": "media_3", "metadata": {"장소명": "좌표없음", "위도": None, "경도": 2.0}},
        {"id": "media_4", "metadata": {}},
    ):
        assert script.to_poi_node(broken) is None, broken["id"]


def test_dedupe_ignores_spacing_in_addresses() -> None:
    """같은 장소가 소스마다 띄어쓰기를 달리 적는다. 그대로 비교하면 중복이 들어간다."""
    script = _script()

    a = {"name": "마돈", "address": "제주특별자치도 서귀포시 성산읍 섭지코지로 56"}
    b = {"name": "마돈", "address": "제주특별자치도  서귀포시 성산읍  섭지코지로 56"}
    assert script.dedupe_key(a) == script.dedupe_key(b)

    other = {"name": "마돈", "address": "서울특별시 중구"}
    assert script.dedupe_key(a) != script.dedupe_key(other)


def test_a_place_already_in_the_graph_still_gains_its_artist_link() -> None:
    """중복 장소를 건너뛰면 아티스트 연결까지 함께 버려진다.

    dry-run 결과 media 1,962건 중 882건(45%)이 이미 그래프에 있는 장소였다.
    장소는 있지만 "누구의 성지인가" 는 media 쪽에만 있으므로, POI 를 건너뛰면서
    엣지도 만들지 않으면 이번 작업의 목적인 아티스트 매칭에서 절반을 잃는다.
    장소는 재사용하고 연결만 가져와야 한다.
    """
    source = SCRIPT_PATH.read_text(encoding="utf-8")

    # 중복 장소를 통째로 건너뛰던 형태로 돌아가면 안 된다.
    assert 'skipped["같은 이름·주소의 POI 존재"]' not in source

    # 기존 POI 의 id 를 찾아 쓸 수 있어야 한다.
    assert "place_to_id" in source
    assert "place_to_id.get(key)" in source

    # 같은 엣지를 두 번 넣지 않는다. 여러 번 돌려도 결과가 같아야 한다.
    assert "existing_edges" in source
    assert 'e.get("relationship")' in source

    body = source[source.index("for row in media_rows:") :]
    reuse = body.index("reused += 1")
    link = body.index("poi_artists.append")
    assert reuse < link, "재사용한 POI 도 아티스트 연결을 받아야 한다"


def test_the_script_does_not_touch_the_graph_without_an_explicit_flag() -> None:
    source = SCRIPT_PATH.read_text(encoding="utf-8")

    assert '"--apply"' in source
    assert "if not args.apply:" in source

    guard = source.index("if not args.apply:")
    assert "write_text" not in source[:guard]

    # 되돌릴 수단 없이 11MB 원본을 덮어쓰지 않는다.
    assert ".bak" in source
    # 형식이 바뀌면 파일 전체가 diff 에 떠서 실제 추가분을 볼 수 없다.
    assert "indent=2" in source


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="kride_graph.json 없음")
def test_media_addresses_resolve_through_the_region_lookup() -> None:
    """지역 대체 경로는 주소 선두를 시·도 표기와 대조한다.

    media 주소는 "제주특별자치도" 같은 정식 명칭을 쓰는데 UI 는 "제주" 를
    보낸다. 이 변환이 끊기면 병합해도 지역 조회에 잡히지 않는다.
    """
    from src.api.graphrag_client import _address_patterns

    for ui_region, address in (
        ("제주", "제주특별자치도 서귀포시"),
        ("서울", "서울특별시 성동구"),
        ("강원", "강원도 원주시"),
        ("경기", "경기도 남양주시"),
        ("경북", "경상북도 경주시"),
    ):
        head = address.split()[0]
        patterns = _address_patterns([ui_region])
        assert any(p in head for p in patterns), (ui_region, head)
