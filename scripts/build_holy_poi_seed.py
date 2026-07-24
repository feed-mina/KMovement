# -*- coding: utf-8 -*-
"""kride_db CSV → V90 전국 성지 시드 마이그레이션 생성기.

입력 (dataset/):
  - kride_db_poi.csv        : tmp_poi_id,name,name_en,category,sub_category,sido,sigungu,
                              address,lat,lon,description,source,score,image_url,phone,url,tags,raw_data
  - kride_db_artist_poi.csv : tmp_artist_id,tmp_poi_id,relationship_type,artist_name,poi_name

출력:
  subproject/SDUI/SDUI-server/src/main/resources/db/migration/V90__holy_poi_nationwide_seed.sql

정책:
  - 성지 성격 행만: category ∈ {kculture, kpop} (food/tourism/facility는 TourAPI 실시간과 중복)
  - (name, address) 중복 제거, sido 없는 행 제외
  - source='CRAWL' + review_status='APPROVED' (공공 kcisa_media_2023 출처)
  - content_id='kride-media-{tmp_poi_id}' 로 재실행 안전(DELETE 후 INSERT)
  - sido → TourAPI areaCode 매핑, sigungu 이름은 raw_json에 보존(주소 LIKE 필터용)
  - 대표 아티스트/작품 1개를 tour_poi.artist 에 기록 (연결 수 최다 → 최소 tmp_artist_id)

사용:
  python scripts/build_holy_poi_seed.py
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATASET = REPO_ROOT / "dataset"
OUT_SQL = (
    REPO_ROOT
    / "subproject/SDUI/SDUI-server/src/main/resources/db/migration/V90__holy_poi_nationwide_seed.sql"
)

# TourAPI 표준 시/도 areaCode (TourExploreScreen/TourService 전국 fallback과 동일해야 함)
SIDO_TO_AREA = {
    "서울특별시": "1",
    "인천광역시": "2",
    "대전광역시": "3",
    "대구광역시": "4",
    "광주광역시": "5",
    "부산광역시": "6",
    "울산광역시": "7",
    "세종특별자치시": "8",
    "경기도": "31",
    "강원특별자치도": "32",
    "강원도": "32",
    "충청북도": "33",
    "충청남도": "34",
    "경상북도": "35",
    "경상남도": "36",
    "전북특별자치도": "37",
    "전라북도": "37",
    "전라남도": "38",
    "제주특별자치도": "39",
    "제주도": "39",
}

HOLY_CATEGORIES = {"kculture", "kpop"}
BATCH = 500
MAX_REASON = 500  # tour_poi.recommend_reason varchar(500)
MAX_TITLE = 255
MAX_ADDR = 500
MAX_ARTIST = 120


def q(value: str | None) -> str:
    """SQL 리터럴 이스케이프. None/빈값은 NULL."""
    if value is None:
        return "NULL"
    text = value.replace("\\", "\\\\").replace("'", "''").replace("\r", " ").replace("\n", " ").strip()
    if not text:
        return "NULL"
    return f"E'{text}'" if "\\\\" in text else f"'{text}'"


def clip(value: str, limit: int) -> str:
    value = (value or "").strip()
    return value[:limit]


def main() -> int:
    poi_path = DATASET / "kride_db_poi.csv"
    link_path = DATASET / "kride_db_artist_poi.csv"
    if not poi_path.exists() or not link_path.exists():
        print(f"[ERROR] CSV가 없습니다: {poi_path} / {link_path}")
        return 1

    # 대표 아티스트: poi별 링크 아티스트 중 (빈도 desc, 이름 asc) 첫 항목
    links = defaultdict(Counter)
    with open(link_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            name = (row.get("artist_name") or "").strip()
            poi_id = (row.get("tmp_poi_id") or "").strip()
            if name and poi_id:
                links[poi_id][name] += 1

    rows = []
    skipped = Counter()
    seen: set[tuple[str, str]] = set()
    with open(poi_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            category = (row.get("category") or "").strip()
            if category not in HOLY_CATEGORIES:
                skipped["category"] += 1
                continue
            sido = (row.get("sido") or "").strip()
            area = SIDO_TO_AREA.get(sido)
            if not area:
                skipped["sido"] += 1
                continue
            name = clip(row.get("name") or "", MAX_TITLE)
            if not name:
                skipped["name"] += 1
                continue
            addr = clip(row.get("address") or "", MAX_ADDR)
            dedupe_key = (name, addr)
            if dedupe_key in seen:
                skipped["dup"] += 1
                continue
            seen.add(dedupe_key)
            try:
                lat = float(row["lat"])
                lon = float(row["lon"])
            except (KeyError, TypeError, ValueError):
                skipped["coord"] += 1
                continue
            # 대한민국 좌표 범위 밖은 배제 (HolySubmission 검증과 동일 기준)
            if not (124 <= lon <= 132 and 33 <= lat <= 39):
                skipped["coord_range"] += 1
                continue

            tmp_id = (row.get("tmp_poi_id") or "").strip()
            artist = None
            if links.get(tmp_id):
                counter = links[tmp_id]
                artist = clip(sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))[0][0], MAX_ARTIST)

            raw = {
                "dataset": "kcisa_media_2023",
                "tmp_poi_id": tmp_id,
                "category": category,
                "sub_category": (row.get("sub_category") or "").strip(),
                "sido": sido,
                "sigungu": (row.get("sigungu") or "").strip(),
            }
            rows.append(
                {
                    "content_id": f"kride-media-{tmp_id}",
                    "title": name,
                    "addr": addr or None,
                    "lon": lon,
                    "lat": lat,
                    "image": (row.get("image_url") or "").strip() or None,
                    "area": area,
                    "artist": artist,
                    "reason": clip(row.get("description") or "", MAX_REASON) or None,
                    "raw": json.dumps(raw, ensure_ascii=False),
                }
            )

    rows.sort(key=lambda r: int(r["content_id"].rsplit("-", 1)[1]))
    print(f"[INFO] import rows: {len(rows)}, skipped: {dict(skipped)}")

    lines: list[str] = []
    lines.append("-- V90: 전국 성지(K-컬처 촬영지·연고지) 시드 — kcisa_media_2023 (kride_db CSV).")
    lines.append("-- 생성기: scripts/build_holy_poi_seed.py (수동 편집 금지, 재생성으로 갱신)")
    lines.append(f"-- 행 수: {len(rows)} (kculture/kpop만; 맛집·관광지·문화시설은 TourAPI 실시간 사용)")
    lines.append("")
    lines.append("DELETE FROM tour_poi WHERE content_id LIKE 'kride-media-%';")
    lines.append("")
    for start in range(0, len(rows), BATCH):
        batch = rows[start : start + BATCH]
        lines.append(
            "INSERT INTO tour_poi (content_id, content_type_id, source, title, addr, map_x, map_y,"
        )
        lines.append("    first_image, area_code, artist, recommend_reason, review_status, raw_json) VALUES")
        values = []
        for r in batch:
            values.append(
                "({cid}, 'HOLY', 'CRAWL', {title}, {addr}, {lon}, {lat}, {img}, {area}, {artist}, {reason}, 'APPROVED', {raw}::jsonb)".format(
                    cid=q(r["content_id"]),
                    title=q(r["title"]),
                    addr=q(r["addr"]),
                    lon=r["lon"],
                    lat=r["lat"],
                    img=q(r["image"]),
                    area=q(r["area"]),
                    artist=q(r["artist"]),
                    reason=q(r["reason"]),
                    raw=q(r["raw"]),
                )
            )
        lines.append(",\n".join(values) + ";")
        lines.append("")

    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"[INFO] wrote {OUT_SQL} ({OUT_SQL.stat().st_size / 1024 / 1024:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
