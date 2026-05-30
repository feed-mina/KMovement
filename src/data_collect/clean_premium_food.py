import os
import json
import csv
import urllib.request
import urllib.parse
import time

RAW_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dataset", "data", "raw_ml", "premium_food_geocoded.csv")
OUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dataset", "data", "raw_ml", "premium_food_clean.csv")

def geocode_osm(query: str):
    # Search query in OSM
    url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&limit=1"
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
    time.sleep(1)  # Rate limiting
    return None, None, None

def main():
    if not os.path.exists(RAW_FILE):
        print(f"File not found: {RAW_FILE}")
        return

    cleaned_data = []
    
    with open(RAW_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i < 106:  # Skip headers and youtube titles
                continue
            
            if len(row) < 6:
                continue
                
            name, search_query, sub_category, address_raw, lat, lon = row[:6]
            
            if sub_category != "또간집":
                continue
                
            if "EP." in address_raw or name == address_raw or not search_query.strip():
                continue
                
            if name == "realmusic.qshop.ai" or "드럼레슨" in search_query:
                continue

            lat = lat.strip()
            lon = lon.strip()
            
            # Geocode if missing
            if not lat or not lon:
                print(f"Geocoding: {search_query}...")
                new_lat, new_lon, new_addr = geocode_osm(search_query)
                if new_lat and new_lon:
                    lat, lon = str(new_lat), str(new_lon)
                    if new_addr:
                        address_raw = new_addr
                    print(f"  -> Success: {lat}, {lon}")
                else:
                    # fallback: try just the name
                    new_lat, new_lon, new_addr = geocode_osm(name)
                    if new_lat and new_lon:
                        lat, lon = str(new_lat), str(new_lon)
                        print(f"  -> Success (name fallback): {lat}, {lon}")
                    else:
                        print(f"  -> Failed")
            
            if lat and lon:
                cleaned_data.append({
                    "name": name,
                    "search_query": search_query,
                    "address": address_raw,
                    "lat": float(lat),
                    "lon": float(lon),
                    "rating": 4.8  # Default premium rating
                })
                
    # Write to clean file
    with open(OUT_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "search_query", "address", "lat", "lon", "rating"])
        writer.writeheader()
        writer.writerows(cleaned_data)
        
    print(f"\nSaved {len(cleaned_data)} premium restaurants to {OUT_FILE}")

if __name__ == "__main__":
    main()
