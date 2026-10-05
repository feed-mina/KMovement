import math
import networkx as nx
import pytest
from fastapi import HTTPException
from src.api.route_contract import checked_node, closed_course


def graph():
    g = nx.Graph()
    g.add_edge((37.5, 127.0), (37.51, 127.0), length_km=1)
    g.add_edge((37.51, 127.0), (37.52, 127.0), length_km=1)
    return g


def test_course_returns_to_start_with_real_distance():
    path, distance = closed_course(graph(), (37.5, 127.0), 4)
    assert path[0] == path[-1]
    assert len(path) == 5 and distance == 4


def test_course_does_not_disguise_one_point_as_success():
    with pytest.raises(HTTPException) as e:
        closed_course(graph(), (37.5, 127.0), .2)
    assert e.value.status_code == 404


@pytest.mark.parametrize('lat,lon', [(math.nan,127), (91,127), (37,181), (math.inf,127)])
def test_invalid_coordinates_rejected(lat,lon):
    with pytest.raises(HTTPException) as e:
        checked_node(graph(), lat, lon, lambda *_:(37.5,127), lambda *_:0)
    assert e.value.status_code == 422


def test_far_away_point_is_not_silently_snapped():
    with pytest.raises(HTTPException) as e:
        checked_node(graph(), 35,129, lambda *_:(37.5,127), lambda *_:300)
    assert e.value.status_code == 422


def test_directed_course_requires_return_path():
    g=nx.DiGraph();g.add_edge('a','b',length_km=1)
    with pytest.raises(HTTPException) as e:
        closed_course(g,'a',2)
    assert e.value.status_code == 404
