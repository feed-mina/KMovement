"""
load_kcisa_kpop_data.py
=======================
kcisa_media_locations_2023.csv에서 K-pop 아티스트 20명 + 관련 POI를
PostgreSQL (artist, poi, artist_poi)에 적재.

INTRO2에 표시할 20명만 필터링하여 적재.
CSV에 위도/경도가 이미 포함되어 있으므로 지오코딩 불필요.

[ 실행 ]
  python src/db/load_kcisa_kpop_data.py
"""
import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")

CSV_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "dataset", "source", "kculture_media", "kcisa_media_locations_2023.csv",
)

# ── INTRO2에 표시할 K-pop 아티스트 20명 ──────────────────────────────
# kcisa CSV 한글명 → INTRO2 표시용 영문명
KPOP_ARTIST_MAP = {
    "방탄소년단":   "BTS",
    "블랙핑크":     "BLACKPINK",
    "세븐틴":       "SEVENTEEN",
    "슈퍼주니어":   "SUPER JUNIOR",
    "트와이스":     "TWICE",
    "동방신기":     "TVXQ",
    "BTOB":         "BTOB",
    "소녀시대":     "Girls' Generation",
    "엑소":         "EXO",
    "레드벨벳":     "Red Velvet",
    "NCT":          "NCT",
    "에이핑크":     "Apink",
    "오마이걸":     "OH MY GIRL",
    "샤이니":       "SHINee",
    "마마무":       "MAMAMOO",
    "아이유":       "IU",
    "TXT":          "TXT",
    "스트레이키즈": "Stray Kids",
    "Itzy":         "ITZY",
    "아이브":       "IVE",
}


def load_data():
    csv_path = os.path.normpath(CSV_PATH)
    print(f"Reading CSV: {csv_path}")
    df = pd.read_csv(csv_path, encoding="utf-8")
    print(f"Total rows: {len(df)}")

    # INTRO2 아티스트 20명만 필터링
    target_names = set(KPOP_ARTIST_MAP.keys())
    df_filtered = df[df["아티스트"].isin(target_names)].copy()
    print(f"Filtered rows (20 artists): {len(df_filtered)}")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # ── 1. Artist 적재 ──────────────────────────────────────────────
    artist_map = {}  # kcisa 한글명 → DB artist.id
    for kcisa_name, en_name in KPOP_ARTIST_MAP.items():
        cur.execute("SELECT id FROM artist WHERE name = %s", (kcisa_name,))
        res = cur.fetchone()
        if not res:
            cur.execute(
                "INSERT INTO artist (name, name_en, category) VALUES (%s, %s, %s) RETURNING id",
                (kcisa_name, en_name, "kpop"),
            )
            artist_id = cur.fetchone()[0]
            print(f"  + artist: {kcisa_name} ({en_name}) → id={artist_id}")
        else:
            artist_id = res[0]
            print(f"  = artist exists: {kcisa_name} → id={artist_id}")
        artist_map[kcisa_name] = artist_id

    # ── 2. POI 적재 ────────────────────────────────────────────────
    poi_map = {}  # (장소명, 주소) → DB poi.id
    unique_places = df_filtered.drop_duplicates(subset=["장소명", "주소"])
    print(f"\nProcessing {len(unique_places)} unique POIs...")

    for _, row in unique_places.iterrows():
        place_name = str(row["장소명"]).strip()
        address = str(row.get("주소", "")).strip()
        key = (place_name, address)

        # 이미 처리한 POI
        if key in poi_map:
            continue

        # DB에 있는지 확인 (이름+주소)
        cur.execute(
            "SELECT id FROM poi WHERE name = %s AND address = %s LIMIT 1",
            (place_name, address),
        )
        res = cur.fetchone()
        if res:
            poi_map[key] = res[0]
            continue

        # 이름만으로도 확인
        cur.execute("SELECT id FROM poi WHERE name = %s LIMIT 1", (place_name,))
        res = cur.fetchone()
        if res:
            poi_map[key] = res[0]
            continue

        # 신규 POI 삽입 (CSV에 위도/경도 포함)
        lat = row.get("위도")
        lon = row.get("경도")
        place_type = str(row.get("장소타입", "")).strip()
        description = str(row.get("장소설명", "")).strip()

        has_coords = pd.notna(lat) and pd.notna(lon)
        if has_coords:
            cur.execute(
                """
                INSERT INTO poi (name, category, address, geom, source)
                VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
                RETURNING id
                """,
                (place_name, "kpop", address, float(lon), float(lat), "kcisa_2023"),
            )
        else:
            cur.execute(
                """
                INSERT INTO poi (name, category, address, source)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (place_name, "kpop", address, "kcisa_2023"),
            )

        poi_map[key] = cur.fetchone()[0]

    print(f"POI total: {len(poi_map)}")

    # ── 3. Artist ↔ POI 연결 ───────────────────────────────────────
    link_count = 0
    for _, row in df_filtered.iterrows():
        kcisa_name = row["아티스트"]
        place_name = str(row["장소명"]).strip()
        address = str(row.get("주소", "")).strip()
        key = (place_name, address)

        if kcisa_name in artist_map and key in poi_map:
            cur.execute(
                """
                INSERT INTO artist_poi (artist_id, poi_id, relationship_type)
                VALUES (%s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (artist_map[kcisa_name], poi_map[key], "FILMING_AT"),
            )
            link_count += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone! Artists: {len(artist_map)}, POIs: {len(poi_map)}, Links: {link_count}")
    print("\nNext steps:")
    print("  1. python src/graph/kride_graph_builder.py   (그래프 재빌드)")
    print("  2. 노드마이그레이션.py 실행 (Colab)          (Neo4j + Supabase 적재)")
    print("  3. INTRO2 query_master 업데이트              (아티스트 20개 표시)")


if __name__ == "__main__":
    load_data()
