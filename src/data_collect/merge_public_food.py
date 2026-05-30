import os
import csv
import json
import urllib.request
import urllib.parse
import time

RAW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dataset", "data", "raw_ml")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dataset", "data", "datagokr")

PREMIUM_FILE = os.path.join(RAW_DIR, "premium_food_clean.csv")
FILE_MOBUM = os.path.join(DATA_DIR, "모범음식점정보.csv")
FILE_TOUR = os.path.join(DATA_DIR, "식품_관광식당.csv")
OUT_FILE = os.path.join(RAW_DIR, "premium_food_clean.csv")

def geocode_osm(query: str):
    url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1&countrycodes=kr"
    req = urllib.request.Request(url, headers={'User-Agent': 'KMovementApp/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                if data:
                    doc = data[0]
                    return float(doc["lat"]), float(doc["lon"]), doc.get("display_name")
    except Exception as e:
        print(f"OSM API error for {query}: {e}")
    time.sleep(1.1)  # Rate limiting 1 req/sec
    return None, None, None

def main():
    # 1. Load existing premium foods
    merged_data = []
    if os.path.exists(PREMIUM_FILE):
        with open(PREMIUM_FILE, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # add tag if not present
                if "tag" not in row or not row["tag"]:
                    row["tag"] = "풍자 또간집"
                merged_data.append(row)
    print(f"Loaded {len(merged_data)} existing premium restaurants.")

    # 2. Parse 모범음식점
    mobum_count = 0
    if os.path.exists(FILE_MOBUM):
        print(f"Processing {FILE_MOBUM}...")
        with open(FILE_MOBUM, "r", encoding="cp949", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                dt1 = row.get("지정일자", "").strip()
                dt2 = row.get("재지정일자", "").strip()
                if dt1 >= "2025-12-01" or dt2 >= "2025-12-01":
                    name = row.get("업소명", "").strip()
                    addr = row.get("도로명주소", "").strip()
                    if not addr:
                        addr = row.get("소재지주소", "").strip()
                    if not name or not addr: continue
                    
                    print(f"Geocoding [모범]: {name} - {addr}")
                    lat, lon, new_addr = geocode_osm(addr)
                    if not lat:
                        # try only the dong
                        dong = addr.split()[:3]
                        lat, lon, new_addr = geocode_osm(" ".join(dong) + " " + name)
                    
                    if lat and lon:
                        merged_data.append({
                            "name": name,
                            "search_query": f"{addr} {name}",
                            "address": addr,
                            "lat": lat,
                            "lon": lon,
                            "rating": 4.5,
                            "tag": "모범음식점"
                        })
                        mobum_count += 1
                        print(f"  -> Success: {lat}, {lon}")
                    else:
                        print(f"  -> Failed")

    # 3. Parse 관광식당
    tour_count = 0
    if os.path.exists(FILE_TOUR):
        print(f"Processing {FILE_TOUR}...")
        with open(FILE_TOUR, "r", encoding="cp949", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                dt = row.get("인허가일자", "").strip()
                if dt >= "2025-12-01":
                    name = row.get("사업장명", "").strip()
                    addr = row.get("도로명주소", "").strip()
                    if not addr:
                        addr = row.get("지번주소", "").strip()
                    if not name or not addr: continue
                    
                    print(f"Geocoding [관광]: {name} - {addr}")
                    lat, lon, new_addr = geocode_osm(addr)
                    if lat and lon:
                        merged_data.append({
                            "name": name,
                            "search_query": f"{addr} {name}",
                            "address": addr,
                            "lat": lat,
                            "lon": lon,
                            "rating": 4.5,
                            "tag": "관광식당"
                        })
                        tour_count += 1
                        print(f"  -> Success: {lat}, {lon}")
                    else:
                        print(f"  -> Failed")

    # 4. Save back to CSV
    if merged_data:
        fields = ["name", "search_query", "address", "lat", "lon", "rating", "tag"]
        with open(OUT_FILE, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for row in merged_data:
                # Make sure all fields exist
                clean_row = {k: row.get(k, "") for k in fields}
                writer.writerow(clean_row)
        print(f"\nSaved {len(merged_data)} total restaurants to {OUT_FILE}")
        print(f"(New Mobum: {mobum_count}, New Tour: {tour_count})")

if __name__ == "__main__":
    main()
