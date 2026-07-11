#!/usr/bin/env python3
"""성지 POI 후보 정제 파이프라인 — Epic #74 · Dev-4(#96-A) 2차.

후보 CSV → 검증·정규화(선택적 LLM 다듬기) → 검수 대기(PENDING) INSERT SQL 생성.
DB에 직접 쓰지 않고 SQL 파일을 만들어 사람이 확인 후 적용한다(감사 가능·안전).

사용법:
    python refine_candidates.py candidates.csv                # 검증+SQL 생성
    python refine_candidates.py candidates.csv --llm          # + LLM 문구 다듬기(OPENAI_API_KEY 필요)
    python refine_candidates.py candidates.csv -o out.sql     # 출력 경로 지정

CSV 컬럼(헤더 필수):
    title, artist, addr, map_x, map_y, fandom_info, recommend_reason, source_url[, content_id]

저작권 기준(.ai/0711_holy_poi_pipeline_plan.md §⑤):
    - 공개된 사실 정보만(장소명·주소·좌표·촬영지라는 사실). 기사 본문/사진 복제 금지
    - source_url 필수 — 출처 없는 행은 거부된다
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import unicodedata
import urllib.request

# 대한민국 대략 경계(좌표 sanity check)
KOREA_LNG = (124.0, 132.0)
KOREA_LAT = (33.0, 39.5)

MAX_LEN = {"artist": 120, "fandom_info": 255, "recommend_reason": 500, "title": 255, "addr": 500}

REQUIRED = ("title", "source_url", "map_x", "map_y")


def slugify(title: str) -> str:
    """title → content_id 슬러그 (한글 유지, 공백/특수문자 → 하이픈)."""
    s = unicodedata.normalize("NFKC", title).strip().lower()
    s = re.sub(r"[^\w가-힣]+", "-", s).strip("-")
    return f"holy-{s[:40]}"


def sql_quote(v: str | None) -> str:
    if v is None or v == "":
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def validate(row: dict, line_no: int, errors: list[str]) -> dict | None:
    """필수값·좌표·길이 검증. 실패 시 errors에 사유 축적하고 None."""
    missing = [c for c in REQUIRED if not (row.get(c) or "").strip()]
    if missing:
        errors.append(f"{line_no}행: 필수 컬럼 누락 {missing} (source_url 없는 성지는 받지 않는다)")
        return None
    try:
        lng, lat = float(row["map_x"]), float(row["map_y"])
    except ValueError:
        errors.append(f"{line_no}행: 좌표가 숫자가 아님 map_x={row['map_x']} map_y={row['map_y']}")
        return None
    if not (KOREA_LNG[0] <= lng <= KOREA_LNG[1] and KOREA_LAT[0] <= lat <= KOREA_LAT[1]):
        errors.append(f"{line_no}행: 좌표가 한국 범위를 벗어남 ({lng}, {lat}) — 경위도 뒤바뀜 의심")
        return None
    out = {k: (row.get(k) or "").strip() for k in
           ("title", "artist", "addr", "fandom_info", "recommend_reason", "source_url", "content_id")}
    out["map_x"], out["map_y"] = lng, lat
    for col, limit in MAX_LEN.items():
        if len(out.get(col, "")) > limit:
            errors.append(f"{line_no}행: {col} 길이 초과({len(out[col])} > {limit})")
            return None
    if not out["content_id"]:
        out["content_id"] = slugify(out["title"])
    return out


def llm_polish(rows: list[dict]) -> None:
    """선택: OpenAI로 fandom_info/recommend_reason 문구만 다듬는다(사실 추가 금지)."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("[llm] OPENAI_API_KEY 미설정 — 다듬기 생략", file=sys.stderr)
        return
    for row in rows:
        prompt = (
            "다음 K-컬처 성지 정보의 fandom_info(255자 이내)와 recommend_reason(500자 이내)을 "
            "자연스러운 한국어 한 문장씩으로 다듬어 JSON으로만 답하라. "
            "주어진 사실 외 내용을 추가하지 말 것.\n"
            f"입력: {json.dumps({k: row[k] for k in ('title', 'artist', 'fandom_info', 'recommend_reason')}, ensure_ascii=False)}"
        )
        body = json.dumps({
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions", data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            polished = json.loads(data["choices"][0]["message"]["content"])
            for col in ("fandom_info", "recommend_reason"):
                v = (polished.get(col) or "").strip()
                if v and len(v) <= MAX_LEN[col]:
                    row[col] = v
        except Exception as e:  # noqa: BLE001 — 개별 실패는 원문 유지하고 계속
            print(f"[llm] '{row['title']}' 다듬기 실패({e}) — 원문 유지", file=sys.stderr)


def to_sql(rows: list[dict]) -> str:
    header = (
        "-- 성지 POI 후보 → 검수 대기(PENDING) 투입 SQL\n"
        f"-- 생성: {dt.datetime.now().isoformat(timespec='seconds')} · scripts/holy_pipeline/refine_candidates.py\n"
        "-- 적용 후 어드민 검수(POST /api/admin/tour/holy/{poiSqno}/review)로 APPROVE/REJECT.\n"
        "-- content_id 유니크 인덱스로 재실행 멱등.\n\n"
    )
    values = ",\n".join(
        "  ({cid}, 'HOLY', 'CRAWL', {title}, {addr}, {lng}, {lat}, '1', {artist}, {fi}, {rr}, {src}, 'PENDING')".format(
            cid=sql_quote(r["content_id"]), title=sql_quote(r["title"]), addr=sql_quote(r["addr"]),
            lng=r["map_x"], lat=r["map_y"], artist=sql_quote(r["artist"]),
            fi=sql_quote(r["fandom_info"]), rr=sql_quote(r["recommend_reason"]), src=sql_quote(r["source_url"]))
        for r in rows)
    return (header
            + "INSERT INTO tour_poi (content_id, content_type_id, source, title, addr, map_x, map_y,\n"
            + "                      area_code, artist, fandom_info, recommend_reason, source_url, review_status)\nVALUES\n"
            + values
            + "\nON CONFLICT (content_id) WHERE content_id IS NOT NULL DO NOTHING;\n")


def main() -> int:
    ap = argparse.ArgumentParser(description="성지 POI 후보 정제 → PENDING INSERT SQL")
    ap.add_argument("csv_path")
    ap.add_argument("-o", "--output", default=None, help="출력 SQL 경로(기본: holy_pending_YYYYMMDD.sql)")
    ap.add_argument("--llm", action="store_true", help="OpenAI로 문구 다듬기(OPENAI_API_KEY 필요)")
    args = ap.parse_args()

    errors: list[str] = []
    rows: list[dict] = []
    seen: set[str] = set()
    with open(args.csv_path, newline="", encoding="utf-8-sig") as f:
        for i, raw in enumerate(csv.DictReader(f), start=2):
            row = validate(raw, i, errors)
            if row is None:
                continue
            if row["content_id"] in seen:
                errors.append(f"{i}행: content_id 중복 '{row['content_id']}'")
                continue
            seen.add(row["content_id"])
            rows.append(row)

    for e in errors:
        print(f"[거부] {e}", file=sys.stderr)
    if not rows:
        print("유효한 후보가 없습니다.", file=sys.stderr)
        return 1

    if args.llm:
        llm_polish(rows)

    out_path = args.output or f"holy_pending_{dt.date.today():%Y%m%d}.sql"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(to_sql(rows))
    print(f"완료: {len(rows)}건 → {out_path} (거부 {len(errors)}건)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
