# -*- coding: utf-8 -*-
"""kride_db CSV → V91 작품/아티스트 카탈로그 + 성지 링크 마이그레이션 생성기.

입력 (dataset/):
  - kride_db_artist.csv     : tmp_artist_id,name,name_en,category(kpop|drama|movie|show)
  - kride_db_artist_poi.csv : tmp_artist_id,tmp_poi_id,relationship_type,artist_name,poi_name

출력:
  subproject/SDUI/SDUI-server/src/main/resources/db/migration/V91__holy_content_links.sql

정책:
  - V90 으로 임포트된 POI(content_id='kride-media-*')에 연결되는 링크만 유효
    (JOIN 으로 자연 필터링 — 미임포트 food/tourism POI 링크는 자동 제외)
  - 카탈로그는 유효 링크가 1개 이상인 작품/아티스트만 시드 (선택지 노이즈 방지)
  - holy_content.source_ref='kride-artist-{tmp_artist_id}' 로 재실행 안전

사용:
  python scripts/build_holy_content_seed.py   # V90 생성기 실행 후에 돌릴 것
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATASET = REPO_ROOT / "dataset"
V90_SQL = (
    REPO_ROOT
    / "subproject/SDUI/SDUI-server/src/main/resources/db/migration/V90__holy_poi_nationwide_seed.sql"
)
OUT_SQL = (
    REPO_ROOT
    / "subproject/SDUI/SDUI-server/src/main/resources/db/migration/V91__holy_content_links.sql"
)

VALID_CATEGORIES = {"kpop", "drama", "movie", "show"}
BATCH = 500


def q(value: str | None) -> str:
    if value is None:
        return "NULL"
    text = value.replace("'", "''").replace("\r", " ").replace("\n", " ").strip()
    return f"'{text}'" if text else "NULL"


def main() -> int:
    artist_path = DATASET / "kride_db_artist.csv"
    link_path = DATASET / "kride_db_artist_poi.csv"
    if not artist_path.exists() or not link_path.exists():
        print(f"[ERROR] CSV가 없습니다: {artist_path} / {link_path}")
        return 1
    if not V90_SQL.exists():
        print(f"[ERROR] V90 시드가 없습니다. build_holy_poi_seed.py 를 먼저 실행하세요.")
        return 1

    # V90에 실제로 들어간 POI id 집합 (링크 유효성 사전 필터 — 통계/파일 크기용;
    # 마이그레이션의 JOIN이 최종 안전망이다)
    imported_pois: set[str] = set()
    for line in V90_SQL.read_text(encoding="utf-8").splitlines():
        idx = 0
        while True:
            idx = line.find("'kride-media-", idx)
            if idx == -1:
                break
            end = line.find("'", idx + 1)
            imported_pois.add(line[idx + 1 : end])
            idx = end + 1
    print(f"[INFO] V90 imported POIs: {len(imported_pois)}")

    artists: dict[str, dict] = {}
    with open(artist_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            tmp_id = (row.get("tmp_artist_id") or "").strip()
            name = (row.get("name") or "").strip()
            category = (row.get("category") or "").strip()
            if not tmp_id or not name:
                continue
            if category not in VALID_CATEGORIES:
                category = "drama"
            artists[tmp_id] = {
                "ref": f"kride-artist-{tmp_id}",
                "name": name[:200],
                "name_en": (row.get("name_en") or "").strip()[:200] or None,
                "category": category,
            }

    links: list[tuple[str, str, str]] = []  # (content_ref, poi_ref, relationship)
    seen_links: set[tuple[str, str]] = set()
    dropped = 0
    with open(link_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            artist_id = (row.get("tmp_artist_id") or "").strip()
            poi_id = (row.get("tmp_poi_id") or "").strip()
            if artist_id not in artists:
                dropped += 1
                continue
            poi_ref = f"kride-media-{poi_id}"
            if poi_ref not in imported_pois:
                dropped += 1
                continue
            key = (artist_id, poi_id)
            if key in seen_links:
                continue
            seen_links.add(key)
            rel = (row.get("relationship_type") or "").strip()[:40] or None
            links.append((artists[artist_id]["ref"], poi_ref, rel))

    used_artist_refs = {content_ref for content_ref, _, _ in links}
    catalog = [a for a in artists.values() if a["ref"] in used_artist_refs]
    catalog.sort(key=lambda a: int(a["ref"].rsplit("-", 1)[1]))
    links.sort(key=lambda l: (int(l[0].rsplit("-", 1)[1]), int(l[1].rsplit("-", 1)[1])))
    print(f"[INFO] catalog: {len(catalog)}, links: {len(links)}, dropped(link): {dropped}")

    lines: list[str] = []
    lines.append("-- V91: 작품/아티스트 카탈로그(holy_content) + 성지 링크(holy_content_poi).")
    lines.append("-- 생성기: scripts/build_holy_content_seed.py (수동 편집 금지, 재생성으로 갱신)")
    lines.append(f"-- 카탈로그 {len(catalog)}건 / 링크 {len(links)}건 — V90 임포트 POI에 연결된 것만.")
    lines.append("")
    lines.append("CREATE TABLE IF NOT EXISTS holy_content (")
    lines.append("    content_sqno BIGSERIAL PRIMARY KEY,")
    lines.append("    source_ref   VARCHAR(40) UNIQUE NOT NULL,  -- 'kride-artist-{tmp_artist_id}'")
    lines.append("    name         VARCHAR(200) NOT NULL,")
    lines.append("    name_en      VARCHAR(200),")
    lines.append("    category     VARCHAR(20) NOT NULL,         -- kpop | drama | movie | show")
    lines.append("    created_at   TIMESTAMP NOT NULL DEFAULT NOW()")
    lines.append(");")
    lines.append("")
    lines.append("CREATE TABLE IF NOT EXISTS holy_content_poi (")
    lines.append("    link_id      BIGSERIAL PRIMARY KEY,")
    lines.append("    content_sqno BIGINT NOT NULL REFERENCES holy_content(content_sqno) ON DELETE CASCADE,")
    lines.append("    poi_sqno     BIGINT NOT NULL REFERENCES tour_poi(poi_sqno) ON DELETE CASCADE,")
    lines.append("    relationship VARCHAR(40),")
    lines.append("    CONSTRAINT uk_holy_content_poi UNIQUE (content_sqno, poi_sqno)")
    lines.append(");")
    lines.append("")
    lines.append("CREATE INDEX IF NOT EXISTS idx_holy_content_poi_content ON holy_content_poi(content_sqno);")
    lines.append("CREATE INDEX IF NOT EXISTS idx_holy_content_poi_poi ON holy_content_poi(poi_sqno);")
    lines.append("CREATE INDEX IF NOT EXISTS idx_holy_content_name ON holy_content(name);")
    lines.append("")
    lines.append("-- 재실행 안전: 링크 → 카탈로그 순서로 비운다.")
    lines.append("DELETE FROM holy_content_poi;")
    lines.append("DELETE FROM holy_content WHERE source_ref LIKE 'kride-artist-%';")
    lines.append("")

    for start in range(0, len(catalog), BATCH):
        batch = catalog[start : start + BATCH]
        lines.append("INSERT INTO holy_content (source_ref, name, name_en, category) VALUES")
        values = [
            f"({q(a['ref'])}, {q(a['name'])}, {q(a['name_en'])}, {q(a['category'])})"
            for a in batch
        ]
        lines.append(",\n".join(values) + ";")
        lines.append("")

    for start in range(0, len(links), BATCH):
        batch = links[start : start + BATCH]
        lines.append("INSERT INTO holy_content_poi (content_sqno, poi_sqno, relationship)")
        lines.append("SELECT c.content_sqno, p.poi_sqno, v.rel")
        lines.append("FROM (VALUES")
        values = [f"({q(cref)}, {q(pref)}, {q(rel)})" for cref, pref, rel in batch]
        lines.append(",\n".join(values))
        lines.append(") AS v(cref, pref, rel)")
        lines.append("JOIN holy_content c ON c.source_ref = v.cref")
        lines.append("JOIN tour_poi p ON p.content_id = v.pref")
        lines.append("ON CONFLICT ON CONSTRAINT uk_holy_content_poi DO NOTHING;")
        lines.append("")

    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"[INFO] wrote {OUT_SQL} ({OUT_SQL.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
