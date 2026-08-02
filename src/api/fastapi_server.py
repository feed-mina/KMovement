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

import asyncio
import hashlib
import json
import logging
import math
import os
import pickle
import hmac
import re
import time
from typing import Literal, Optional
import httpx

import networkx as nx
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger("kride.itinerary")

from src.api.route_history import (
    describe_history_config,
    fetch_travel_trends,
    fetch_user_route_history,
    fetch_user_route_summary,
    log_history_config,
    save_user_route_history,
)

try:
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
    print(f"[K-Ride] AI 모듈 로드 실패 (pip install chromadb groq supabase): {_e}")
    HAS_AI = False
    get_all_artists = lambda: []
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
    from src.api.graphrag_client import (
        get_graphrag_pois,
        get_region_pois_from_graph,
        search_artists_by_name,
        get_graphrag_context_for_chat,
    )
    HAS_GRAPHRAG = True
except ImportError:
    HAS_GRAPHRAG = False
    get_graphrag_pois = None
    get_region_pois_from_graph = None
    search_artists_by_name = None
    get_graphrag_context_for_chat = None
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
PREMIUM_FOOD_PATH = os.path.join(RAW_DIR, "premium_food_clean.csv")


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

# 여행 이력 저장 설정을 부팅 때 한 번 남긴다. MY_PAGE 통계가 비어 있을 때
# "저장이 애초에 꺼져 있었다"를 로그만으로 판별할 수 있어야 한다.
log_history_config()


@app.get("/api/diagnostics/route-history")
def route_history_diagnostics():
    """여행 이력 저장 설정 스냅샷. 키·URL 같은 비밀값은 담지 않는다."""
    return describe_history_config()


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
df_premium_food = _load_df(PREMIUM_FOOD_PATH)

print(f"[K-Ride] 그래프 로드: {graph_meta}")
print(f"[K-Ride] road_scored: {df_scored.shape if df_scored is not None else 'None'}")
print(f"[K-Ride] facility:    {df_facility.shape if df_facility is not None else 'None'}")
print(f"[K-Ride] poi:         {df_poi.shape if df_poi is not None else 'None'}")
print(f"[K-Ride] premium food: {df_premium_food.shape if df_premium_food is not None else 'None'}")


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


_GEOCODE_CACHE: dict[str, dict | None] = {}
# Nominatim 이용 정책상 초당 1회를 넘기면 안 되므로 호출 자체에서 간격을 강제한다.
# 캐시 적중은 네트워크를 타지 않으므로 대기하지 않는다.
_GEOCODE_MIN_INTERVAL_SEC = 1.1
_GEOCODE_LOCK = asyncio.Lock()
_geocode_last_request_at = 0.0
# 한 요청에서 지오코딩을 시도할 장소 수 상한. 간격 강제 때문에 장소 하나당 약 1초가
# 추가되므로, 비정상적으로 긴 일정이 응답 시간을 끌지 않도록 제한한다.
GEOCODE_BUDGET_PER_REQUEST = max(0, int(os.getenv("ITINERARY_GEOCODE_BUDGET", "8")))
_LAT_KEYS = ("lat", "latitude", "mapy", "y")
_LNG_KEYS = ("lng", "lon", "longitude", "mapx", "x")


def _coordinate_value(item: dict, keys: tuple[str, ...]) -> float | None:
    for key in keys:
        value = item.get(key)
        if value is None or value == "":
            continue
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(parsed):
            return parsed
    return None


def extract_coordinates(item: dict | None) -> dict | None:
    """서로 다른 POI 좌표 키를 한국 영역의 lat/lng로 정규화한다."""
    if not isinstance(item, dict):
        return None
    lat = _coordinate_value(item, _LAT_KEYS)
    lng = _coordinate_value(item, _LNG_KEYS)
    if lat is None or lng is None:
        return None
    if not (32.0 <= lat <= 39.5 and 123.0 <= lng <= 132.0):
        return None
    return {"lat": lat, "lng": lng}


def _place_name(item: dict) -> str:
    return str(item.get("name") or item.get("placeName") or item.get("place_name") or item.get("title") or "").strip()


def _place_id(item: dict) -> str:
    return str(item.get("id") or item.get("poi_id") or item.get("placeId") or item.get("place_id") or "").strip()


def _normalize_place_key(value: object) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _itinerary_places(itinerary: list) -> list[dict]:
    result: list[dict] = []
    for day_index, day in enumerate(itinerary or []):
        if not isinstance(day, dict):
            continue
        day_number = day.get("day") or day_index + 1
        for slot in ("morning", "afternoon", "evening"):
            slot_data = day.get(slot) or {}
            places = slot_data if isinstance(slot_data, list) else slot_data.get("places", []) if isinstance(slot_data, dict) else []
            for place_index, place in enumerate(places if isinstance(places, list) else []):
                if isinstance(place, dict) and _place_name(place):
                    result.append({**place, "day": day_number, "slot": slot, "index": place_index})
        if isinstance(day.get("places"), list):
            for place_index, place in enumerate(day["places"]):
                if isinstance(place, dict) and _place_name(place):
                    result.append({**place, "day": day_number, "slot": place.get("slot") or "day", "index": place_index})
    return result


def _marker(place: dict, coord: dict, source: str) -> dict:
    name = _place_name(place)
    marker_id = _place_id(place) or f"{_normalize_place_key(name)}-{place.get('day', 0)}-{place.get('slot', '')}"
    return {
        "id": marker_id,
        "name": name,
        "address": place.get("address") or "",
        "lat": coord["lat"],
        "lng": coord["lng"],
        "day": place.get("day"),
        "slot": place.get("slot"),
        "index": place.get("index"),
        "coordinateSource": source,
    }


async def geocode_address(address: str) -> dict | None:
    """Nominatim으로 한국 주소/장소 검색어를 lat/lng로 변환한다."""
    global _geocode_last_request_at
    query = " ".join(str(address or "").split())
    if not query:
        return None
    if query in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[query]
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": query, "format": "json", "limit": 1, "countrycodes": "kr"}
    try:
        async with _GEOCODE_LOCK:
            # 락을 기다리는 동안 다른 호출이 같은 질의를 채웠을 수 있다.
            if query in _GEOCODE_CACHE:
                return _GEOCODE_CACHE[query]
            wait = _GEOCODE_MIN_INTERVAL_SEC - (time.monotonic() - _geocode_last_request_at)
            if wait > 0:
                await asyncio.sleep(wait)
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, params=params, headers={"User-Agent": "KRide/1.0"})
                _geocode_last_request_at = time.monotonic()
                resp.raise_for_status()
                data = resp.json()
            if data:
                coord = extract_coordinates(data[0])
                _GEOCODE_CACHE[query] = coord
                return coord
            # 조회는 성공했는데 결과가 없는 경우다. 같은 요청 안에서 반복 조회하지 않도록
            # 실패도 기억한다. 예외(일시적 장애)는 캐시하지 않는다.
            _GEOCODE_CACHE[query] = None
    except Exception as exc:
        logger.warning("itinerary_geocode_error query=%r error=%s", query, exc)
    return None


async def resolve_itinerary_markers(itinerary: list, source_pois: list, regions: list[str] | None = None) -> dict:
    """일정 장소를 자체 좌표, 원본 POI, 지오코딩 순으로 지도 마커에 연결한다."""
    places = _itinerary_places(itinerary)
    source_pois = [poi for poi in (source_pois or []) if isinstance(poi, dict)]
    source_by_id = {_place_id(poi): poi for poi in source_pois if _place_id(poi)}
    source_by_name = {_normalize_place_key(_place_name(poi)): poi for poi in source_pois if _place_name(poi)}
    source_markers = [poi for poi in source_pois if extract_coordinates(poi)]

    markers: list[dict] = []
    unresolved: list[dict] = []
    used_source_ids: set[str] = set()
    marker_keys: set[str] = set()
    resolved_itinerary_count = 0
    # 좌표를 가진 source POI가 하나라도 있으면 지오코딩을 통째로 건너뛰던 동작 때문에,
    # 이름이 매칭되지 않은 장소가 곧바로 미해석 처리됐다. 이제 장소별로 판단한다.
    geocode_budget = GEOCODE_BUDGET_PER_REQUEST

    def append_marker(value: dict) -> None:
        key = value.get("id") or f"{_normalize_place_key(value.get('name'))}:{value.get('lat')}:{value.get('lng')}"
        if key in marker_keys:
            return
        marker_keys.add(str(key))
        markers.append(value)

    for place in places:
        coord = extract_coordinates(place)
        coordinate_source = "itinerary"
        matched_poi = None
        if coord is None:
            matched_poi = source_by_id.get(_place_id(place)) or source_by_name.get(_normalize_place_key(_place_name(place)))
            coord = extract_coordinates(matched_poi)
            coordinate_source = "poi"

        geocode_query = ""
        geocode_attempted = False
        if coord is None:
            address = str(place.get("address") or "").strip()
            geocode_query = address or " ".join([_place_name(place), *(regions or [])]).strip()
            if geocode_query and geocode_budget > 0:
                geocode_budget -= 1
                geocode_attempted = True
                coord = await geocode_address(geocode_query)
                coordinate_source = "geocode"

        if coord is None:
            # 일정 장소는 이름이 있어야 수집되므로 질의는 항상 만들어진다.
            # 따라서 남은 실패 경로는 "지오코딩 실패"와 "예산 소진" 둘뿐이다.
            reason = "geocode_failed" if geocode_attempted else "geocode_budget_exhausted"
            unresolved.append({
                "id": _place_id(place) or None,
                "name": _place_name(place),
                "address": place.get("address") or "",
                "reason": reason,
                "geocodeQuery": geocode_query,
            })
            continue

        marker_place = {**(matched_poi or {}), **place}
        append_marker(_marker(marker_place, coord, coordinate_source))
        resolved_itinerary_count += 1
        if matched_poi and _place_id(matched_poi):
            used_source_ids.add(_place_id(matched_poi))

    # 기존 계약을 유지하면서 일정에 직접 매칭되지 않은 좌표 보유 POI도 노출한다.
    for index, poi in enumerate(source_markers):
        if _place_id(poi) and _place_id(poi) in used_source_ids:
            continue
        coord = extract_coordinates(poi)
        if coord:
            append_marker(_marker({**poi, "index": index}, coord, "poi"))

    if not places:
        status = "not_required"
    elif resolved_itinerary_count == len(places):
        status = "complete"
    elif resolved_itinerary_count > 0 or markers:
        status = "partial"
    else:
        status = "failed"

    logger.info(
        "itinerary_marker_resolution status=%s places=%d markers=%d unresolved=%d",
        status, len(places), len(markers), len(unresolved),
    )
    return {
        "markers": markers,
        "markerResolutionStatus": status,
        "resolvedMarkerCount": len(markers),
        "unresolvedPlaces": unresolved,
    }


async def geocode_itinerary_places(itinerary: list) -> list[dict]:
    """기존 호출부 호환용 일정 지오코딩 래퍼."""
    return (await resolve_itinerary_markers(itinerary, []))["markers"]


def _add_restaurant_recommendations(itinerary_result: dict, all_pois: list):
    """일정 결과의 오전/오후 섹션에 추천 프리미엄 맛집 추가"""
    if df_premium_food is None or df_premium_food.empty:
        return
        
    itinerary = itinerary_result.get("itinerary", [])
    if not itinerary:
        return
        
    poi_dict = {p.get("name"): p for p in all_pois}
    
    for day in itinerary:
        for slot in ["morning", "afternoon"]:
            slot_data = day.get(slot, {})
            places = slot_data.get("places", [])
            
            lats, lons = [], []
            for place in places:
                p_name = place.get("name")
                matched_poi = poi_dict.get(p_name)
                if matched_poi and matched_poi.get("lat") and matched_poi.get("lon"):
                    lats.append(float(matched_poi["lat"]))
                    lons.append(float(matched_poi["lon"]))
                elif place.get("lat") and place.get("lon"):
                    lats.append(float(place["lat"]))
                    lons.append(float(place["lon"]))
                    
            if lats and lons:
                avg_lat = sum(lats) / len(lats)
                avg_lon = sum(lons) / len(lons)
                
                recs = []
                for _, row in df_premium_food.iterrows():
                    if pd.notna(row.get("lat")) and pd.notna(row.get("lon")):
                        dist = haversine((avg_lat, avg_lon), (float(row["lat"]), float(row["lon"])))
                        recs.append({
                            "name": row["name"],
                            "rating": row.get("rating", 4.8),
                            "tag": row.get("tag", "프리미엄 맛집"),
                            "dist": dist
                        })
                recs = sorted(recs, key=lambda x: x["dist"])
                top_recs = [r for r in recs if r["dist"] < 30][:3]
                
                if top_recs:
                    for r in top_recs:
                        del r["dist"]
                    slot_data["restaurants"] = top_recs


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
    user_id: Optional[str] = None
    user_sqno: Optional[int] = None
    lat: float
    lon: float
    radius_km: float = 5.0
    w_safety: float = 0.6
    w_tourism: float = 0.4
    top_n: int = 10

# # [메모] radius_km 이라는건 구역은 radius_km을 사용해서 원구로 인식하나요 ? 혹시 나중에 이 범위를 3,5,10으로 바꿀 수 있나요 

class RouteRequest(BaseModel):
    user_id: Optional[str] = None
    user_sqno: Optional[int] = None
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    w_safety: float = 0.6
    w_tourism: float = 0.4
    travel_date: Optional[str] = None   # Phase 3-8에서 활용


class CourseRequest(BaseModel):
    user_id: Optional[str] = None
    user_sqno: Optional[int] = None
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
@app.get("/api/users/{user_id}/route-history")
def user_route_history(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return fetch_user_route_history(user_id, limit=limit, offset=offset)


@app.get("/api/users/{user_id}/summary")
def user_route_summary(user_id: str):
    return fetch_user_route_summary(user_id)


@app.get("/api/stats/travel-trends")
def travel_trends(limit: int = Query(10, ge=1, le=20)):
    return fetch_travel_trends(limit=limit)


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
    result = {
        "segments": top[["start_lat", "start_lon", "end_lat", "end_lon",
                          "safety_score", "tourism_score", "_score", "length_km"]
                        ].rename(columns={"_score": "final_score"}).to_dict(orient="records")
    }
    save_user_route_history("segment_recommendation", req, result)
    return result


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

    save_user_route_history(
        "route",
        req,
        result,
        route_metrics={
            "distance_km": round(total_dist, 3),
            "safety_score": round(avg_safety, 4),
            "tourism_score": round(avg_tourism, 4),
        },
    )

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
    user_id: Optional[str] = None
    user_sqno: Optional[int] = None
    message:  str = ""
    artists:  list[str] = Field(default_factory=list)
    regions:  list[str] = Field(default_factory=list)
    purposes: list[str] = Field(default_factory=list)
    budget:   BudgetSchema = Field(default_factory=BudgetSchema)

class ItineraryRequest(BaseModel):
    user_id: Optional[str] = None
    user_sqno: Optional[int] = None
    message:  str = ""
    duration: str | int = "당일치기"   # 당일치기 | 1박2일 | 2박3일
    artists:  list[str] = Field(default_factory=list)
    regions:  list[str] = Field(default_factory=list)
    purposes: list[str] = Field(default_factory=list)
    budget:   BudgetSchema = Field(default_factory=BudgetSchema)

# 채팅 메시지에서 지역명/목적 키워드 추출
_KNOWN_REGIONS = [
    # 광역시/도
    "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
    "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
    # 시/군 단위
    "전주", "경주", "여수", "속초", "강릉", "춘천", "수원", "성남",
    "고양", "용인", "창원", "포항", "김해", "안동", "목포", "순천",
    "통영", "거제", "남해", "하동", "담양", "보성", "완도", "해남",
    # 서울 주요 구/동 (구 단위 필터링 지원)
    "강남", "서초", "송파", "마포", "홍대", "이태원", "용산", "종로",
    "성수", "잠실", "여의도", "강서", "영등포", "동대문", "명동",
    "강북", "노원", "은평", "관악", "광진", "성동", "중구",
]
_KNOWN_PURPOSES = [
    "맛집", "관광지", "촬영지", "카페", "숙소", "호텔", "게스트하우스",
    "자연", "힐링", "액티비티", "문화", "역사", "쇼핑", "야경",
    "데이트", "가족", "혼자", "친구",
]

_PURPOSE_LABEL_TO_KEY = {
    "kculture": "kculture",
    "k-culture": "kculture",
    "k culture": "kculture",
    "k컬처": "kculture",
    "k-컬처": "kculture",
    "케이컬처": "kculture",
    "케이 컬처": "kculture",
    "한류": "kculture",
    "관광": "kculture",
    "관광지": "kculture",
    "명소": "kculture",
    "촬영지": "kculture",
    "문화": "kculture",
    "액티비티": "kculture",
    "야경": "kculture",
    "데이트": "kculture",
    "food": "food",
    "restaurant": "food",
    "restaurants": "food",
    "cafe": "food",
    "맛집": "food",
    "음식": "food",
    "식당": "food",
    "레스토랑": "food",
    "카페": "food",
    "nature": "nature",
    "natural": "nature",
    "rest": "nature",
    "자연": "nature",
    "힐링": "nature",
    "산책": "nature",
    "풍경": "nature",
    "history": "history",
    "historic": "history",
    "historical": "history",
    "역사": "history",
    "전통": "history",
    "궁궐": "history",
    "한옥": "history",
    "박물관": "history",
    "shopping": "shopping",
    "쇼핑": "shopping",
}

def _extract_from_message(message: str, regions: list[str], purposes: list[str]):
    """채팅 메시지에서 지역/목적 키워드를 추출하여 기존 폼 데이터에 병합"""
    if not message:
        return regions, purposes
    msg_regions = [r for r in _KNOWN_REGIONS if r in message]
    msg_purposes = [p for p in _KNOWN_PURPOSES if p in message]
    for label in _PURPOSE_LABEL_TO_KEY:
        if label in message and label not in msg_purposes:
            msg_purposes.append(label)
    merged_regions = list(dict.fromkeys(msg_regions if msg_regions else regions))
    merged_purposes = list(dict.fromkeys(msg_purposes + purposes))
    return merged_regions, merged_purposes

def _normalize_purpose_keys(purposes: list[str]) -> list[str]:
    """Map request/display purpose labels to the Chroma collection keys."""
    keys: list[str] = []
    for purpose in purposes or []:
        raw = str(purpose).strip()
        if not raw:
            continue
        normalized = raw.lower()
        key = (
            _PURPOSE_LABEL_TO_KEY.get(raw)
            or _PURPOSE_LABEL_TO_KEY.get(normalized)
            or normalized
        )
        if key not in keys:
            keys.append(key)
    return keys

def _matches_any_region(poi: dict, regions: list[str]) -> bool:
    haystack = " ".join(
        str(poi.get(field) or "")
        for field in ("address", "sido", "region")
    )
    return any(region and region in haystack for region in regions)

class ChatStreamRequest(BaseModel):
    message: str = ""


_REQUEST_MODEL_TYPES = {"BudgetSchema": BudgetSchema, "Optional": Optional}
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
    # 그래프에 노드가 있는데 목록에 없어 고를 수 없던 둘. 이미지 자산도 있다.
    {"id": "itzy",             "name": "ITZY",             "name_ko": "있지",        "imageUrl": "/artists/ITZY.jpg"},
    {"id": "ive",              "name": "IVE",              "name_ko": "아이브",      "imageUrl": "/artists/IVE.jpg"},
]

# 영문 → 한글 아티스트 이름 매핑 (그래프에 한글명으로 저장됨)
ARTIST_NAME_MAP = {}
for _a in FALLBACK_ARTISTS:
    ARTIST_NAME_MAP[_a["name"]] = _a.get("name_ko") or _a["name"]
    ARTIST_NAME_MAP[_a["name"].upper()] = _a.get("name_ko") or _a["name"]
    ARTIST_NAME_MAP[_a["name"].lower()] = _a.get("name_ko") or _a["name"]

# /api/regions 가 내보내는 시·도 목록. 이름이 FALLBACK_ 이던 시절에는 Neo4j
# Region 노드가 먼저였고 이건 대체 경로였다. Neo4j 를 걷어낸 지금은 이것이
# 유일한 소스라 이름도 그에 맞춘다. graphrag_client._REGION_ALIASES 와 같은
# 17개여야 지역 선택이 POI 조회로 이어진다.
REGIONS = [
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
# 신규 엔드포인트 — AI 추천 (GraphRAG + ChromaDB + Groq)
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
    """지역 목록 반환.

    예전에는 Neo4j Region 노드를 먼저 조회하고 실패하면 이 목록으로 떨어졌다.
    Aura 인스턴스가 사라진 뒤로는 항상 이쪽만 나갔고, 이제 Neo4j 를 걷어냈으니
    이 목록이 유일한 소스다. 그래프에서 시·도와 POI 개수를 파생하는 건 별도
    작업으로 둔다.
    """
    return {"regions": REGIONS}


# ─────────────────────────────────────────────
# POST /api/recommend/ai
# ─────────────────────────────────────────────
@app.post("/api/recommend/ai")
def recommend_ai(req: RecommendAIRequest):
    """
    온보딩 기반 POI 추천
    파이프라인: ChromaDB(목적 유사 POI) → GraphRAG(아티스트·지역 POI) → Groq(추천 이유)
    """
    if not HAS_AI:
        raise HTTPException(status_code=503, detail="AI 모듈 미설치")

    # 0. 메시지에서 지역/목적 추출하여 폼 데이터 보강
    regions, purposes = _extract_from_message(req.message, req.regions, req.purposes)
    purpose_keys = _normalize_purpose_keys(purposes)
    print(f"[K-Ride] recommend/ai message='{req.message}' regions={regions} purposes={purposes} purpose_keys={purpose_keys}")

    # 아티스트·지역 POI 는 아래 GraphRAG 단계가 담당한다. 예전에는 Neo4j 를
    # 먼저 조회했으나 Aura 인스턴스가 사라진 뒤 그 두 블록은 항상 빈 리스트를
    # 만들고 예외를 삼켰다.

    # 3. ChromaDB — 목적 기반 유사 POI
    chroma_pois = []
    if purpose_keys:
        query_text = " ".join(list(dict.fromkeys(purposes + purpose_keys + regions)))
        try:
            chroma_pois = search_pois_by_purpose(purpose_keys, query_text, top_k=8)
            print(f"[K-Ride] recommend/ai chroma_pois: {len(chroma_pois)}건 (purpose_keys={purpose_keys})")
        except Exception as e:
            print(f"[K-Ride] recommend/ai chroma fallback: {e}")

    # 3.5 GraphRAG — 2-hop + community 기반 POI 확장
    graphrag_pois = []
    if HAS_GRAPHRAG:
        try:
            search_names = list(set(
                req.artists + [ARTIST_NAME_MAP.get(a, a) for a in req.artists]
            ))
            artist_ids = search_artists_by_name(search_names) if search_names else []
            existing_ids = {p.get("poi_id") or p.get("name", "") for p in chroma_pois}
            if artist_ids:
                graphrag_pois = get_graphrag_pois(artist_ids, existing_ids, max_pois=10)
                print(f"[K-Ride] recommend/ai graphrag_pois: {len(graphrag_pois)}건")
            elif search_names:
                print(
                    f"[K-Ride] ⚠️ recommend/ai 그래프에 없는 아티스트: {search_names}"
                )
            # 아티스트 기반으로 못 찾으면 지역으로 대체한다. 아티스트를 아예
            # 고르지 않은 요청도 여기서 커버된다.
            if not graphrag_pois and regions and get_region_pois_from_graph:
                graphrag_pois = get_region_pois_from_graph(
                    region_names=regions,
                    existing_poi_ids={i for i in existing_ids if i},
                    max_pois=10,
                )
                print(
                    f"[K-Ride] recommend/ai graphrag 지역 대체: "
                    f"{len(graphrag_pois)}건 (regions={regions})"
                )
        except Exception as e:
            print(f"[K-Ride] recommend/ai graphrag fallback: {e}")

    # 4. 선택 지역이 있으면 보강 후보도 같은 지역으로 제한
    if regions:
        chroma_pois = [p for p in chroma_pois if _matches_any_region(p, regions)]
        graphrag_pois = [p for p in graphrag_pois if _matches_any_region(p, regions)]

    # 5. 합산 + 중복 제거
    merged: dict[str, dict] = {}
    for p in chroma_pois + graphrag_pois:
        key = p.get("poi_id") or p.get("name", "")
        if key not in merged:
            merged[key] = p

    pois = list(merged.values())

    # 6. 예산 필터링 (avg_cost 필드 있을 때만)
    if req.budget:
        pois = [
            p for p in pois
            if p.get("avg_cost") is None
            or req.budget.min <= p.get("avg_cost", 0) <= req.budget.max
        ]

    # 7. Groq — 추천 이유 텍스트
    rec_text = ""
    if pois:
        try:
            rec_text = generate_recommendation_text(
                pois, req.artists, regions, purposes
            )
        except Exception as e:
            rec_text = f"추천 텍스트 생성 실패: {e}"

    result = {
        "pois": pois[:10],
        "recommendation_text": rec_text,
        "count": len(pois),
    }
    save_user_route_history(
        "poi_recommendation",
        req,
        result,
        resolved_regions=regions,
    )
    return result


# ─────────────────────────────────────────────
# POST /api/recommend/itinerary
# ─────────────────────────────────────────────
@app.post("/api/recommend/itinerary")
async def recommend_itinerary(req: ItineraryRequest):
    """
    AI 일정 생성
    파이프라인: ChromaDB(목적 유사 POI) → GraphRAG(아티스트+지역 POI) → Groq(일정 JSON)
    """
    if not HAS_AI:
        raise HTTPException(status_code=503, detail="AI 모듈 미설치")

    # 0. 메시지에서 지역/목적 추출하여 폼 데이터 보강
    regions, purposes = _extract_from_message(req.message, req.regions, req.purposes)
    print(f"[K-Ride] itinerary message='{req.message}' regions={regions} purposes={purposes}")

    # 0.5 아티스트 이름 변환 (영문 → 한글, 그래프는 한글명으로 저장)
    resolved_artists = []
    for a in req.artists:
        resolved = ARTIST_NAME_MAP.get(a, a)
        resolved_artists.append(resolved)
    # 영문 + 한글 모두 포함하여 검색 범위 확대
    search_artists = list(set(req.artists + resolved_artists))
    if resolved_artists != req.artists:
        print(f"[K-Ride] 아티스트 이름 변환: {req.artists} → {resolved_artists}")

    # 아티스트·지역 POI 는 아래 GraphRAG 단계가 담당한다. Neo4j 를 먼저
    # 조회하던 두 블록은 Aura 인스턴스가 사라진 뒤 늘 빈 리스트였다.

    # 3. ChromaDB — 목적 기반 POI
    chroma_pois = []
    if purposes:
        query_text = " ".join(purposes + regions)
        try:
            chroma_pois = search_pois_by_purpose(purposes, query_text, top_k=5)
            print(f"[K-Ride] chroma_pois: {len(chroma_pois)}건 (purposes={purposes})")
        except Exception as e:
            print(f"[K-Ride] ❌ ChromaDB 실패: {e}")

    # 3.5 GraphRAG — 2-hop + community 기반 POI 확장
    graphrag_pois = []
    if HAS_GRAPHRAG and get_graphrag_pois:
        try:
            existing_ids = set()
            for p in chroma_pois:
                pid = p.get("poi_id") or p.get("id") or ""
                if pid:
                    existing_ids.add(pid)
            # 이름으로 graph artist_id 를 찾는다. 예전에는 요청한 아티스트
            # 개수만큼 artist_1, artist_2 ... 를 기계적으로 만들었는데, 그건
            # 이름과 무관한 노드를 가리켰다. ["BTS"] 가 artist_1(선재 업고
            # 튀어)이 되는 식이다. /api/recommend/ai 와 같은 방식으로 맞춘다.
            artist_graph_ids = (
                search_artists_by_name(search_artists) if search_artists_by_name else []
            )
            graphrag_pois = (
                get_graphrag_pois(
                    artist_ids=artist_graph_ids,
                    existing_poi_ids=existing_ids,
                    max_pois=10,
                )
                if artist_graph_ids
                else []
            )
            print(
                f"[K-Ride] graphrag_pois: {len(graphrag_pois)}건 "
                f"(artists={search_artists} → {artist_graph_ids})"
            )
            if search_artists and not artist_graph_ids:
                # UI 목록에는 있으나 그래프에 노드가 없는 아티스트다. 어떤
                # 이름이 데이터 없이 나갔는지 남겨야 나중에 채울 수 있다.
                print(
                    f"[K-Ride] ⚠️ 그래프에 없는 아티스트: {search_artists} "
                    f"— 지역 기반으로 대체한다"
                )
            # 아티스트로 아무것도 못 찾았고 지역이 선택돼 있으면 지역 POI 로
            # 대체한다. 아티스트 특화는 아니지만 장소 없는 일정보다 낫다.
            if not graphrag_pois and regions and get_region_pois_from_graph:
                graphrag_pois = get_region_pois_from_graph(
                    region_names=regions,
                    existing_poi_ids=existing_ids,
                    max_pois=10,
                )
                print(
                    f"[K-Ride] graphrag 지역 대체: {len(graphrag_pois)}건 "
                    f"(regions={regions})"
                )
        except Exception as e:
            print(f"[K-Ride] ❌ GraphRAG 실패: {e}")

    # 4. duration별 동적 top_k
    top_k_map = {"당일치기": 8, "1박2일": 11, "2박3일": 15}
    dynamic_top_k = top_k_map.get(req.duration, 15)

    # 4. 앙상블 랭킹 또는 단순 합산
    # 지역 필터링 (선택한 지역이 있을 경우 다른 지역 POI 배제)
    if regions:
        chroma_pois = [p for p in chroma_pois if any(r in (p.get("address") or p.get("sido") or "") for r in regions)]
        graphrag_pois = [p for p in graphrag_pois if any(r in (p.get("address") or p.get("sido") or "") for r in regions)]

    all_source_pois = chroma_pois + graphrag_pois
    if HAS_ENSEMBLE and ensemble_rank_pois:
        try:
            # 인자 이름은 rank_pois 의 시그니처를 그대로 따른다. 그래프 출처
            # POI 를 받는 자리라는 뜻이고, 이제 GraphRAG 결과만 들어간다.
            all_pois = ensemble_rank_pois(
                neo4j_pois=graphrag_pois,
                chroma_pois=chroma_pois,
                artists=req.artists,
                regions=regions,
                purposes=purposes,
                budget=req.budget.model_dump(),
                top_k=dynamic_top_k,
            )
            print(f"[K-Ride] 앙상블 랭킹: {len(all_pois)}건 (chroma={len(chroma_pois)} + graphrag={len(graphrag_pois)}, top_k={dynamic_top_k})")
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
        print(f"[K-Ride] 총 POI: {len(all_pois)}건 (chroma={len(chroma_pois)} + graphrag={len(graphrag_pois)}, top_k={dynamic_top_k})")

    # 4-1. Supabase fallback — GraphRAG/ChromaDB 모두 실패 시 Supabase에서 POI 조회
    if not all_pois:
        print("[K-Ride] ⚠️ all_pois=0 → Supabase fallback 시도")
        try:
            from src.api.supabase_client import get_client as get_supabase
            sb = get_supabase()
            # 아티스트 기반 edges → POI 조회
            fallback_poi_ids = []
            if req.artists:
                # 아티스트 조회가 실패해도 아래 지역 경로는 살려야 한다. 예전에는
                # 이 블록의 예외가 바깥 except 로 빠져나가면서 지역 조회까지
                # 통째로 건너뛰었다. 아티스트를 고르는 것이 주 흐름이라 사실상
                # 대체 경로 전체가 죽어 있었다.
                try:
                    # 컬럼은 source_id / target_id 다. source / target 으로
                    # 조회하면 PostgREST 가 42703 을 낸다.
                    edge_resp = sb.table("edges").select("source_id, target_id").eq("relation_type", "FILMING_AT").execute()
                    # artist name → artist id 매핑
                    artist_resp = sb.table("nodes").select("id, metadata").like("id", "artist_%").execute()
                    name_to_id = {}
                    for row in (artist_resp.data or []):
                        meta = row.get("metadata") or {}
                        name_to_id[meta.get("name", "")] = row["id"]
                        name_to_id[meta.get("name_en", "")] = row["id"]
                    target_artist_ids = {name_to_id.get(a) for a in req.artists if name_to_id.get(a)}
                    for edge in (edge_resp.data or []):
                        if edge["target_id"] in target_artist_ids:
                            fallback_poi_ids.append(edge["source_id"])
                except Exception as artist_err:
                    print(f"[K-Ride] Supabase 아티스트 경로 실패, 지역으로 계속: {artist_err}")

            # 지역 기반 POI 조회
            if regions and not fallback_poi_ids:
                poi_resp = sb.table("nodes").select("id, metadata").like("id", "poi_%").limit(200).execute()
                for row in (poi_resp.data or []):
                    meta = row.get("metadata") or {}
                    addr = meta.get("address", "")
                    if any(r in addr for r in regions):
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
            regions=regions,
            purposes=purposes,
            budget=req.budget.model_dump(),
            pois=all_pois,
        )
    except TypeError:
        theme = purposes[0] if purposes else ""
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

    # 오전/오후 섹션에 추천 프리미엄 맛집 추가
    _add_restaurant_recommendations(itinerary_result, all_pois)

    # 6. 일정 장소를 자체 좌표 → 원본 POI → 지오코딩 순으로 지도 마커에 연결
    marker_result = await resolve_itinerary_markers(
        itinerary_result.get("itinerary", []),
        all_pois,
        regions,
    )

    result = {
        **itinerary_result,
        "mapData": marker_result,
        "markerResolutionStatus": marker_result["markerResolutionStatus"],
        "resolvedMarkerCount": marker_result["resolvedMarkerCount"],
        "unresolvedPlaces": marker_result["unresolvedPlaces"],
        "source_pois": all_pois[:15],
    }
    save_user_route_history(
        "itinerary",
        req,
        result,
        resolved_regions=regions,
    )
    return result


def _build_graphrag_chat_context(message: str) -> str:
    """채팅 메시지에서 GraphRAG POI 컨텍스트를 텍스트로 생성"""
    if not HAS_GRAPHRAG:
        return ""
    try:
        pois = get_graphrag_context_for_chat(message, max_pois=5)
        if not pois:
            return ""
        lines = []
        for p in pois:
            name = p.get("name", "")
            addr = p.get("address", "")
            cat = p.get("category", "")
            lines.append(f"- {name} ({cat}) — {addr}")
        print(f"[K-Ride] chat graphrag_pois: {len(pois)}건")
        return "\n".join(lines)
    except Exception as e:
        print(f"[K-Ride] chat graphrag fallback: {e}")
        return ""


@app.post("/api/chat/stream")
def chat_stream(req: ChatStreamRequest):
    import json as _json

    message = (req.message or "").strip()
    if not message:
        def _empty():
            yield f"data: {_json.dumps({'content': 'K-Ride assistant is ready.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_empty(), media_type="text/event-stream; charset=utf-8")

    graphrag_ctx = _build_graphrag_chat_context(message)

    def _sse():
        try:
            for token in generate_chat_answer_stream(message, graphrag_context=graphrag_ctx):
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
        graphrag_ctx = _build_graphrag_chat_context(message)
        reply = generate_chat_answer(message, graphrag_context=graphrag_ctx)
    except Exception as exc:
        print(f"[K-Ride] chat qa fallback: {exc}")
        reply = "죄송합니다. 답변 중 오류가 발생했어요. 다시 시도해주세요."
    return {"reply": reply}


# ─────────────────────────────────────────────────────────────────────────────
# RunPod Serverless Proxy — 커뮤니티 영상 생성
# ─────────────────────────────────────────────────────────────────────────────
RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY", "")
RUNPOD_ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "")
RUNPOD_MEDIA_ENDPOINT_ID = os.environ.get("RUNPOD_MEDIA_ENDPOINT_ID", "") or RUNPOD_ENDPOINT_ID
RUNPOD_TORA_ENDPOINT_ID = os.environ.get("RUNPOD_TORA_ENDPOINT_ID", "") or RUNPOD_ENDPOINT_ID
FASTAPI_INTERNAL_API_KEY = (
    os.environ.get("FASTAPI_INTERNAL_API_KEY", "").strip()
)

# Tora 전용 라우트 목록 — 이 라우트는 B타입 엔드포인트로 전송
_TORA_ROUTES = {"tora_cogvideox_i2v"}


def _resolve_endpoint_id(route: str) -> str:
    """라우트에 따라 적절한 RunPod 엔드포인트 ID를 반환한다."""
    if route in _TORA_ROUTES:
        return RUNPOD_TORA_ENDPOINT_ID
    return RUNPOD_MEDIA_ENDPOINT_ID


def _configured_runpod_endpoint_ids() -> list[str]:
    endpoint_ids: list[str] = []
    for endpoint_id in (RUNPOD_MEDIA_ENDPOINT_ID, RUNPOD_TORA_ENDPOINT_ID, RUNPOD_ENDPOINT_ID):
        if endpoint_id and endpoint_id not in endpoint_ids:
            endpoint_ids.append(endpoint_id)
    return endpoint_ids


def _require_internal_api_key(
    x_internal_api_key: str = Header(default="", alias="X-Internal-Api-Key"),
) -> None:
    if not FASTAPI_INTERNAL_API_KEY or not hmac.compare_digest(
        x_internal_api_key,
        FASTAPI_INTERNAL_API_KEY,
    ):
        raise HTTPException(status_code=401, detail="Invalid internal API key.")


class RunPodJobRequest(BaseModel):
    route: str = Field(..., description="animated_drawings_worker, cogvideox_real, 3d_photo_inpainting_real, tora_cogvideox_i2v 등")
    case_id: str = "travel_case"
    place: str = "Travel Place"
    image_url: str = Field(..., min_length=1)
    tts_text: str = "여행 영상입니다."
    bgm_key: str = "bright_travel"
    motion: str = "slow_zoom_in"
    motion_intensity: float = 0.03
    prompt: str = ""
    allow_fallback: bool = True
    musicgen_description: str = "calm Korean ambient music"
    musicgen_duration: int = 15
    trajectory_points: list | None = None  # [[x,y], ...] normalized 0.0~1.0
    trajectory_preset: str = ""  # "object_pan_right", "arc_up", etc.
    overlay_image_url: str = ""
    overlay_position: str = "main_w-overlay_w-10:main_h-overlay_h-10"
    overlay_alpha: float = Field(default=1.0, ge=0.1, le=1.0)
    overlay_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    overlay_scale_ratio: float = Field(default=0.2, gt=0.0, le=1.0)


class BatchImageInput(BaseModel):
    image_url: str = Field(..., min_length=1)
    tts_text: str = ""
    image_type: str = "auto"


class RunPodBatchJobRequest(BaseModel):
    case_id: str = "batch_case"
    place: str = "Community Post"
    images: list[BatchImageInput] = Field(..., min_length=1, max_length=10)
    bgm_key: str = "bright_travel"
    photo_route: str = "auto"  # "auto", "cogvideox_real", "3d_photo_light"
    allow_fallback: bool = True
    bgm_description: str = ""  # MusicGen prompt (empty → sine-wave fallback)
    bgm_duration: int = 15  # MusicGen generation length in seconds
    default_tts_text: str = ""  # BLIP-2 실패 시 fallback TTS (게시글 제목)


@app.post("/jobs/runpod/batch")
def runpod_batch_proxy(
    request: RunPodBatchJobRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Proxy batch video job to RunPod Serverless endpoint."""
    endpoint_id = RUNPOD_MEDIA_ENDPOINT_ID
    if not RUNPOD_API_KEY or not endpoint_id:
        return JSONResponse(
            status_code=501,
            content={"ok": False, "message": "RUNPOD_API_KEY and RUNPOD_MEDIA_ENDPOINT_ID are required."},
        )

    payload = {
        "input": {
            "route": "batch_video",
            "case_id": request.case_id,
            "place": request.place,
            "images": [img.model_dump() for img in request.images],
            "bgm_key": request.bgm_key,
            "photo_route": request.photo_route,
            "allow_fallback": request.allow_fallback,
            "bgm_description": request.bgm_description,
            "bgm_duration": request.bgm_duration,
            "default_tts_text": request.default_tts_text,
        }
    }
    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"}
    url = f"https://api.runpod.ai/v2/{endpoint_id}/run"

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return JSONResponse(content={"ok": True, "endpoint": endpoint_id, "endpoint_id": endpoint_id, **resp.json()})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})


@app.post("/jobs/runpod")
def runpod_proxy(
    request: RunPodJobRequest,
    _: None = Depends(_require_internal_api_key),
):
    endpoint_id = _resolve_endpoint_id(request.route)
    if not RUNPOD_API_KEY or not endpoint_id:
        return JSONResponse(
            status_code=501,
            content={"ok": False, "message": "RUNPOD_API_KEY and endpoint ID are required."},
        )

    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"}
    payload = {"input": request.model_dump()}
    url = f"https://api.runpod.ai/v2/{endpoint_id}/run"

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return JSONResponse(content={"ok": True, "endpoint": endpoint_id, "endpoint_id": endpoint_id, **resp.json()})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})


@app.get("/jobs/runpod/{job_id}")
def runpod_status(
    job_id: str,
    endpoint: str = "",
    _: None = Depends(_require_internal_api_key),
):
    """RunPod 작업 상태 조회.

    endpoint 파라미터로 조회할 엔드포인트를 지정할 수 있다.
    미지정 시 기본(Media) 엔드포인트를 먼저 조회하고, 404면 Tora 엔드포인트도 시도한다.
    """
    if not RUNPOD_API_KEY:
        return JSONResponse(status_code=501, content={"ok": False, "message": "RunPod not configured."})

    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}

    # 명시적 endpoint 지정 시 해당 엔드포인트만 조회
    if endpoint:
        url = f"https://api.runpod.ai/v2/{endpoint}/status/{job_id}"
        try:
            resp = httpx.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            return JSONResponse(content={"ok": True, "endpoint": endpoint, "endpoint_id": endpoint, **resp.json()})
        except Exception as exc:
            return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})

    # 미지정 시 Media → Tora 순서로 시도
    endpoints_to_try = _configured_runpod_endpoint_ids()
    if not endpoints_to_try:
        return JSONResponse(status_code=501, content={"ok": False, "message": "No RunPod endpoint configured."})

    last_exc = None
    for eid in endpoints_to_try:
        url = f"https://api.runpod.ai/v2/{eid}/status/{job_id}"
        try:
            resp = httpx.get(url, headers=headers, timeout=15)
            if resp.status_code == 404:
                continue
            resp.raise_for_status()
            return JSONResponse(content={"ok": True, "endpoint": eid, "endpoint_id": eid, **resp.json()})
        except Exception as exc:
            last_exc = exc

    return JSONResponse(
        status_code=502,
        content={"ok": False, "error": str(last_exc)[:2000] if last_exc else "Job not found on any endpoint."},
    )


# ── Celery Job API ───────────────────────────────────────────────────────────


class CeleryEmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=100)


class CeleryRerankRequest(BaseModel):
    query: str = Field(..., min_length=1)
    documents: list[str] = Field(..., min_length=1, max_length=100)


class CeleryWeatherRequest(BaseModel):
    sequence: list = Field(..., min_length=1)


class CeleryEventRequest(BaseModel):
    text: str = Field(..., min_length=1)


class CeleryTtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_id: str = Field(default="default", min_length=1, max_length=64)
    lang: str = Field(default="ko", min_length=2, max_length=16)


class CeleryVideoRequest(BaseModel):
    image_url: str = Field(..., min_length=8, max_length=2048, pattern=r"^https://")
    route: Literal[
        "cogvideox_real",
        "3d_photo_inpainting_real",
        "3d_photo_light",
    ] = "cogvideox_real"
    tts_text: str = Field(default="", max_length=5000)
    case_id: str = Field(
        default="celery_video",
        min_length=1,
        max_length=100,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    bgm_key: str = Field(default="bright_travel", min_length=1, max_length=100)
    motion: str = Field(default="slow_zoom_in", min_length=1, max_length=100)
    prompt: str = Field(default="", max_length=4000)
    allow_fallback: bool = True


class CeleryKpopOutfitRequest(BaseModel):
    sourceKey: str = Field(
        ...,
        min_length=24,
        max_length=512,
        pattern=r"^kpop-analysis/[1-9][0-9]*/[A-Za-z0-9][A-Za-z0-9._-]*$",
    )
    contentType: Literal["image/jpeg", "image/png", "image/webp"]
    consentScope: str = Field(
        ...,
        min_length=1,
        max_length=120,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9:_-]*$",
    )


class CeleryCleanupRequest(BaseModel):
    max_age_hours: float = Field(default=6.0, ge=0.01, le=720.0)


_CELERY_TASK_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_CELERY_ML_TASKS_ENABLED_VALUES = {"1", "true", "yes", "on"}


def _celery_job_token(task_id: str) -> str:
    if not FASTAPI_INTERNAL_API_KEY:
        raise RuntimeError("FASTAPI_INTERNAL_API_KEY is not configured.")
    return hmac.new(
        FASTAPI_INTERNAL_API_KEY.encode("utf-8"),
        task_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _require_celery_job_token(
    task_id: str,
    x_celery_job_token: str = Header(default="", alias="X-Celery-Job-Token"),
) -> None:
    if not _CELERY_TASK_ID_PATTERN.fullmatch(task_id):
        raise HTTPException(status_code=400, detail="Invalid Celery task ID.")
    if not FASTAPI_INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Celery job token.")
    expected = _celery_job_token(task_id)
    if not hmac.compare_digest(x_celery_job_token, expected):
        raise HTTPException(status_code=401, detail="Invalid Celery job token.")


def _require_ml_tasks_enabled() -> None:
    enabled = os.environ.get("CELERY_ML_TASKS_ENABLED", "").strip().lower()
    if enabled not in _CELERY_ML_TASKS_ENABLED_VALUES:
        raise HTTPException(
            status_code=503,
            detail="Celery ML tasks are disabled because no ML worker is configured.",
        )


def _celery_submit_response(result) -> JSONResponse:
    return JSONResponse(content={
        "ok": True,
        "task_id": result.id,
        "status": "QUEUED",
        "status_url": f"/jobs/celery/{result.id}",
        "stream_url": f"/jobs/celery/{result.id}/stream",
    })


def _submit_celery_task(task, *args) -> JSONResponse:
    try:
        result = task.apply_async(args=args)
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "message": "Celery broker에 작업을 제출하지 못했습니다.",
                "error": str(exc)[:2000],
            },
        )
    return _celery_submit_response(result)


@app.post("/jobs/celery/embed")
def celery_embed(
    request: CeleryEmbedRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """배치 임베딩 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_embed_texts
    return _submit_celery_task(task_embed_texts, request.texts)


@app.post("/jobs/celery/rerank")
def celery_rerank(
    request: CeleryRerankRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """리랭킹 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_rerank
    return _submit_celery_task(task_rerank, request.query, request.documents)


@app.post("/jobs/celery/weather")
def celery_weather(
    request: CeleryWeatherRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """날씨 예측 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_predict_weather
    return _submit_celery_task(task_predict_weather, request.sequence)


@app.post("/jobs/celery/event")
def celery_event(
    request: CeleryEventRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """이벤트 분류 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_classify_event
    return _submit_celery_task(task_classify_event, request.text)


@app.post("/jobs/celery/tts")
def celery_tts(
    request: CeleryTtsRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Submit a validated text-to-speech job to the media queue."""
    from src.api.tasks import task_generate_tts
    return _submit_celery_task(
        task_generate_tts,
        request.text,
        request.voice_id,
        request.lang,
    )


@app.post("/jobs/celery/video")
def celery_video(
    request: CeleryVideoRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Submit a validated media-generation job to the media queue."""
    from src.api.tasks import task_generate_video
    return _submit_celery_task(
        task_generate_video,
        request.image_url,
        request.route,
        request.tts_text,
        request.case_id,
        request.bgm_key,
        request.motion,
        request.prompt,
        request.allow_fallback,
    )


@app.post("/jobs/celery/kpop-outfit-analysis")
def celery_kpop_outfit_analysis(
    request: CeleryKpopOutfitRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Submit a consent-checked K-POP outfit image for asynchronous analysis."""
    from src.api.tasks import task_analyze_kpop_outfit
    return _submit_celery_task(
        task_analyze_kpop_outfit,
        request.sourceKey,
        request.contentType,
        request.consentScope,
    )


@app.post("/jobs/celery/cleanup")
def celery_cleanup(
    request: CeleryCleanupRequest | None = None,
    _: None = Depends(_require_internal_api_key),
):
    """Submit an internal cleanup job used by deployment/runtime smoke checks."""
    from src.api.tasks import task_cleanup_temp
    return _submit_celery_task(
        task_cleanup_temp,
        request.max_age_hours if request is not None else None,
    )


def _celery_status_payload(task_id: str, result) -> dict:
    """AsyncResult를 polling/SSE가 공유하는 공개 응답으로 변환한다."""
    celery_status_value = result.status
    public_status = {
        "PENDING": "QUEUED",
        "STARTED": "RUNNING",
        "RETRY": "RETRYING",
    }.get(celery_status_value, celery_status_value)

    response: dict = {
        "ok": True,
        "task_id": task_id,
        "status": public_status,
        "celery_status": celery_status_value,
    }

    if celery_status_value == "SUCCESS":
        response["result"] = jsonable_encoder(result.result)
        response["meta"] = {"step": "complete", "progress": 100}
    elif celery_status_value == "FAILURE":
        response["error"] = str(result.result)[:2000] if result.result else "Unknown error"
    elif celery_status_value == "REVOKED":
        response["error"] = "Task was revoked."
    else:
        info = result.info
        if isinstance(info, dict):
            # custom update_state meta (진행률 등)
            response["meta"] = jsonable_encoder(info)

    return response


def _positive_float_env(name: str, default: float, minimum: float) -> float:
    try:
        value = float(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(value, minimum)


CELERY_SSE_POLL_INTERVAL_SECONDS = _positive_float_env(
    "CELERY_SSE_POLL_INTERVAL_SECONDS", 1.0, 0.1,
)
CELERY_SSE_HEARTBEAT_SECONDS = _positive_float_env(
    "CELERY_SSE_HEARTBEAT_SECONDS", 15.0, 1.0,
)
CELERY_SSE_MAX_DURATION_SECONDS = _positive_float_env(
    "CELERY_SSE_MAX_DURATION_SECONDS", 2100.0, 60.0,
)
_CELERY_TERMINAL_STATES = {"SUCCESS", "FAILURE", "REVOKED"}


@app.get("/jobs/celery/{task_id}")
def celery_status(
    task_id: str,
    _internal: None = Depends(_require_internal_api_key),
    _job: None = Depends(_require_celery_job_token),
):
    """Celery 작업 상태를 단발 조회한다(SSE 미지원 환경의 폴백)."""
    from celery.result import AsyncResult
    from src.api.celery_app import celery as celery_app

    result = AsyncResult(task_id, app=celery_app)
    response = _celery_status_payload(task_id, result)
    return JSONResponse(content=response)


@app.get("/jobs/celery/{task_id}/stream")
async def celery_status_stream(
    task_id: str,
    request: Request,
    _internal: None = Depends(_require_internal_api_key),
    _job: None = Depends(_require_celery_job_token),
):
    """Celery 상태가 바뀔 때만 push하고 완료 후 종료하는 SSE 스트림."""
    from celery.result import AsyncResult
    from src.api.celery_app import celery as celery_app

    async def _events():
        result = AsyncResult(task_id, app=celery_app)
        loop = asyncio.get_running_loop()
        started_at = loop.time()
        last_emit_at = started_at
        last_payload_fingerprint = ""

        while True:
            if await request.is_disconnected():
                return

            try:
                # Celery Redis backend is synchronous; keep its I/O off the ASGI event loop.
                payload = await asyncio.to_thread(_celery_status_payload, task_id, result)
            except Exception as exc:
                logger.warning("Celery SSE backend read failed for %s: %s", task_id, exc)
                error_payload = {
                    "ok": False,
                    "task_id": task_id,
                    "status": "STREAM_ERROR",
                    "error": str(exc)[:2000],
                }
                yield f"data: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            fingerprint = json.dumps(payload, ensure_ascii=False, sort_keys=True)
            now = loop.time()
            if fingerprint != last_payload_fingerprint:
                yield f"data: {fingerprint}\n\n"
                last_payload_fingerprint = fingerprint
                last_emit_at = now
            elif now - last_emit_at >= CELERY_SSE_HEARTBEAT_SECONDS:
                yield ": heartbeat\n\n"
                last_emit_at = now

            if payload["celery_status"] in _CELERY_TERMINAL_STATES:
                yield "data: [DONE]\n\n"
                return

            if now - started_at >= CELERY_SSE_MAX_DURATION_SECONDS:
                timeout_payload = {
                    "ok": False,
                    "task_id": task_id,
                    "status": "STREAM_TIMEOUT",
                    "celery_status": payload["celery_status"],
                    "error": "SSE connection timed out; continue with the status endpoint.",
                }
                yield f"data: {json.dumps(timeout_payload, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            await asyncio.sleep(CELERY_SSE_POLL_INTERVAL_SECONDS)

    return StreamingResponse(
        _events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
