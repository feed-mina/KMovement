"""Best-effort persistence for K-Ride route and recommendation history."""
from __future__ import annotations

import json
import os
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_TABLE_NAME = "user_route_history"
SUCCESS_STORE_VALUES = {"auto", "supabase"}
LOCAL_STORE_VALUES = {"local", "jsonl"}
DISABLED_VALUES = {"0", "false", "off", "disabled", "none"}
HISTORY_SELECT_COLUMNS = (
    "id,user_sqno,user_id,activity_type,activity_date,distance_km,"
    "safety_score,tourism_score,visited_regions,recommended_pois,"
    "request_payload,response_payload,created_at"
)


def fetch_user_route_history(
    user_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Return a user's route/recommendation history as timeline-ready records."""
    rows = _read_history_rows_for_user(user_id, limit=limit, offset=offset)
    return [_format_history_item(row) for row in rows]


def fetch_user_route_summary(user_id: str) -> dict[str, Any]:
    """Aggregate route history for a single user's MY_PAGE widgets."""
    rows = _read_history_rows_for_user(user_id, limit=500, offset=0)
    return _aggregate_history(rows)


def fetch_travel_trends(*, limit: int = 10, sample_size: int = 1000) -> dict[str, Any]:
    """Aggregate top regions/artists for the admin dashboard."""
    rows = _read_recent_history_rows(limit=sample_size)
    aggregate = _aggregate_history(rows, top_limit=limit)
    return {
        "total_routes": aggregate["total_routes"],
        "total_distance_km": aggregate["total_distance_km"],
        "regions": aggregate["visited_regions"],
        "artists": aggregate["preferred_artists"],
    }


def save_user_route_history(
    activity_type: str,
    request: Any,
    response: dict[str, Any],
    *,
    resolved_regions: list[str] | None = None,
    route_metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist a compact activity-history row without affecting API responses."""
    if _is_disabled():
        return {"stored": False, "reason": "disabled"}

    request_payload = _model_to_dict(request)
    user_sqno = request_payload.get("user_sqno")
    user_id = request_payload.get("user_id") or (
        str(user_sqno) if user_sqno is not None else None
    )

    if not user_id and not _capture_anonymous():
        return {"stored": False, "reason": "missing_user"}

    row = _build_history_row(
        activity_type=activity_type,
        user_sqno=user_sqno,
        user_id=user_id or "anonymous",
        request_payload=request_payload,
        response_payload=response,
        resolved_regions=resolved_regions,
        route_metrics=route_metrics,
    )

    store = os.environ.get("KRIDE_ROUTE_HISTORY_STORE", "auto").strip().lower()
    local_path = os.environ.get("KRIDE_ROUTE_HISTORY_LOCAL_PATH", "").strip()

    if store in SUCCESS_STORE_VALUES and _has_supabase_env():
        result = _insert_supabase(row)
        if result.get("stored"):
            return result
        if not local_path:
            return result

    if store in LOCAL_STORE_VALUES or local_path:
        return _append_jsonl(row, local_path)

    return {"stored": False, "reason": "no_store_configured"}


def _read_history_rows_for_user(user_id: str, *, limit: int, offset: int) -> list[dict[str, Any]]:
    if not _has_supabase_env() or _is_blank_user(user_id):
        return []

    table_name = os.environ.get("KRIDE_ROUTE_HISTORY_TABLE", DEFAULT_TABLE_NAME)
    safe_limit = max(1, min(int(limit or 20), 100))
    safe_offset = max(0, int(offset or 0))
    numeric_user = _to_int_or_none(user_id)

    try:
        from src.api.supabase_client import get_client

        query = (
            get_client()
            .table(table_name)
            .select(HISTORY_SELECT_COLUMNS)
            .order("activity_date", desc=True)
            .order("created_at", desc=True)
            .range(safe_offset, safe_offset + safe_limit - 1)
        )
        if numeric_user is not None:
            query = query.eq("user_sqno", numeric_user)
        else:
            query = query.eq("user_id", str(user_id))
        resp = query.execute()
        return list(resp.data or [])
    except Exception as exc:
        print(f"[K-Ride] route history read skipped: {str(exc)[:500]}")
        return []


def _read_recent_history_rows(*, limit: int) -> list[dict[str, Any]]:
    if not _has_supabase_env():
        return []

    table_name = os.environ.get("KRIDE_ROUTE_HISTORY_TABLE", DEFAULT_TABLE_NAME)
    safe_limit = max(1, min(int(limit or 1000), 5000))

    try:
        from src.api.supabase_client import get_client

        resp = (
            get_client()
            .table(table_name)
            .select(HISTORY_SELECT_COLUMNS)
            .order("activity_date", desc=True)
            .order("created_at", desc=True)
            .limit(safe_limit)
            .execute()
        )
        return list(resp.data or [])
    except Exception as exc:
        print(f"[K-Ride] route trend read skipped: {str(exc)[:500]}")
        return []


def _format_history_item(row: dict[str, Any]) -> dict[str, Any]:
    request_payload = _ensure_dict(row.get("request_payload"))
    response_payload = _ensure_dict(row.get("response_payload"))
    regions = _extract_regions(row, request_payload, response_payload)
    artists = _extract_artists(row, request_payload, response_payload)
    pois = row.get("recommended_pois") if isinstance(row.get("recommended_pois"), list) else []
    activity_type = str(row.get("activity_type") or "route")
    activity_date = _date_string(row.get("activity_date") or row.get("created_at"))
    distance_km = _to_float_or_none(row.get("distance_km"))
    safety_score = _to_float_or_none(row.get("safety_score"))
    tourism_score = _to_float_or_none(row.get("tourism_score"))

    title = _history_title(activity_type, regions, artists)
    summary_parts = []
    if regions:
        summary_parts.append(" / ".join(regions[:3]))
    if artists:
        summary_parts.append(", ".join(artists[:3]))
    if distance_km is not None:
        summary_parts.append(f"{round(distance_km, 1)}km")
    if not summary_parts and pois:
        summary_parts.append(f"{len(pois)} POI")

    return {
        "id": row.get("id") or f"{activity_type}-{activity_date}",
        "activity_type": activity_type,
        "activity_date": activity_date,
        "date": activity_date.replace("-", ".") if activity_date else "",
        "title": title,
        "summary": " · ".join(summary_parts),
        "regions": regions,
        "artists": artists,
        "distance_km": distance_km,
        "safety_score": safety_score,
        "tourism_score": tourism_score,
        "poi_count": len(pois),
        "recommended_pois": pois[:5],
        "created_at": _date_string(row.get("created_at")),
    }


def _aggregate_history(rows: list[dict[str, Any]], *, top_limit: int = 10) -> dict[str, Any]:
    region_counter: Counter[str] = Counter()
    artist_counter: Counter[str] = Counter()
    distance_values: list[float] = []
    safety_values: list[float] = []
    tourism_values: list[float] = []

    for row in rows:
        request_payload = _ensure_dict(row.get("request_payload"))
        response_payload = _ensure_dict(row.get("response_payload"))
        region_counter.update(_extract_regions(row, request_payload, response_payload))
        artist_counter.update(_extract_artists(row, request_payload, response_payload))

        distance = _to_float_or_none(row.get("distance_km"))
        safety = _to_float_or_none(row.get("safety_score"))
        tourism = _to_float_or_none(row.get("tourism_score"))
        if distance is not None:
            distance_values.append(distance)
        if safety is not None:
            safety_values.append(safety)
        if tourism is not None:
            tourism_values.append(tourism)

    avg_safety = _average(safety_values)
    avg_tourism = _average(tourism_values)
    return {
        "total_routes": len(rows),
        "total_distance_km": round(sum(distance_values), 1),
        "avg_safety_score": avg_safety or 0,
        "avg_tourism_score": avg_tourism or 0,
        "avg_safety_percent": _score_to_percent(avg_safety),
        "avg_tourism_percent": _score_to_percent(avg_tourism),
        "visited_regions": _counter_to_points(region_counter, top_limit),
        "preferred_artists": _counter_to_points(artist_counter, top_limit),
    }


def _extract_regions(
    row: dict[str, Any],
    request_payload: dict[str, Any],
    response_payload: dict[str, Any],
) -> list[str]:
    values: list[Any] = []
    values.extend(_listish(row.get("visited_regions")))
    for key in ("regions", "selected_regions", "visitedRegions"):
        values.extend(_listish(request_payload.get(key)))
        values.extend(_listish(response_payload.get(key)))
    return _unique_labels(values)


def _extract_artists(
    row: dict[str, Any],
    request_payload: dict[str, Any],
    response_payload: dict[str, Any],
) -> list[str]:
    """추천 요청에 명시된 아티스트뿐 아니라, 실제로 추천된 성지가 달고 있는
    아티스트까지 모은다. 명시 선택만 세면 'Preferred artists'가 좀처럼 채워지지 않는다."""
    values: list[Any] = []
    for key in ("artists", "artist_ids", "selected_artists", "selectedArtists", "artist", "artistName"):
        values.extend(_listish(request_payload.get(key)))
        values.extend(_listish(response_payload.get(key)))

    # 저장된 POI가 성지면 artist 를 갖고 있다(V76 tour_poi 확장).
    for poi in _listish_pois(row.get("recommended_pois")):
        for key in ("artist", "artist_name", "fandom_info"):
            values.extend(_listish(poi.get(key)))

    return _unique_labels(values)


def _listish_pois(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _history_title(activity_type: str, regions: list[str], artists: list[str]) -> str:
    if activity_type == "route_planning":
        prefix = "Route planning"
    elif activity_type == "poi_recommendation":
        prefix = "POI recommendation"
    elif activity_type == "segment_recommendation":
        prefix = "Segment recommendation"
    else:
        prefix = "Travel history"

    if regions:
        return f"{prefix}: {regions[0]}"
    if artists:
        return f"{prefix}: {artists[0]}"
    return prefix


def _counter_to_points(counter: Counter[str], limit: int) -> list[dict[str, Any]]:
    return [
        {"label": label, "name": label, "value": count, "count": count}
        for label, count in counter.most_common(max(1, limit))
    ]


def _score_to_percent(value: float | None) -> float:
    if value is None:
        return 0
    scaled = value * 100 if 0 <= value <= 1 else value
    return round(scaled, 1)


def _ensure_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _listish(value: Any) -> list[Any]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple) or isinstance(value, set):
        return list(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except ValueError:
            pass
        return [part.strip() for part in value.split(",") if part.strip()]
    return [value]


def _unique_labels(values: list[Any]) -> list[str]:
    labels: list[str] = []
    seen: set[str] = set()
    for value in values:
        label = _label_from_value(value)
        if not label or label in seen:
            continue
        seen.add(label)
        labels.append(label)
    return labels


def _label_from_value(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("name", "label", "title", "id"):
            raw = value.get(key)
            if raw not in (None, ""):
                return str(raw).strip()
        return ""
    return str(value).strip()


def _date_string(value: Any) -> str:
    if not value:
        return ""
    return str(value).split("T")[0][:10]


def _is_blank_user(user_id: str) -> bool:
    return str(user_id).strip().lower() in {"", "none", "null", "undefined", "guest"}


def _is_disabled() -> bool:
    return os.environ.get("KRIDE_ROUTE_HISTORY_STORE", "auto").strip().lower() in DISABLED_VALUES


def _capture_anonymous() -> bool:
    return os.environ.get("KRIDE_ROUTE_HISTORY_CAPTURE_ANONYMOUS", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _has_supabase_env() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY"))


def _model_to_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return _json_safe(value.model_dump(mode="json"))
    if hasattr(value, "dict"):
        return _json_safe(value.dict())
    if isinstance(value, dict):
        return _json_safe(value)
    return {}


def _build_history_row(
    *,
    activity_type: str,
    user_sqno: Any,
    user_id: str,
    request_payload: dict[str, Any],
    response_payload: dict[str, Any],
    resolved_regions: list[str] | None,
    route_metrics: dict[str, Any] | None,
) -> dict[str, Any]:
    regions = list(dict.fromkeys(
        [str(region) for region in (resolved_regions or request_payload.get("regions") or []) if region]
    ))
    metrics = route_metrics or _summarize_scores(response_payload)
    activity_date = (
        request_payload.get("travel_date")
        or request_payload.get("activity_date")
        or datetime.now(timezone.utc).date().isoformat()
    )

    return {
        "id": str(uuid.uuid4()),
        "user_sqno": _to_int_or_none(user_sqno),
        "user_id": user_id,
        "activity_type": activity_type,
        "activity_date": str(activity_date)[:10],
        "distance_km": _to_float_or_none(metrics.get("distance_km")),
        "safety_score": _to_float_or_none(metrics.get("safety_score")),
        "tourism_score": _to_float_or_none(metrics.get("tourism_score")),
        "visited_regions": regions,
        "recommended_pois": _extract_recommended_pois(response_payload),
        "request_payload": _trim_payload(request_payload),
        "response_payload": _trim_payload(response_payload),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _summarize_scores(response_payload: dict[str, Any]) -> dict[str, Any]:
    segments = response_payload.get("segments")
    if isinstance(segments, list) and segments:
        return {
            "distance_km": sum(_to_float_or_zero(item.get("length_km")) for item in segments),
            "safety_score": _average(item.get("safety_score") for item in segments),
            "tourism_score": _average(item.get("tourism_score") for item in segments),
        }

    return {
        "distance_km": response_payload.get("total_distance_km"),
        "safety_score": response_payload.get("avg_safety_score"),
        "tourism_score": response_payload.get("avg_tourism_score"),
    }


def _extract_recommended_pois(response_payload: dict[str, Any]) -> list[dict[str, Any]]:
    pois: list[dict[str, Any]] = []
    for key in ("pois", "source_pois", "pois_on_route"):
        value = response_payload.get(key)
        if isinstance(value, list):
            pois.extend(_compact_poi(item) for item in value if isinstance(item, dict))

    itinerary = response_payload.get("itinerary")
    if isinstance(itinerary, list):
        for place in _iter_itinerary_places(itinerary):
            pois.append(_compact_poi(place))

    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for poi in pois:
        key = str(poi.get("poi_id") or poi.get("id") or poi.get("name") or poi)
        if key in seen:
            continue
        seen.add(key)
        unique.append(poi)
    return unique[:50]


def _iter_itinerary_places(value: Any):
    if isinstance(value, dict):
        places = value.get("places")
        if isinstance(places, list):
            for place in places:
                if isinstance(place, dict):
                    yield place
        for child in value.values():
            yield from _iter_itinerary_places(child)
    elif isinstance(value, list):
        for item in value:
            yield from _iter_itinerary_places(item)


def _compact_poi(item: dict[str, Any]) -> dict[str, Any]:
    return {
        key: _json_safe(item.get(key))
        # artist/fandom_info 는 성지 POI 의 아티스트 집계에 쓰인다.
        for key in ("poi_id", "id", "name", "title", "category", "address", "sido", "lat", "lon",
                    "artist", "artist_name", "fandom_info")
        if item.get(key) not in (None, "")
    }


def _insert_supabase(row: dict[str, Any]) -> dict[str, Any]:
    table_name = os.environ.get("KRIDE_ROUTE_HISTORY_TABLE", DEFAULT_TABLE_NAME)
    try:
        from src.api.supabase_client import get_client

        payload = dict(row)
        payload.pop("id", None)
        get_client().table(table_name).insert(payload).execute()
        return {"stored": True, "store": "supabase", "table": table_name}
    except Exception as exc:
        message = str(exc)
        hint = ""
        if "does not exist" in message or "PGRST205" in message or "schema cache" in message:
            hint = (
                f" — table '{table_name}' is missing; apply the user_route_history DDL"
                " from db_schema.sql in the Supabase SQL editor"
            )
        print(f"[K-Ride] route history Supabase save skipped: {message}{hint}")
        return {"stored": False, "reason": "supabase_error", "error": message[:500]}


def _append_jsonl(row: dict[str, Any], configured_path: str) -> dict[str, Any]:
    path = Path(configured_path or "route_history.jsonl")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
        return {"stored": True, "store": "jsonl", "path": str(path)}
    except Exception as exc:
        print(f"[K-Ride] route history local save skipped: {exc}")
        return {"stored": False, "reason": "jsonl_error", "error": str(exc)[:500]}


def _trim_payload(value: Any, *, max_list_items: int = 20) -> Any:
    value = _json_safe(value)
    if isinstance(value, dict):
        return {key: _trim_payload(child, max_list_items=max_list_items) for key, child in value.items()}
    if isinstance(value, list):
        return [_trim_payload(item, max_list_items=max_list_items) for item in value[:max_list_items]]
    return value


def _json_safe(value: Any) -> Any:
    try:
        return json.loads(json.dumps(value, ensure_ascii=False, default=str))
    except TypeError:
        return str(value)


def _average(values: Any) -> float | None:
    numbers = [_to_float_or_none(value) for value in values]
    valid = [value for value in numbers if value is not None]
    if not valid:
        return None
    return round(sum(valid) / len(valid), 4)


def _to_float_or_none(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_float_or_zero(value: Any) -> float:
    return _to_float_or_none(value) or 0.0


def _to_int_or_none(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None
