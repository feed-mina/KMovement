"""
build_route_graph.py  (v2 — osmnx 기반)
========================================
기존 방식(road_scored.csv start/end 좌표 연결)은 원천 데이터가
행정구역 단위로 분절되어 그래프 연결성이 1~3% 수준으로 경로탐색 불가.

v2: osmnx로 서울 자전거 도로 네트워크(토폴로지 보장) 다운로드 후,
    기존 road_scored.csv의 safety/tourism 점수를 최근접 매핑으로 부여.

[ 실행 순서 ]
  python kride-project/build_route_graph.py

[ 단계 요약 ]
  STEP 1 : road_scored.csv 로드 (안전/관광 점수 소스)
  STEP 2 : osmnx로 서울 자전거 도로 네트워크 다운로드
  STEP 3 : OSM 엣지 ↔ road_scored 최근접 매핑 → 점수 부여
  STEP 4 : 연결성 분석
  STEP 5 : route_graph.pkl 저장

[ 출력 파일 ]
  kride-project/models/route_graph.pkl
"""

import os
import sys
import pickle
import warnings

import pandas as pd
import networkx as nx
import osmnx as ox
from scipy.spatial import KDTree

warnings.filterwarnings("ignore")

# ── 경로 설정 ──────────────────────────────────────────────────────────────────
try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    BASE_DIR = os.path.abspath(os.path.join(os.getcwd(), "kride-project"))
    if not os.path.exists(BASE_DIR):
        BASE_DIR = os.getcwd()

PROJECT_ROOT  = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
RAW_DIR       = os.path.join(PROJECT_ROOT, "dataset", "data", "raw_ml")
MODELS_DIR    = os.path.join(PROJECT_ROOT, "dataset", "models")
SCORED_V2     = os.path.join(RAW_DIR,    "road_scored_v2.csv")
SCORED_V1     = os.path.join(RAW_DIR,    "road_scored.csv")
SCORED_PATH   = SCORED_V2 if os.path.exists(SCORED_V2) else SCORED_V1
GRAPH_PATH    = os.path.join(MODELS_DIR, "route_graph.pkl")
OSM_CACHE     = os.path.join(MODELS_DIR, "osm_bike_cache.graphml")

# road_scored 점수를 OSM 엣지에 매핑할 최대 거리 (km)
MAX_MATCH_KM = 2.0


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: road_scored.csv 로드 (안전/관광 점수 소스)
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 65)
print("STEP 1: road_scored.csv 로드 (점수 소스)")
print("=" * 65)

if not os.path.exists(SCORED_PATH):
    print(f"  ❌ {SCORED_PATH} 없음. build_tourism_model.py를 먼저 실행하세요.")
    sys.exit(1)

print(f"  소스 파일: {os.path.basename(SCORED_PATH)}")
df = pd.read_csv(SCORED_PATH, encoding="utf-8-sig")

# v2 컬럼이 있으면 우선 사용
if "tourism_score_v2" in df.columns:
    df["tourism_score"] = df["tourism_score_v2"]
    print("  tourism_score_v2 사용 (TabNet 매력도 보정)")
if "final_score_v2" in df.columns:
    df["final_score"] = df["final_score_v2"]
    print("  final_score_v2 사용")

for col in ["start_lat", "start_lon", "safety_score", "tourism_score", "final_score"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")
df = df.dropna(subset=["start_lat", "start_lon", "safety_score", "tourism_score", "final_score"])
print(f"  유효 행: {len(df):,}개")

# 매핑 실패 시 사용할 기본값 (중앙값)
default_safety  = float(df["safety_score"].median())
default_tourism = float(df["tourism_score"].median())
default_final   = float(df["final_score"].median())
print(f"  기본값 - safety: {default_safety:.3f}, tourism: {default_tourism:.3f}, final: {default_final:.3f}")

# KDTree 구성: road_scored 세그먼트의 시작점 좌표
score_coords = df[["start_lat", "start_lon"]].values
score_tree   = KDTree(score_coords)
print(f"  KDTree 구성 완료 ({len(score_coords):,}개 포인트)\n")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: osmnx로 서울 자전거 도로 네트워크 다운로드
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 65)
print("STEP 2: osmnx 서울 자전거 네트워크 다운로드")
print("=" * 65)
print("  첫 실행 시 수 분 소요됩니다. 이후 실행은 캐시를 사용합니다.\n")

ox.settings.use_cache = False
ox.settings.log_console = True
ox.settings.max_query_area_size = 5000000000  # 5000 sq km (prevent 168 requests)
ox.settings.overpass_url = "https://overpass-api.de/api/interpreter"

os.makedirs(MODELS_DIR, exist_ok=True)

if os.path.exists(OSM_CACHE):
    print(f"  캐시 로드: {OSM_CACHE}")
    G_osm = ox.load_graphml(OSM_CACHE)
    print("  캐시에서 로드 완료.")
else:
    # 서울 행정구역 바운딩박스 (하드코딩 — road_scored 이상치 좌표 방지)
    north, south, east, west = 37.715, 37.413, 127.185, 126.764
    print(f"  바운딩박스: N={north} S={south} E={east} W={west} (서울 고정)")
    print("  OSM 다운로드 중 (1~3분 소요)...")
    G_osm = ox.graph_from_bbox(
        bbox=(west, south, east, north),
        network_type="bike",
        simplify=True,    # STEP 3에서 nx.Graph() 재구성하므로 True가 더 빠름
    )
    ox.save_graphml(G_osm, OSM_CACHE)
    print(f"  캐시 저장 완료: {OSM_CACHE}")

print(f"  OSM 노드 수: {G_osm.number_of_nodes():,}")
print(f"  OSM 엣지 수: {G_osm.number_of_edges():,}\n")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: OSM 엣지에 safety/tourism 점수 매핑
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 65)
print("STEP 3: OSM 엣지 ↔ road_scored 점수 매핑 (최근접 세그먼트)")
print("=" * 65)
print(f"  매핑 허용 거리: {MAX_MATCH_KM}km 이내\n")

nodes_data = dict(G_osm.nodes(data=True))

G = nx.Graph()
mapped   = 0
fallback = 0

for u, v, data in G_osm.edges(data=True):
    u_data = nodes_data[u]
    v_data = nodes_data[v]

    # 엣지 중점 계산 (osmnx: x=경도, y=위도)
    mid_lat = (u_data["y"] + v_data["y"]) / 2
    mid_lon = (u_data["x"] + v_data["x"]) / 2

    # KDTree로 최근접 road_scored 세그먼트 탐색
    # KDTree는 유클리드 거리를 사용하므로, 위도 1도 ≈ 111km로 간이 변환
    dist_deg, idx = score_tree.query([mid_lat, mid_lon])
    dist_km = dist_deg * 111.0

    if dist_km <= MAX_MATCH_KM:
        row     = df.iloc[idx]
        safety  = float(row["safety_score"])
        tourism = float(row["tourism_score"])
        final   = float(row["final_score"])
        mapped += 1
    else:
        safety  = default_safety
        tourism = default_tourism
        final   = default_final
        fallback += 1

    length_m  = data.get("length", 0)
    length_km = length_m / 1000 if length_m > 0 else 0.05

    # 노드 키: (위도, 경도) 소수점 5자리 (약 1.1m 정밀도)
    node_u = (round(u_data["y"], 5), round(u_data["x"], 5))
    node_v = (round(v_data["y"], 5), round(v_data["x"], 5))

    if node_u == node_v:
        continue

    edge_attrs = dict(
        weight        = 1.0 - final,   # Dijkstra: 낮을수록 선호
        safety_score  = safety,
        tourism_score = tourism,
        final_score   = final,
        length_km     = length_km,
        osm_u         = u,
        osm_v         = v,
    )
    if "name" in data:
        edge_attrs["road_name"] = data["name"]

    # 중복 엣지는 점수가 더 높은 쪽으로 업데이트
    if G.has_edge(node_u, node_v):
        if final > G[node_u][node_v]["final_score"]:
            G[node_u][node_v].update(edge_attrs)
    else:
        G.add_edge(node_u, node_v, **edge_attrs)

print(f"  점수 매핑 성공: {mapped:,}개 엣지 ({mapped/(mapped+fallback)*100:.1f}%)")
print(f"  기본값 사용:    {fallback:,}개 엣지 ({fallback/(mapped+fallback)*100:.1f}%, {MAX_MATCH_KM}km 초과)")
print(f"  최종 노드 수:   {G.number_of_nodes():,}")
print(f"  최종 엣지 수:   {G.number_of_edges():,}\n")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: 연결성 분석
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 65)
print("STEP 4: 연결성 분석")
print("=" * 65)

components = list(nx.connected_components(G))
print(f"  연결 컴포넌트 수: {len(components):,}")
largest = max(components, key=len)
print(f"  최대 컴포넌트 노드 수: {len(largest):,} "
      f"({len(largest)/G.number_of_nodes()*100:.1f}%)")
print(f"  최대 컴포넌트 엣지 수: {G.subgraph(largest).number_of_edges():,}\n")

G_main = G.subgraph(largest).copy()
print(f"  G_main: {G_main.number_of_nodes():,} 노드 / {G_main.number_of_edges():,} 엣지\n")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: 저장
# ══════════════════════════════════════════════════════════════════════════════
print("=" * 65)
print("STEP 5: route_graph.pkl 저장")
print("=" * 65)

os.makedirs(MODELS_DIR, exist_ok=True)

graph_data = {
    "G":      G,
    "G_main": G_main,
    "meta": {
        "source":       "osmnx Seoul bike network",
        "nodes":        G.number_of_nodes(),
        "edges":        G.number_of_edges(),
        "components":   len(components),
        "main_nodes":   G_main.number_of_nodes(),
        "main_edges":   G_main.number_of_edges(),
        "mapped":       mapped,
        "fallback":     fallback,
        "max_match_km": MAX_MATCH_KM,
    }
}

with open(GRAPH_PATH, "wb") as f:
    pickle.dump(graph_data, f)

print(f"  ✅ route_graph.pkl → {GRAPH_PATH}")
print(f"     전체 그래프: {G.number_of_nodes():,} 노드 / {G.number_of_edges():,} 엣지")
print(f"     최대 연결:   {G_main.number_of_nodes():,} 노드 / {G_main.number_of_edges():,} 엣지")

print("\n" + "=" * 65)
print("✅ build_route_graph.py 완료")
print("=" * 65)
