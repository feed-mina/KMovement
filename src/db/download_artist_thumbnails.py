"""
download_artist_thumbnails.py
==============================
dearu/lysn 스토어에서 크롤링한 아티스트 썸네일 이미지를 다운로드하고
아티스트 이름으로 저장.

[ 실행 ]
  python src/db/download_artist_thumbnails.py

[ 출력 ]
  public/artists/ 폴더에 아티스트별 이미지 저장
  예: public/artists/EXO.jpg, public/artists/TWICE.jpg
"""
import os
import json
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "artists")
THUMBNAILS_JSON = os.path.join(PROJECT_ROOT, ".ai", "memo", "artist_thumbnails.json")

# ── 매칭된 아티스트 썸네일 URL ──
ARTIST_IMAGES = {
    # LYSN (SM Entertainment)
    "SUPER JUNIOR": "https://store-cn.lysn.com/public/img/product/PRO1589865689hvVgu/STVgu1589865689679.jpg",
    "EXO":          "https://store-cn.lysn.com/public/img/product/PRO1587721381w9V3v/STV3v1607911514770.jpg",
    "TVXQ":         "https://store-cn.lysn.com/public/img/product/PRO1596011113n2laM/STlaM1596791863397.jpg",
    "SHINee":       "https://store-cn.lysn.com/public/img/product/PRO1589940076cQo8H/STo8H1589940076662.jpg",
    "Girls' Generation": "https://store-cn.lysn.com/public/img/product/PRO1587717515ydXem/STXem1588587777836.jpg",
    "Red Velvet":   "https://store-cn.lysn.com/public/img/product/PRO1580346800D9DBP/STDBP1588587845150.jpg",
    "NCT":          "https://store-cn.lysn.com/public/img/product/PRO1580350258uj25G/ST25G1607047701824.jpg",
    # JYP Entertainment
    "TWICE":        "https://ba-store-cn.dear-u.co/public/img/product/PRO1618902314Kylgd/STlgd1759389877157.jpg",
    "ITZY":         "https://ba-store-cn.dear-u.co/public/img/product/PRO1618997731yukOw/STkOw1750810499663.jpg",
    "Stray Kids":   "https://ba-store-cn.dear-u.co/public/img/product/PRO1604977258J1gns/STgns1750815587902.jpg",
    # STARSHIP
    "IVE":          "https://ba-store-cn.dear-u.co/public/img/product/PRO1675932868fgWYB/STWYB1675932868685.jpg",
}

# 미매칭 아티스트 (HYBE/YG/독립): BTS, BLACKPINK, SEVENTEEN, TXT, IU, OH MY GIRL, BTOB, Apink, MAMAMOO
# → 별도 이미지 소스 필요


def download():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output: {OUTPUT_DIR}")
    print(f"Artists: {len(ARTIST_IMAGES)}")
    print()

    success = 0
    fail = 0

    for name, url in ARTIST_IMAGES.items():
        ext = url.rsplit(".", 1)[-1][:4]  # jpg or png
        filename = f"{name}.{ext}"
        filepath = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(filepath):
            print(f"  [SKIP] {filename} (already exists)")
            success += 1
            continue

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            with open(filepath, "wb") as f:
                f.write(data)
            size_kb = len(data) / 1024
            print(f"  [OK]   {filename} ({size_kb:.1f} KB)")
            success += 1
        except Exception as e:
            print(f"  [FAIL] {filename}: {e}")
            fail += 1

    print(f"\nDone: {success} success, {fail} fail")
    print(f"Files at: {OUTPUT_DIR}")


if __name__ == "__main__":
    download()
