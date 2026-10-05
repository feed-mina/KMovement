"""CPU route input and closed-course contracts, independent of AI services."""
import math
import networkx as nx
from fastapi import HTTPException


def checked_node(graph, lat, lon, nearest, distance):
    if not math.isfinite(lat) or not math.isfinite(lon):
        raise HTTPException(422, "좌표는 유한한 숫자여야 합니다.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(422, "좌표 범위를 확인해 주세요.")
    node = nearest(graph, lat, lon)
    if distance((lat, lon), node) > 2.0:
        raise HTTPException(422, "지원 도로에서 2km 이내의 출발·도착점을 선택해 주세요.")
    return node


def closed_course(graph, start, target_km):
    """An explicit out-and-back course; never label an open DFS path a loop."""
    def length(u, v, attrs):
        value = float(attrs.get('length_km', 0))
        if not math.isfinite(value) or value <= 0:
            raise HTTPException(503, "도로 거리 자료가 올바르지 않습니다.")
        return value
    distances, paths = nx.single_source_dijkstra(graph, start, cutoff=target_km / 2, weight=length)
    candidates = [(d, n) for n, d in distances.items() if d > 0]
    if not candidates:
        raise HTTPException(404, "요청 거리 안에서 왕복 코스를 찾지 못했습니다.")
    outward, end = max(candidates, key=lambda item: item[0])
    path = paths[end]
    if graph.is_directed():
        try:
            back = nx.shortest_path(graph, end, start, weight=length)
        except nx.NetworkXNoPath:
            raise HTTPException(404, "출발점으로 돌아오는 경로가 없습니다.")
    else:
        back = list(reversed(path))
    total = outward + sum(length(u, v, graph[u][v]) for u, v in zip(back, back[1:]))
    if not target_km * .8 <= total <= target_km * 1.2:
        raise HTTPException(404, "요청 거리의 허용 범위 안에서 왕복 코스를 찾지 못했습니다.")
    return path + back[1:], total
