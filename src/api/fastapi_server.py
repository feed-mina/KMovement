"""
fastapi_server.py
=================
K-Ride FastAPI 백엔드 서버

[ 실행 ]
  uvicorn kride-project.fastapi_server:app --reload --port 8000
  또는
  cd kride-project && uvicorn fastapi_server:app --reload --port 8000

[ 엔드포인트 ]
  POST /api/recommend       ← 반경 내 상위 세그먼트
  POST /api/route           ← A→B 최적 경로 (Dijkstra)
  POST /api/course          ← 시작점 기반 순환 코스
  GET  /api/facilities      ← 반경 내 편의시설
  GET  /api/pois            ← 반경 내 관광 POI
  GET  /api/health          ← 서버 상태 확인
"""

from __future__ import annotations

import math
import os
import pickle
from typing import Optional
import httpx

import networkx as nx
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
load_dotenv()

try:
    from src.api.neo4j_client import get_artist_pois, get_region_pois, get_regions
    from src.api.rag_client import (
        generate_chat_answer,
        generate_chat_answer_stream,
        generate_itinerary,
        generate_recommendation_text,
        search_pois_by_purpose,
    )
    from src.api.supabase_client import get_all_artists, get_poi_details
    HAS_AI = True
except ImportError as _e:
    print(f"[K-Ride] AI 모듈 로드 실패 (pip install neo4j chromadb groq supabase): {_e}")
    HAS_AI = False
    get_all_artists = lambda: []
    get_artist_pois = lambda artist_id: []
    get_region_pois = lambda region: []
    get_regions = lambda: []
    search_pois_by_purpose = lambda purpose, lat, lon, radius: []
    generate_recommendation_text = lambda purpose, pois: ""
    generate_itinerary = lambda pois, duration, theme: ""
    generate_chat_answer = lambda message: f"AI 서비스가 현재 준비 중입니다. 잠시 후 다시 시도해주세요.\n\n회원님의 질문: {message}"
    def generate_chat_answer_stream(message): yield f"AI 서비스가 현재 준비 중입니다. 잠시 후 다시 시도해주세요.\n\n회원님의 질문: {message}"
    get_poi_details = lambda poi_id: None

# POI 클러스터링 (math만 의존, 외부 모듈 불필요)
try:
    from src.api.rag_client import _cluster_pois_by_proximity
except ImportError:
    def _cluster_pois_by_proximity(pois: list) -> list:
        return pois

# 앙상블 랭커 (모델 파일 없어도 서버 기동 가능)
try:
    from src.api.ensemble_client import rank_pois as ensemble_rank_pois
    HAS_ENSEMBLE = True
except ImportError:
    HAS_ENSEMBLE = False
    ensemble_rank_pois = None
# GraphRAG 모듈 (graph.json 없어도 서버 기동 가능)
try:
    from src.api.graphrag_client import get_graphrag_pois
    HAS_GRAPHRAG = True
except ImportError:
    HAS_GRAPHRAG = False
    get_graphrag_pois = None
# 날씨 모듈 (KMA API 키 없어도 서버 기동 가능)
try:
    from weather_kma import get_weather_weight, weather_to_safety_penalty
    HAS_WEATHER = True
except ImportError:
    HAS_WEATHER = False

# 이벤트 분류 — TorchServe 경유
from src.api.torchserve_client import classify_event_sync as _ts_classify_event
from src.api.torchserve_client import predict_weather_sync as _ts_predict_weather

# geocode_venue / EVENT_IMPACT 는 데이터 유틸이므로 인라인 유지
try:
    from build_event_ner import geocode_venue, EVENT_IMPACT
    HAS_EVENT = True
except ImportError:
    HAS_EVENT = False
    EVENT_IMPACT = {}
    def geocode_venue(venue: str):
        return None

# WeatherLSTM — TorchServe 경유 (HAS_LSTM_WEATHER는 항상 True, TorchServe 장애 시 fallback)
HAS_LSTM_WEATHER = True

# ── 경로 설정 ──────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
MODELS_DIR = os.environ.get("KRIDE_MODELS_DIR", os.path.join(PROJECT_ROOT, "dataset", "models"))
RAW_DIR = os.environ.get("KRIDE_RAW_DATA_DIR", os.path.join(PROJECT_ROOT, "dataset", "data", "raw_ml"))

GRAPH_PATH    = os.path.join(MODELS_DIR, "route_graph.pkl")
SCORED_PATH   = os.path.join(RAW_DIR,    "road_scored.csv")
FACILITY_PATH = os.path.join(RAW_DIR,    "facility_clean.csv")
POI_PATH      = os.path.join(RAW_DIR,    "tour_poi.csv")


# ══════════════════════════════════════════════════════════════════════════════
# 앱 초기화
# ══════════════════════════════════════════════════════════════════════════════
app = FastAPI(
    title="K-Ride API",
    description="K팝 MZ를 위한 새로운 여행 활성 경로 추천 백엔드",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 배포 시 Vercel URL로 교체
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# 리소스 로드 (서버 시작 시 1회)
# ══════════════════════════════════════════════════════════════════════════════
def _load_graph():
    if not os.path.exists(GRAPH_PATH):
        return None, None, {}
    try:
        with open(GRAPH_PATH, "rb") as f:
            data = pickle.load(f)
        return data["G"], data["G_main"], data.get("meta", {})
    except Exception as exc:
        print(f"[K-Ride] route graph load failed: {exc}")
        return None, None, {}

### [메모] 여기서 data["G"]와 data["G_main"]은 어떤 차이가 있나요? 두개는 어떤 의미인가요
### [답변]
# G     : osmnx로 수집한 서울 자전거 도로 네트워크 전체 그래프.
#          여러 개의 연결 컴포넌트(disconnected subgraph)를 포함할 수 있음.
#          고립된 노드나 단절된 구간도 모두 포함된 '원본' 그래프.
#
# G_main: G에서 가장 큰 연결 컴포넌트(Largest Connected Component)만 추출한 서브그래프.
#          build_route_graph.py에서 G.subgraph(largest).copy()로 생성.
#          Dijkstra(find_route) · DFS 코스 생성(generate_course) 등
#          경로 탐색 알고리즘은 모든 노드 간 경로가 보장되어야 하므로
#          G_main만 사용. G는 pkl에 보존되지만 이 서버에서는 직접 쓰지 않음.

def _load_df(path: str) -> Optional[pd.DataFrame]:
    if not os.path.exists(path):
        return None
    try:
        try:
            return pd.read_csv(path, encoding="utf-8-sig")
        except Exception:
            return pd.read_csv(path, encoding="cp949")
    except Exception as exc:
        print(f"[K-Ride] csv load failed ({path}): {exc}")
        return None


G, G_main, graph_meta = _load_graph()
df_scored   = _load_df(SCORED_PATH)
df_facility = _load_df(FACILITY_PATH)
df_poi      = _load_df(POI_PATH)

print(f"[K-Ride] 그래프 로드: {graph_meta}")
print(f"[K-Ride] road_scored: {df_scored.shape if df_scored is not None else 'None'}")
print(f"[K-Ride] facility:    {df_facility.shape if df_facility is not None else 'None'}")
print(f"[K-Ride] poi:         {df_poi.shape if df_poi is not None else 'None'}")


# ══════════════════════════════════════════════════════════════════════════════
# 유틸리티
# ══════════════════════════════════════════════════════════════════════════════
def haversine(c1: tuple, c2: tuple) -> float:
    """두 (lat, lon) 좌표 사이 거리 (km)"""
    R = 6371.0
    lat1, lon1 = math.radians(c1[0]), math.radians(c1[1])
    lat2, lon2 = math.radians(c2[0]), math.radians(c2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def nearest_node(graph: nx.Graph, lat: float, lon: float) -> tuple:
    """그래프에서 입력 좌표에 가장 가까운 노드 반환"""
    target = (lat, lon)
    return min(graph.nodes, key=lambda n: haversine(n, target))


async def geocode_address(address: str) -> dict | None:
    """Nominatim으로 한국 주소 → lat/lon 변환 (무료, rate limit 1req/s)"""
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": address, "format": "json", "limit": 1, "countrycodes": "kr"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params, headers={"User-Agent": "KRide/1.0"})
            data = resp.json()
            if data:
                return {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"])}
    except Exception:
        pass
    return None


async def geocode_itinerary_places(itinerary: list) -> list[dict]:
    """일정에서 장소 주소를 추출하여 좌표 변환 → 마커 리스트 반환"""
    import asyncio
    places = []
    for day in itinerary:
        for slot in ["morning", "afternoon"]:
            for place in day.get(slot, {}).get("places", []):
                if place.get("name") and place.get("address"):
                    places.append(place)

    markers = []
    for place in places:
        coord = await geocode_address(place["address"])
        if coord:
            markers.append({"name": place["name"], "lat": coord["lat"], "lon": coord["lon"]})
        else:
            print(f"[K-Ride] 지오코딩 실패 주소: '{place['address']}' (장소: {place['name']})")
        await asyncio.sleep(1.1)  # Nominatim rate limit: 1 req/s
    return markers


def get_nearby_facilities(path_coords: list, radius_m: float = 500) -> list:
    """경로 좌표 목록 기준 반경 내 편의시설 반환"""
    if df_facility is None or len(path_coords) == 0:
        return []

    lat_col = next((c for c in ["lat", "latitude", "위도", "y"] if c in df_facility.columns), None)
    lon_col = next((c for c in ["lon", "longitude", "경도", "x"] if c in df_facility.columns), None)
    if lat_col is None or lon_col is None:
        return []

    results = set()
    radius_km = radius_m / 1000.0
    for coord in path_coords[::5]:   # 5칸 간격으로 샘플링 (성능)
        for _, row in df_facility.iterrows():
            try:
                fac_coord = (float(row[lat_col]), float(row[lon_col]))
                if haversine(coord, fac_coord) <= radius_km:
                    name_col = next((c for c in ["name", "시설명", "명칭"] if c in df_facility.columns), None)
                    type_col = next((c for c in ["type", "시설유형", "분류"] if c in df_facility.columns), None)
                    results.add((
                        row.get(name_col, "") if name_col else "",
                        row.get(type_col, "") if type_col else "",
                        fac_coord[0],
                        fac_coord[1],
                    ))
            except (ValueError, TypeError):
                continue
    return [{"name": r[0], "type": r[1], "lat": r[2], "lon": r[3]} for r in results]


def get_nearby_pois(path_coords: list, radius_m: float = 1000) -> list:
    """경로 좌표 목록 기준 반경 내 관광 POI 반환"""
    if df_poi is None or len(path_coords) == 0:
        return []

    lat_col = next((c for c in ["mapy", "lat", "latitude", "위도"] if c in df_poi.columns), None)
    lon_col = next((c for c in ["mapx", "lon", "longitude", "경도"] if c in df_poi.columns), None)
    title_col = next((c for c in ["title", "관광지명", "poi_name"] if c in df_poi.columns), None)
    if lat_col is None or lon_col is None:
        return []

    results = set()
    radius_km = radius_m / 1000.0
    for coord in path_coords[::5]:
        for _, row in df_poi.iterrows():
            try:
                poi_lat = float(row[lat_col])
                poi_lon = float(row[lon_col])
                if haversine(coord, (poi_lat, poi_lon)) <= radius_km:
                    results.add((
                        row.get(title_col, "") if title_col else "",
                        poi_lat,
                        poi_lon,
                    ))
            except (ValueError, TypeError):
                continue
    return [{"title": r[0], "lat": r[1], "lon": r[2]} for r in results]


def reweight_graph(graph: nx.Graph, w_safety: float, w_tourism: float) -> None:
    """엣지 가중치를 사용자 가중치로 재계산 (in-place)"""
    for u, v, data in graph.edges(data=True):
        score = w_safety * data.get("safety_score", 0.5) + w_tourism * data.get("tourism_score", 0.5)
        data["weight"] = max(1.0 - score, 1e-6)


# ══════════════════════════════════════════════════════════════════════════════
# 요청/응답 스키마
# ══════════════════════════════════════════════════════════════════════════════
class RecommendRequest(BaseModel):
    lat: float
    lon: float
    radius_km: float = 5.0
    w_safety: float = 0.6
    w_tourism: float = 0.4
    top_n: int = 10

# # [메모] radius_km 이라는건 구역은 radius_km을 사용해서 원구로 인식하나요 ? 혹시 나중에 이 범위를 3,5,10으로 바꿀 수 있나요 

class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    w_safety: float = 0.6
    w_tourism: float = 0.4
    travel_date: Optional[str] = None   # Phase 3-8에서 활용


class CourseRequest(BaseModel):
    start_lat: float
    start_lon: float
    distance_km: float = 20.0
    w_safety: float = 0.6
    w_tourism: float = 0.4


# ══════════════════════════════════════════════════════════════════════════════
# 엔드포인트
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "graph_nodes": graph_meta.get("nodes", 0),
        "graph_edges": graph_meta.get("edges", 0),
        "road_scored_rows": len(df_scored) if df_scored is not None else 0,
    }


# ─────────────────────────────────────────────
# POST /api/recommend
# ─────────────────────────────────────────────
@app.post("/api/recommend")
def recommend(req: RecommendRequest):
    """반경 내 상위 N개 세그먼트 반환"""
    if df_scored is None:
        raise HTTPException(status_code=503, detail="road_scored.csv 로드 실패")

    center = (req.lat, req.lon)
    mask = df_scored.apply(
        lambda row: haversine(center, (row["start_lat"], row["start_lon"])) <= req.radius_km,
        axis=1,
    )
    nearby = df_scored[mask].copy()
    if nearby.empty:
        return {"segments": []}

    w = req.w_safety + req.w_tourism
    w_s = req.w_safety / w
    w_t = req.w_tourism / w
    nearby["_score"] = nearby["safety_score"] * w_s + nearby["tourism_score"] * w_t

    top = nearby.nlargest(req.top_n, "_score")
    return {
        "segments": top[["start_lat", "start_lon", "end_lat", "end_lon",
                          "safety_score", "tourism_score", "_score", "length_km"]
                        ].rename(columns={"_score": "final_score"}).to_dict(orient="records")
    }


# ─────────────────────────────────────────────
# POST /api/route
# ─────────────────────────────────────────────
@app.post("/api/route")
def find_route(req: RouteRequest):
    """출발지 → 도착지 최적 경로 (Dijkstra)"""
    if G_main is None:
        raise HTTPException(status_code=503, detail="route_graph.pkl 로드 실패")

    # 가중치 재계산 (사용자 입력 반영)
    G_copy = G_main.copy()
    reweight_graph(G_copy, req.w_safety, req.w_tourism)

    start_node = nearest_node(G_copy, req.start_lat, req.start_lon)
    end_node   = nearest_node(G_copy, req.end_lat,   req.end_lon)

    try:
        path_nodes = nx.shortest_path(G_copy, source=start_node, target=end_node, weight="weight")
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=404, detail="경로를 찾을 수 없습니다.")
    except nx.NodeNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))

    # 경로 통계 계산
    path_coords = [{"lat": n[0], "lon": n[1]} for n in path_nodes]
    total_dist = 0.0
    safety_sum = 0.0
    tourism_sum = 0.0
    edge_count = 0

    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i + 1]
        if G_copy.has_edge(u, v):
            data = G_copy[u][v]
            total_dist  += data.get("length_km", haversine(u, v))
            safety_sum  += data.get("safety_score", 0.5)
            tourism_sum += data.get("tourism_score", 0.5)
            edge_count  += 1

    avg_safety  = safety_sum  / edge_count if edge_count else 0.0
    avg_tourism = tourism_sum / edge_count if edge_count else 0.0

    facilities = get_nearby_facilities([(c["lat"], c["lon"]) for c in path_coords])
    pois       = get_nearby_pois([(c["lat"], c["lon"]) for c in path_coords])

    result = {
        "path": path_coords,
        "total_distance_km": round(total_dist, 3),
        "avg_safety_score":  round(avg_safety, 4),
        "avg_tourism_score": round(avg_tourism, 4),
        "facilities_on_route": facilities,
        "pois_on_route": pois,
    }

    # Phase 3-8: travel_date가 있으면 날씨 예측 placeholder
    if req.travel_date:
        result["travel_date"] = req.travel_date
        result["predicted_weather"] = "예측 모델 준비 중 (Phase 3-8)"

    return result


# ─────────────────────────────────────────────
# POST /api/course
# ─────────────────────────────────────────────
@app.post("/api/course")
def generate_course(req: CourseRequest):
    """시작점 기반 거리 조건 순환 코스 생성 (DFS)"""
    if G_main is None:
        raise HTTPException(status_code=503, detail="route_graph.pkl 로드 실패")

    G_copy = G_main.copy()
    reweight_graph(G_copy, req.w_safety, req.w_tourism)

    start_node = nearest_node(G_copy, req.start_lat, req.start_lon)
    target_km  = req.distance_km

    # DFS 기반 코스 탐색 (best-first: final_score 내림차순)
    best_course: list = []
    best_dist: float  = 0.0

    stack = [(start_node, [start_node], 0.0)]
    visited_global: set = set()
    MAX_ITER = 50_000

    iters = 0
    while stack and iters < MAX_ITER:
        iters += 1
        node, path, dist = stack.pop()

        if dist >= target_km * 0.9:
            if dist > best_dist:
                best_dist   = dist
                best_course = path
            if dist >= target_km:
                break
            continue

        neighbors = sorted(
            [n for n in G_copy.neighbors(node) if n not in visited_global],
            key=lambda n: -G_copy[node][n].get("final_score", 0),
        )
        for neighbor in neighbors[:6]:   # 분기 제한 (성능)
            edge = G_copy[node][neighbor]
            new_dist = dist + edge.get("length_km", haversine(node, neighbor))
            if new_dist <= target_km * 1.2:   # 목표 거리의 120%까지 허용
                visited_global.add(neighbor)
                stack.append((neighbor, path + [neighbor], new_dist))

    if not best_course:
        # fallback: 가장 긴 탐색 결과 반환
        best_course = [start_node]
        best_dist   = 0.0

    course_coords = [{"lat": n[0], "lon": n[1]} for n in best_course]
    facilities    = get_nearby_facilities([(c["lat"], c["lon"]) for c in course_coords])
    pois          = get_nearby_pois([(c["lat"], c["lon"]) for c in course_coords])

    return {
        "course": course_coords,
        "total_distance_km": round(best_dist, 3),
        "facilities_on_course": facilities,
        "pois_on_course": pois,
    }


# ─────────────────────────────────────────────
# GET /api/facilities
# ─────────────────────────────────────────────
@app.get("/api/facilities")
def get_facilities(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(2.0),
):
    """반경 내 편의시설 반환"""
    if df_facility is None:
        raise HTTPException(status_code=503, detail="facility_clean.csv 로드 실패")

    lat_col = next((c for c in ["lat", "latitude", "위도", "y"] if c in df_facility.columns), None)
    lon_col = next((c for c in ["lon", "longitude", "경도", "x"] if c in df_facility.columns), None)
    if lat_col is None or lon_col is None:
        raise HTTPException(status_code=500, detail="좌표 컬럼 없음")

    center = (lat, lon)
    results = []
    for _, row in df_facility.iterrows():
        try:
            fac = (float(row[lat_col]), float(row[lon_col]))
            if haversine(center, fac) <= radius_km:
                name_col = next((c for c in ["name", "시설명", "명칭"] if c in df_facility.columns), None)
                type_col = next((c for c in ["type", "시설유형", "분류"] if c in df_facility.columns), None)
                results.append({
                    "name": row.get(name_col, "") if name_col else "",
                    "type": row.get(type_col, "") if type_col else "",
                    "lat": fac[0],
                    "lon": fac[1],
                })
        except (ValueError, TypeError):
            continue

    return {"facilities": results}


# ─────────────────────────────────────────────
# GET /api/pois
# ─────────────────────────────────────────────
@app.get("/api/pois")
def get_pois(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(3.0),
):
    """반경 내 관광 POI 반환"""
    if df_poi is None:
        raise HTTPException(status_code=503, detail="tour_poi.csv 로드 실패")

    lat_col   = next((c for c in ["mapy", "lat", "latitude", "위도"] if c in df_poi.columns), None)
    lon_col   = next((c for c in ["mapx", "lon", "longitude", "경도"] if c in df_poi.columns), None)
    title_col = next((c for c in ["title", "관광지명", "poi_name"] if c in df_poi.columns), None)
    if lat_col is None or lon_col is None:
        raise HTTPException(status_code=500, detail="좌표 컬럼 없음")

    center = (lat, lon)
    results = []
    for _, row in df_poi.iterrows():
        try:
            p_lat = float(row[lat_col])
            p_lon = float(row[lon_col])
            if haversine(center, (p_lat, p_lon)) <= radius_km:
                results.append({
                    "title": row.get(title_col, "") if title_col else "",
                    "lat":   p_lat,
                    "lon":   p_lon,
                })
        except (ValueError, TypeError):
            continue

    return {"pois": results}


# ─────────────────────────────────────────────
# GET /api/weather
# ─────────────────────────────────────────────
@app.get("/api/weather")
def get_weather(
    lat: float = Query(...),
    lon: float = Query(...),
    base_w_safety: float = Query(0.6),
):
    """
    기상청 단기예보 → 현재 날씨 + 안전 가중치 자동 보정값 반환

    환경변수 KMA_API_KEY 필요.
    키 없이 호출하면 fallback(맑음/기본가중치)을 반환한다.
    """
    if not HAS_WEATHER:
        return {
            "weather_label": "모듈 없음",
            "pop": 0,
            "pty": "없음",
            "sky": "맑음",
            "tmp": 0.0,
            "wsd": 0.0,
            "w_safety_adj": base_w_safety,
            "w_tourism_adj": round(1.0 - base_w_safety, 2),
            "note": "weather_kma.py 또는 requests 패키지 없음",
        }

    api_key = os.environ.get("KMA_API_KEY", "")
    if not api_key:
        return {
            "weather_label": "API 키 없음",
            "pop": 0,
            "pty": "없음",
            "sky": "맑음",
            "tmp": 0.0,
            "wsd": 0.0,
            "w_safety_adj": base_w_safety,
            "w_tourism_adj": round(1.0 - base_w_safety, 2),
            "note": "KMA_API_KEY 환경변수를 설정하세요 (data.go.kr에서 발급)",
        }

    try:
        w_safety, w_tourism, weather = get_weather_weight(
            lat, lon, api_key=api_key, base_w_safety=base_w_safety
        )
        return {
            "weather_label":  weather.get("weather_label", ""),
            "pop":            weather.get("pop", 0),
            "pty":            weather.get("pty", "없음"),
            "sky":            weather.get("sky", "맑음"),
            "tmp":            weather.get("tmp", 0.0),
            "wsd":            weather.get("wsd", 0.0),
            "w_safety_adj":   w_safety,
            "w_tourism_adj":  w_tourism,
            "safety_penalty": weather_to_safety_penalty(weather.get("weather_label", "맑음")),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"KMA API 호출 실패: {e}")


# ─────────────────────────────────────────────
# GET /api/events
# ─────────────────────────────────────────────
class EventItem(BaseModel):
    text: str
    venue: Optional[str] = None   # 장소명 (geocoding 용)


@app.post("/api/events")
def detect_events(items: list[EventItem]):
    """
    뉴스/이벤트 텍스트 목록 → 이벤트 유형 분류 + 위치 변환 + 경로 영향도 반환

    입력: [ { "text": "...", "venue": "잠실종합운동장" }, ... ]
    출력: { "events": [ { "type", "score", "venue", "lat", "lon", "impact" } ] }

    이벤트 분류 모듈(build_event_ner.py)이 없으면 503 반환.
    """
    results = []
    for item in items:
        try:
            classified = _ts_classify_event(item.text)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"TorchServe event_ner 호출 실패: {e}")
        lat, lon = None, None
        if item.venue:
            coord = geocode_venue(item.venue)
            if coord:
                lat, lon = coord

        results.append({
            "type":    classified["event_type"],
            "score":   classified["score"],
            "text":    item.text[:80],
            "venue":   item.venue or "",
            "lat":     lat,
            "lon":     lon,
            "impact":  EVENT_IMPACT.get(classified["event_type"], {}),
        })

    return {"events": results}


@app.get("/api/events")
def get_events_near(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(3.0),
):
    """
    특정 좌표 반경 내 이미 geocoding된 이벤트 목록 반환
    (POST /api/events로 등록된 결과를 in-memory에서 조회 — MVP 수준)

    실제 서비스에서는 DB 또는 캐시로 교체.
    """
    # MVP: 빈 목록 반환 (POST /api/events로 이벤트 등록 후 DB 조회로 확장 예정)
    return {
        "events": [],
        "note": f"({lat:.4f}, {lon:.4f}) 반경 {radius_km}km — DB 연동 전 빈 목록",
    }


# ─────────────────────────────────────────────
# GET /api/weather_forecast  (Phase 3-8: WeatherLSTM)
# ─────────────────────────────────────────────
@app.get("/api/weather_forecast")
def weather_forecast(
    sgg_idx: int = Query(0, description="시군구 인덱스 (weather_scaler 학습 시 인코딩 값)"),
    travel_date: str = Query(..., description="여행 날짜 YYYY-MM-DD"),
):
    """
    WeatherLSTM → 여행 날짜 예상 날씨 + safety_score 페널티 반환

    모델이 없으면 더미 응답(맑음) 반환.
    travel_date 기준 과거 14일치 더미 시퀀스를 입력으로 사용.
    (실제 서비스에서는 DB에서 과거 관측값을 조회해서 시퀀스 구성)
    """
    import datetime

    try:
        dt = datetime.date.fromisoformat(travel_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="travel_date 형식 오류 (YYYY-MM-DD)")

    if not HAS_LSTM_WEATHER:
        return {
            "travel_date":    travel_date,
            "weather_label":  "맑음",
            "weather_class":  0,
            "safety_penalty": 0.0,
            "note": "WeatherLSTM 모델 없음 — build_weather_lstm.py 실행 후 사용 가능",
        }

    # 과거 14일 더미 시퀀스 생성 (실제 서비스: DB 조회로 교체)
    SEQ_LEN  = 14
    seq_rows = []
    for i in range(SEQ_LEN, 0, -1):
        past = dt - datetime.timedelta(days=i)
        seq_rows.append([
            past.month, past.day, past.weekday(),
            15.0,  # 기온 평균 (더미)
            0.0,   # 강수량
            2.0,   # 풍속
            60.0,  # 습도
            float(sgg_idx),
        ])
    seq = [[float(v) for v in row] for row in seq_rows]

    try:
        result = _ts_predict_weather(seq)
    except Exception as e:
        return {
            "travel_date":    travel_date,
            "weather_label":  "맑음",
            "weather_class":  0,
            "safety_penalty": 0.0,
            "note": f"TorchServe weather_lstm 호출 실패: {e}",
        }
    return {
        "travel_date":    travel_date,
        "weather_label":  result["label"],
        "weather_class":  result["class"],
        "proba":          result["proba"],
        "safety_penalty": result["safety_penalty"],
    }

class BudgetSchema(BaseModel):
    min: int = 30000
    max: int = 2000000

class RecommendAIRequest(BaseModel):
    artists:  list[str] = Field(default_factory=list)
    regions:  list[str] = Field(default_factory=list)
    purposes: list[str] = Field(default_factory=list)
    budget:   BudgetSchema = Field(default_factory=BudgetSchema)

class ItineraryRequest(BaseModel):
    duration: str | int = "당일치기"   # 당일치기 | 1박2일 | 2박3일
    artists:  list[str] = Field(default_factory=list)
    regions:  list[str] = Field(default_factory=list)
    purposes: list[str] = Field(default_factory=list)
    budget:   BudgetSchema = Field(default_factory=BudgetSchema)

class ChatStreamRequest(BaseModel):
    message: str = ""


_REQUEST_MODEL_TYPES = {"BudgetSchema": BudgetSchema}
RecommendAIRequest.model_rebuild(_types_namespace=_REQUEST_MODEL_TYPES)
ItineraryRequest.model_rebuild(_types_namespace=_REQUEST_MODEL_TYPES)


FALLBACK_ARTISTS = [
    {"id": "bts",              "name": "BTS",              "name_ko": "방탄소년단",  "imageUrl": "/artists/BTS.png"},
    {"id": "blackpink",        "name": "BLACKPINK",        "name_ko": "블랙핑크",    "imageUrl": "/artists/BLACKPINK.jpg"},
    {"id": "superjunior",      "name": "SUPER JUNIOR",     "name_ko": "슈퍼주니어",  "imageUrl": "/artists/SUPER JUNIOR.jpg"},
    {"id": "seventeen",        "name": "SEVENTEEN",        "name_ko": "세븐틴",      "imageUrl": "/artists/SEVENTEEN.jpg"},
    {"id": "twice",            "name": "TWICE",            "name_ko": "트와이스",    "imageUrl": "/artists/TWICE.jpg"},
    {"id": "tvxq",             "name": "TVXQ",             "name_ko": "동방신기",    "imageUrl": "/artists/TVXQ.jpg"},
    {"id": "btob",             "name": "BTOB",             "name_ko": "BTOB",        "imageUrl": "/artists/BTOB.jpg"},
    {"id": "girlsgeneration",  "name": "Girls' Generation","name_ko": "소녀시대",    "imageUrl": "/artists/Girls' Generation.jpg"},
    {"id": "exo",              "name": "EXO",              "name_ko": "엑소",        "imageUrl": "/artists/EXO.jpg"},
    {"id": "redvelvet",        "name": "Red Velvet",       "name_ko": "레드벨벳",    "imageUrl": "/artists/Red Velvet.jpg"},
    {"id": "nct",              "name": "NCT",              "name_ko": "NCT",          "imageUrl": "/artists/NCT.jpg"},
    {"id": "infinite",         "name": "INFINITE",         "name_ko": "인피니트",    "imageUrl": "/artists/INFINITE.jpg"},
    {"id": "ohmygirl",         "name": "OH MY GIRL",       "name_ko": "오마이걸",    "imageUrl": "/artists/OH MY GIRL.jpg"},
    {"id": "apink",            "name": "Apink",            "name_ko": "에이핑크",    "imageUrl": "/artists/Apink.jpg"},
    {"id": "shinee",           "name": "SHINee",           "name_ko": "샤이니",      "imageUrl": "/artists/SHINee.jpg"},
    {"id": "mamamoo",          "name": "MAMAMOO",          "name_ko": "마마무",      "imageUrl": "/artists/MAMAMOO.jpg"},
    {"id": "iu",               "name": "IU",               "name_ko": "아이유",      "imageUrl": "/artists/IU.jpg"},
    {"id": "txt",              "name": "TXT",              "name_ko": "TXT",          "imageUrl": "/artists/TXT.png"},
    {"id": "victon",           "name": "VICTON",           "name_ko": "빅톤",        "imageUrl": "/artists/VICTON.jpg"},
    {"id": "gdragon",          "name": "G-Dragon",         "name_ko": "지드래곤",    "imageUrl": "/artists/GDragon.jpg"},
    {"id": "fromis9",          "name": "fromis_9",         "name_ko": "프로미스나인", "imageUrl": "/artists/fromis_9.jpg"},
    {"id": "chungha",          "name": "CHUNGHA",          "name_ko": "청하",        "imageUrl": "/artists/CHUNGHA.jpg"},
    {"id": "blockb",           "name": "Block B",          "name_ko": "블락비",      "imageUrl": "/artists/Block B.jpg"},
    {"id": "girlsday",         "name": "Girl's Day",       "name_ko": "걸스데이",    "imageUrl": "/artists/Girl's Day.jpg"},
    {"id": "got7",             "name": "GOT7",             "name_ko": "GOT7",         "imageUrl": "/artists/GOT7.jpg"},
    {"id": "highlight",        "name": "Highlight",        "name_ko": "하이라이트",  "imageUrl": "/artists/Highlight.jpg"},
    {"id": "rain",             "name": "Rain",             "name_ko": "비",          "imageUrl": "/artists/Rain.jpg"},
    {"id": "nuest",            "name": "NU'EST",           "name_ko": "뉴이스트",    "imageUrl": "/artists/NU'EST.jpg"},
    {"id": "kangdaniel",       "name": "Kang Daniel",      "name_ko": "강다니엘",    "imageUrl": "/artists/Kang Daniel.jpg"},
    {"id": "straykids",        "name": "Stray Kids",       "name_ko": "스트레이키즈", "imageUrl": "/artists/Stray Kids.jpg"},
]

# 영문 → 한글 아티스트 이름 매핑 (Neo4j에 한글명으로 저장됨)
ARTIST_NAME_MAP = {}
for _a in FALLBACK_ARTISTS:
    ARTIST_NAME_MAP[_a["name"]] = _a.get("name_ko") or _a["name"]
    ARTIST_NAME_MAP[_a["name"].upper()] = _a.get("name_ko") or _a["name"]
    ARTIST_NAME_MAP[_a["name"].lower()] = _a.get("name_ko") or _a["name"]

FALLBACK_REGIONS = [
    {"id": str(i), "name": name, "imageUrl": None, "safety_score": None}
    for i, name in enumerate(
        [
            "서울", "경기", "인천", "강원", "충북", "충남",
            "전북", "전남", "경북", "경남", "부산", "대구",
            "광주", "대전", "울산", "세종", "제주",
        ],
        1,
    )
]


# ══════════════════════════════════════════════════════════════════════════════
# 신규 엔드포인트 — AI 추천 (Neo4j + ChromaDB + Groq)
# ══════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────
# GET /api/artists
# ─────────────────────────────────────────────
@app.get("/api/artists")
def list_artists():
    """아티스트 목록 반환 (Supabase artist 테이블)"""
    if not HAS_AI:
        return {"artists": FALLBACK_ARTISTS}
    try:
        artists = get_all_artists()
        return {"artists": artists or FALLBACK_ARTISTS}
    except Exception as e:
        print(f"[K-Ride] Supabase artists fallback: {e}")
        return {"artists": FALLBACK_ARTISTS}


# ─────────────────────────────────────────────
# GET /api/regions
# ─────────────────────────────────────────────
@app.get("/api/regions")
def list_regions():
    """지역 목록 반환 (Neo4j Region 노드, 안전점수 내림차순)"""
    if not HAS_AI:
        return {"regions": FALLBACK_REGIONS}
    try:
        regions = get_regions(limit=20)
        # Neo4j에 Region 노드가 없으면 하드코딩 fallback
        if not regions:
            regions = FALLBACK_REGIONS
        return {"regions": regions}
    except Exception as e:
        print(f"[K-Ride] Neo4j regions fallback: {e}")
        return {"regions": FALLBACK_REGIONS}


# ─────────────────────────────────────────────
# POST /api/recommend/ai
# ─────────────────────────────────────────────
@app.post("/api/recommend/ai")
def recommend_ai(req: RecommendAIRequest):
    """
    온보딩 기반 POI 추천
    파이프라인: Neo4j(아티스트 촬영지) → ChromaDB(목적 유사 POI) → Groq(추천 이유)
    """
    if not HAS_AI:
        raise HTTPException(status_code=503, detail="AI 모듈 미설치")

    # 1. Neo4j — 아��스트 촬영지 POI
    neo4j_pois = []
    if req.artists:
        search_names = list(set(
            req.artists + [ARTIST_NAME_MAP.get(a, a) for a in req.artists]
        ))
        try:
            neo4j_pois = get_artist_pois(search_names, limit=15)
        except Exception:
            pass

    # 2. ChromaDB — 목적 기반 유사 POI
    chroma_pois = []
    if req.purposes:
        query_text = " ".join(req.purposes + req.regions)
        try:
            chroma_pois = search_pois_by_purpose(req.purposes, query_text, top_k=5)
        except Exception:
            pass

    # 3. 합산 + 중복 제거
    merged: dict[str, dict] = {}
    for p in neo4j_pois + chroma_pois:
        key = p.get("poi_id") or p.get("name", "")
        if key not in merged:
            merged[key] = p

    pois = list(merged.values())

    # 4. 예산 필터링 (avg_cost 필드 있을 때만)
    if req.budget:
        pois = [
            p for p in pois
            if p.get("avg_cost") is None
            or req.budget.min <= p.get("avg_cost", 0) <= req.budget.max
        ]

    # 5. Groq — 추천 이유 텍스트
    rec_text = ""
    if pois:
        try:
            rec_text = generate_recommendation_text(
                pois, req.artists, req.regions, req.purposes
            )
        except Exception as e:
            rec_text = f"추천 텍스트 생성 실패: {e}"

    return {
        "pois": pois[:10],
        "recommendation_text": rec_text,
        "count": len(pois),
    }


# ─────────────────────────────────────────────
# POST /api/recommend/itinerary
# ─────────────────────────────────────────────
@app.post("/api/recommend/itinerary")
async def recommend_itinerary(req: ItineraryRequest):
    """
    AI 일정 생성
    파이프라인: Neo4j(아티스트+지역 POI) → ChromaDB(목적 유사 POI) → Groq(일정 JSON)
    """
    if not HAS_AI:
        raise HTTPException(status_code=503, detail="AI 모듈 미설치")

    # 0. 아티스트 이름 변환 (영문 → 한글, Neo4j는 한글명으로 저장)
    resolved_artists = []
    for a in req.artists:
        resolved = ARTIST_NAME_MAP.get(a, a)
        resolved_artists.append(resolved)
    # 영문 + 한글 모두 포함하여 검색 범위 확대
    search_artists = list(set(req.artists + resolved_artists))
    if resolved_artists != req.artists:
        print(f"[K-Ride] 아티스트 이름 변환: {req.artists} → {resolved_artists}")

    # 1. Neo4j — 아티스트 촬영지
    artist_pois = []
    if search_artists:
        try:
            artist_pois = get_artist_pois(search_artists, limit=10)
            print(f"[K-Ride] artist_pois: {len(artist_pois)}건 (artists={search_artists})")
        except Exception as e:
            print(f"[K-Ride] ❌ Neo4j artist_pois 실패: {e}")

    # 2. Neo4j — 지역 POI
    region_pois = []
    if req.regions:
        try:
            region_pois = get_region_pois(req.regions, limit=10)
            print(f"[K-Ride] region_pois: {len(region_pois)}건 (regions={req.regions})")
        except Exception as e:
            print(f"[K-Ride] ❌ Neo4j region_pois 실패: {e}")

    # 3. ChromaDB — 목적 기반 POI
    chroma_pois = []
    if req.purposes:
        query_text = " ".join(req.purposes + req.regions)
        try:
            chroma_pois = search_pois_by_purpose(req.purposes, query_text, top_k=5)
            print(f"[K-Ride] chroma_pois: {len(chroma_pois)}건 (purposes={req.purposes})")
        except Exception as e:
            print(f"[K-Ride] ❌ ChromaDB 실패: {e}")

    # 3.5 GraphRAG — 2-hop + community 기반 POI 확장
    graphrag_pois = []
    if HAS_GRAPHRAG and get_graphrag_pois:
        try:
            existing_ids = set()
            for p in artist_pois + region_pois + chroma_pois:
                pid = p.get("poi_id") or p.get("id") or ""
                if pid:
                    existing_ids.add(pid)
            # 아티스트 ID 추출 (artist_XX 형태)
            artist_graph_ids = [f"artist_{i+1}" for i in range(len(search_artists))]
            graphrag_pois = get_graphrag_pois(
                artist_ids=artist_graph_ids,
                existing_poi_ids=existing_ids,
                max_pois=10,
            )
            print(f"[K-Ride] graphrag_pois: {len(graphrag_pois)}건")
        except Exception as e:
            print(f"[K-Ride] ❌ GraphRAG 실패: {e}")

    # 4. duration별 동적 top_k
    top_k_map = {"당일치기": 8, "1박2일": 11, "2박3일": 15}
    dynamic_top_k = top_k_map.get(req.duration, 15)

    # 4. 앙상블 랭킹 또는 단순 합산
    # 지역 필터링 (선택한 지역이 있을 경우 다른 지역 POI 배제)
    if req.regions:
        artist_pois = [p for p in artist_pois if any(r in (p.get("address") or p.get("sido") or "") for r in req.regions)]
        chroma_pois = [p for p in chroma_pois if any(r in (p.get("address") or p.get("sido") or "") for r in req.regions)]
        graphrag_pois = [p for p in graphrag_pois if any(r in (p.get("address") or p.get("sido") or "") for r in req.regions)]

    neo4j_pois = artist_pois + region_pois
    all_source_pois = neo4j_pois + chroma_pois + graphrag_pois
    if HAS_ENSEMBLE and ensemble_rank_pois:
        try:
            all_pois = ensemble_rank_pois(
                neo4j_pois=neo4j_pois + graphrag_pois,
                chroma_pois=chroma_pois,
                artists=req.artists,
                regions=req.regions,
                purposes=req.purposes,
                budget=req.budget.dict(),
                top_k=dynamic_top_k,
            )
            print(f"[K-Ride] 앙상블 랭킹: {len(all_pois)}건 (neo4j={len(neo4j_pois)} + chroma={len(chroma_pois)} + graphrag={len(graphrag_pois)}, top_k={dynamic_top_k})")
        except Exception as e:
            print(f"[K-Ride] 앙상블 fallback → union: {e}")
            merged: dict[str, dict] = {}
            for p in all_source_pois:
                key = p.get("poi_id") or p.get("name", "")
                if key not in merged:
                    merged[key] = p
            all_pois = list(merged.values())[:dynamic_top_k]
    else:
        merged: dict[str, dict] = {}
        for p in all_source_pois:
            key = p.get("poi_id") or p.get("name", "")
            if key not in merged:
                merged[key] = p
        all_pois = list(merged.values())[:dynamic_top_k]
        print(f"[K-Ride] 총 POI: {len(all_pois)}건 (artist={len(artist_pois)} + region={len(region_pois)} + chroma={len(chroma_pois)} + graphrag={len(graphrag_pois)}, top_k={dynamic_top_k})")

    # 4-1. Supabase fallback — Neo4j/ChromaDB 모두 실패 시 Supabase에서 POI 조회
    if not all_pois:
        print("[K-Ride] ⚠️ all_pois=0 → Supabase fallback 시도")
        try:
            from src.api.supabase_client import get_client as get_supabase
            sb = get_supabase()
            # 아티스트 기반 edges → POI 조회
            fallback_poi_ids = []
            if req.artists:
                edge_resp = sb.table("edges").select("source, target").eq("relation_type", "FILMING_AT").execute()
                # artist name → artist id 매핑
                artist_resp = sb.table("nodes").select("id, metadata").like("id", "artist_%").execute()
                name_to_id = {}
                for row in (artist_resp.data or []):
                    meta = row.get("metadata") or {}
                    name_to_id[meta.get("name", "")] = row["id"]
                    name_to_id[meta.get("name_en", "")] = row["id"]
                target_artist_ids = {name_to_id.get(a) for a in req.artists if name_to_id.get(a)}
                for edge in (edge_resp.data or []):
                    if edge["target"] in target_artist_ids:
                        fallback_poi_ids.append(edge["source"])

            # 지역 기반 POI 조회
            if req.regions and not fallback_poi_ids:
                poi_resp = sb.table("nodes").select("id, metadata").like("id", "poi_%").limit(200).execute()
                for row in (poi_resp.data or []):
                    meta = row.get("metadata") or {}
                    addr = meta.get("address", "")
                    if any(r in addr for r in req.regions):
                        fallback_poi_ids.append(row["id"])

            # POI 상세 조회
            if fallback_poi_ids:
                poi_resp = sb.table("nodes").select("id, metadata").in_("id", fallback_poi_ids[:20]).execute()
                for row in (poi_resp.data or []):
                    meta = row.get("metadata") or {}
                    if meta.get("name"):
                        all_pois.append({
                            "poi_id": row["id"],
                            "name": meta.get("name", ""),
                            "lat": meta.get("lat"),
                            "lon": meta.get("lon"),
                            "address": meta.get("address", ""),
                            "category": meta.get("category", ""),
                            "sido": meta.get("sido", ""),
                        })
                print(f"[K-Ride] Supabase fallback: {len(all_pois)}건 POI 로드")
        except Exception as e:
            print(f"[K-Ride] ❌ Supabase fallback 실패: {e}")

    # 4-2. 지리적 클러스터링 (동선 최적화)
    all_pois = _cluster_pois_by_proximity(all_pois)
    print(f"[K-Ride] 클러스터링 완료: {len(all_pois)}건 POI → LLM 전달")

    # 5. Groq — 일정 생성
    try:
        itinerary_result = generate_itinerary(
            duration=req.duration,
            artists=req.artists,
            regions=req.regions,
            purposes=req.purposes,
            budget=req.budget.dict(),
            pois=all_pois,
        )
    except TypeError:
        theme = req.purposes[0] if req.purposes else ""
        itinerary_result = generate_itinerary(all_pois, req.duration, theme)
    except Exception as e:
        print(f"[K-Ride] itinerary fallback: {e}")
        itinerary_result = {"itinerary": []}

    if isinstance(itinerary_result, str):
        import json
        try:
            itinerary_result = json.loads(itinerary_result)
        except json.JSONDecodeError:
            itinerary_result = {"itinerary": [], "raw": itinerary_result}

    if not isinstance(itinerary_result, dict):
        itinerary_result = {"itinerary": []}
    itinerary_result.setdefault("itinerary", [])

    # 6. mapData 마커 생성 (좌표 있는 POI만)
    markers = [
        {"name": p.get("name", ""), "lat": p["lat"], "lon": p["lon"]}
        for p in all_pois
        if p.get("lat") and p.get("lon")
    ]

    # 7. POI 마커가 없으면 LLM 일정의 주소로 지오코딩 fallback
    if not markers and itinerary_result.get("itinerary"):
        try:
            markers = await geocode_itinerary_places(itinerary_result["itinerary"])
            print(f"[K-Ride] 지오코딩 마커 {len(markers)}개 생성")
        except Exception as e:
            print(f"[K-Ride] 지오코딩 실패: {e}")

    return {
        **itinerary_result,
        "mapData": {"markers": markers},
        "source_pois": all_pois[:15],
    }


@app.post("/api/chat/stream")
def chat_stream(req: ChatStreamRequest):
    import json as _json

    message = (req.message or "").strip()
    if not message:
        def _empty():
            yield f"data: {_json.dumps({'content': 'K-Ride assistant is ready.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_empty(), media_type="text/event-stream; charset=utf-8")

    def _sse():
        try:
            for token in generate_chat_answer_stream(message):
                yield f"data: {_json.dumps({'content': token})}\n\n"
        except Exception as exc:
            print(f"[K-Ride] chat stream fallback: {exc}")
            yield f"data: {_json.dumps({'content': 'K-Ride assistant is ready. Please try again with a travel question.'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_sse(), media_type="text/event-stream; charset=utf-8")


@app.post("/api/chat/qa")
def chat_qa(req: ChatStreamRequest):
    """Non-streaming QA endpoint — Spring Boot chatSync() 용"""
    message = (req.message or "").strip()
    if not message:
        return {"reply": "K-Ride assistant is ready."}
    try:
        reply = generate_chat_answer(message)
    except Exception as exc:
        print(f"[K-Ride] chat qa fallback: {exc}")
        reply = "죄송합니다. 답변 중 오류가 발생했어요. 다시 시도해주세요."
    return {"reply": reply}
