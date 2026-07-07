"""Best-effort persistence for K-Ride route and recommendation history."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_TABLE_NAME = "user_route_history"
SUCCESS_STORE_VALUES = {"auto", "supabase"}
LOCAL_STORE_VALUES = {"local", "jsonl"}
DISABLED_VALUES = {"0", "false", "off", "disabled", "none"}


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
        for key in ("poi_id", "id", "name", "title", "category", "address", "sido", "lat", "lon")
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
