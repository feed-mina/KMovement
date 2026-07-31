"""Preferred artists 집계 소스 확장 검증.

명시적으로 고른 아티스트만 세면 MY_PAGE 'Preferred artists' 카드가 좀처럼 채워지지
않는다. 실제로 추천된 성지 POI 가 달고 있는 아티스트까지 함께 집계한다.
"""
from src.api.route_history import (
    _aggregate_history,
    _compact_poi,
    _extract_artists,
)


def _row(**kwargs):
    base = {
        "request_payload": {},
        "response_payload": {},
        "recommended_pois": [],
    }
    base.update(kwargs)
    return base


def test_explicit_artist_selection_still_counted():
    row = _row(request_payload={"artists": ["BTS", "IVE"]})

    assert _extract_artists(row, row["request_payload"], row["response_payload"]) == ["BTS", "IVE"]


def test_singular_artist_keys_counted():
    row = _row(request_payload={"artist": "NewJeans"}, response_payload={"artistName": "aespa"})

    artists = _extract_artists(row, row["request_payload"], row["response_payload"])

    assert "NewJeans" in artists
    assert "aespa" in artists


def test_artists_collected_from_recommended_pois():
    """성지 POI 는 artist 를 갖고 있다. 요청에 아티스트가 없어도 이력이 남는다."""
    row = _row(
        recommended_pois=[
            {"name": "주문진 방파제", "artist": "BTS"},
            {"name": "홍대 걷고싶은거리", "fandom_info": "ARMY"},
            {"name": "이름만 있는 곳"},
        ]
    )

    artists = _extract_artists(row, row["request_payload"], row["response_payload"])

    assert "BTS" in artists
    assert "ARMY" in artists


def test_malformed_poi_list_is_ignored():
    for broken in (None, "not-a-list", [1, 2, 3], [None]):
        row = _row(recommended_pois=broken)
        assert _extract_artists(row, {}, {}) == []


def test_duplicate_artists_are_deduplicated_per_row():
    row = _row(
        request_payload={"artists": ["BTS"]},
        recommended_pois=[{"name": "a", "artist": "BTS"}, {"name": "b", "artist": "BTS"}],
    )

    assert _extract_artists(row, row["request_payload"], row["response_payload"]) == ["BTS"]


def test_aggregate_counts_artists_across_rows():
    rows = [
        _row(recommended_pois=[{"name": "a", "artist": "BTS"}]),
        _row(request_payload={"artists": ["BTS"]}),
        _row(recommended_pois=[{"name": "b", "artist": "IVE"}]),
    ]

    aggregate = _aggregate_history(rows)
    counts = {point["label"]: point["value"] for point in aggregate["preferred_artists"]}

    assert counts["BTS"] == 2
    assert counts["IVE"] == 1


def test_compact_poi_keeps_artist_fields():
    """저장 시점에 artist 를 버리면 나중에 집계할 수 없다."""
    compact = _compact_poi(
        {
            "poi_id": "p1",
            "name": "주문진 방파제",
            "artist": "BTS",
            "fandom_info": "ARMY",
            "unrelated": "drop me",
        }
    )

    assert compact["artist"] == "BTS"
    assert compact["fandom_info"] == "ARMY"
    assert "unrelated" not in compact
