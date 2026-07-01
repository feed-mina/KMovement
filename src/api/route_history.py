"""
route_history.py
================
K-Ride 사용자 경로/추천 이력 저장 모듈

활성화: DATABASE_URL 환경변수가 설정된 경우에만 DB에 저장.
미설정 시 로그만 출력하고 정상 진행 (서버 기동 영향 없음).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger("kride.route_history")

_DATABASE_URL = os.environ.get("DATABASE_URL", "")

try:
    import psycopg2
    from psycopg2.extras import Json
    _HAS_PSYCOPG2 = True
except ImportError:
    _HAS_PSYCOPG2 = False


def _get_conn():
    """DATABASE_URL로 PostgreSQL 연결 반환. 연결 실패 시 None."""
    if not _DATABASE_URL or not _HAS_PSYCOPG2:
        return None
    try:
        return psycopg2.connect(_DATABASE_URL)
    except Exception as exc:
        log.warning("route_history: DB 연결 실패 — %s", exc)
        return None


def save_route_history(
    *,
    user_sqno: int | None,
    user_id: str | None,
    request_type: str,
    distance_km: float | None = None,
    safety_score: float | None = None,
    tourism_score: float | None = None,
    regions: list[str] | None = None,
    recommended_pois: list[dict[str, Any]] | None = None,
) -> bool:
    """
    사용자 K-Ride 활동 이력을 user_route_history 테이블에 저장한다.

    Parameters
    ----------
    user_sqno : 사용자 일련번호 (Spring Boot 기준 PK, 없으면 None)
    user_id   : 사용자 ID 문자열 (없으면 None)
    request_type : "route" | "course" | "itinerary"
    distance_km  : 총 이동 거리 (km)
    safety_score : 평균 안전 점수 (0~1)
    tourism_score: 평균 관광 점수 (0~1)
    regions      : 방문 지역 목록 (["서울", "강남"])
    recommended_pois : 추천 POI 목록 ([{"name":..., "lat":..., "lon":...}])

    Returns
    -------
    bool — 저장 성공 여부
    """
    conn = _get_conn()
    if conn is None:
        log.debug(
            "route_history: DB 미연결 — 이력 미저장 (type=%s, user=%s)",
            request_type, user_sqno or user_id,
        )
        return False

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_route_history
                        (user_sqno, user_id, recorded_at, request_type,
                         distance_km, safety_score, tourism_score,
                         regions, recommended_pois)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_sqno,
                        user_id,
                        datetime.now(timezone.utc),
                        request_type,
                        distance_km,
                        safety_score,
                        tourism_score,
                        Json(regions or []),
                        Json(recommended_pois or []),
                    ),
                )
        log.info(
            "route_history: 저장 완료 — type=%s, user=%s, dist=%.3f km",
            request_type, user_sqno or user_id, distance_km or 0,
        )
        return True
    except Exception as exc:
        log.error("route_history: 저장 실패 — %s", exc)
        return False
    finally:
        conn.close()
