"""
crawl_artist_thumbnails.py
===========================
Playwright로 Weverse + dearu/lysn 스토어에서 아티스트 썸네일을 크롤링하여
INTRO2 아티스트 20명과 자동 매칭 후 public/artists/ 에 저장.

[ 사전 설치 ]
  pip install playwright
  playwright install chromium

[ 실행 ]
  python src/db/crawl_artist_thumbnails.py

[ 출력 ]
  public/artists/{ARTIST_NAME}.jpg
  .ai/memo/artist_thumbnails_result.json  (매칭 결과)
"""
import asyncio
import json
import os
import re
import urllib.request
from difflib import SequenceMatcher

# ── INTRO2 아티스트 20명 ──
TARGET_ARTISTS = {
    "BTS": ["BTS", "방탄소년단", "BANGTAN", "防弾少年団"],
    "BLACKPINK": ["BLACKPINK", "블랙핑크"],
    "SEVENTEEN": ["SEVENTEEN", "세븐틴", "SVT"],
    "SUPER JUNIOR": ["SUPER JUNIOR", "슈퍼주니어", "SJ", "SUJU"],
    "TWICE": ["TWICE", "트와이스"],
    "TVXQ": ["TVXQ", "TVXQ!", "동방신기", "東方神起"],
    "BTOB": ["BTOB", "비투비"],
    "Girls' Generation": ["GIRLS' GENERATION", "소녀시대", "SNSD", "GG"],
    "EXO": ["EXO", "엑소"],
    "Red Velvet": ["RED VELVET", "레드벨벳", "RV"],
    "NCT": ["NCT", "NCT 127", "NCT DREAM", "엔시티"],
    "Apink": ["APINK", "에이핑크", "A PINK"],
    "OH MY GIRL": ["OH MY GIRL", "오마이걸", "OMG"],
    "SHINee": ["SHINEE", "샤이니"],
    "MAMAMOO": ["MAMAMOO", "마마무"],
    "IU": ["IU", "아이유", "李知恩"],
    "TXT": ["TXT", "TOMORROW X TOGETHER", "투모로우바이투게더"],
    "Stray Kids": ["STRAY KIDS", "스트레이키즈", "SKZ"],
    "ITZY": ["ITZY", "있지"],
    "IVE": ["IVE", "아이브"],
}

# ── 크롤링 대상 URL ──
CRAWL_SOURCES = [
    {
        "name": "Weverse",
        "url": "https://weverse.io/",
        "selector": "span.avatar-_-image_wrap img, span[class*='avatar-_-image'] img",
        "name_strategy": "weverse",
    },
    {
        "name": "LYSN",
        "url": "https://webstore.lysn.com/LYSN/home?lang=ko&currency=KRW",
        "selector": "div.thumbnail img, .thumbnail img",
        "name_strategy": "dearu",
    },
    {
        "name": "JYP",
        "url": "https://store.dearu.com/JYP/home?lang=ko&currency=KRW",
        "selector": "div.thumbnail img, .thumbnail img",
        "name_strategy": "dearu",
    },
    {
        "name": "STARS",
        "url": "https://store.dearu.com/STARS/home?lang=ko&currency=KRW",
        "selector": "div.thumbnail img, .thumbnail img",
        "name_strategy": "dearu",
    },
    {
        "name": "STARSHIP",
        "url": "https://store.dearu.com/STARSHIP/home?lang=ko&currency=KRW",
        "selector": "div.thumbnail img, .thumbnail img",
        "name_strategy": "dearu",
    },
    {
        "name": "CUBE",
        "url": "https://store.dearu.com/CUBE/home?lang=ko&currency=KRW",
        "selector": "div.thumbnail img, .thumbnail img",
        "name_strategy": "dearu",
    },
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, "..", ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "artists")
RESULT_JSON = os.path.join(PROJECT_ROOT, ".ai", "memo", "artist_thumbnails_result.json")


def normalize(name: str) -> str:
    """이름 정규화: 대문자 + 공백/특수문자 제거"""
    return re.sub(r"[^A-Z0-9가-힣]", "", name.upper())


def match_artist(found_name: str) -> str | None:
    """발견된 이름이 TARGET_ARTISTS의 어느 아티스트에 해당하는지 매칭"""
    norm = normalize(found_name)

    # 1. 정확 매칭
    for artist, aliases in TARGET_ARTISTS.items():
        for alias in aliases:
            if normalize(alias) == norm:
                return artist

    # 2. 포함 매칭 (found_name이 alias를 포함하거나, alias가 found_name을 포함)
    for artist, aliases in TARGET_ARTISTS.items():
        for alias in aliases:
            na = normalize(alias)
            if na in norm or norm in na:
                if len(na) >= 2 and len(norm) >= 2:  # 너무 짧은 매칭 방지
                    return artist

    # 3. 유사도 매칭 (80% 이상)
    for artist, aliases in TARGET_ARTISTS.items():
        for alias in aliases:
            ratio = SequenceMatcher(None, normalize(alias), norm).ratio()
            if ratio >= 0.8:
                return artist

    return None


async def crawl_source(page, source: dict) -> list[dict]:
    """단일 소스에서 아티스트 이름 + 이미지 URL 추출"""
    results = []
    name = source["name"]
    url = source["url"]

    print(f"\n{'='*50}")
    print(f"[{name}] {url}")
    print(f"{'='*50}")

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        # SPA 렌더링 대기
        await page.wait_for_timeout(3000)

        # 스크롤하여 lazy-load 이미지 로드
        for _ in range(5):
            await page.evaluate("window.scrollBy(0, window.innerHeight)")
            await page.wait_for_timeout(800)
        # 맨 위로
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(500)

        if source["name_strategy"] == "weverse":
            results = await _extract_weverse(page)
        elif source["name_strategy"] == "dearu":
            results = await _extract_dearu(page, source["selector"])

        print(f"  Found {len(results)} items")

    except Exception as e:
        print(f"  [ERROR] {e}")

    return results


async def _extract_weverse(page) -> list[dict]:
    """Weverse: avatar 이미지 + 근처 텍스트에서 아티스트명 추출"""
    items = []

    # 방법 1: avatar 이미지의 부모/형제에서 이름 찾기
    entries = await page.evaluate("""() => {
        const results = [];

        // avatar 이미지 찾기
        const imgs = document.querySelectorAll(
            'span[class*="avatar"] img, ' +
            'img[class*="avatar"]'
        );

        imgs.forEach(img => {
            const src = img.src || img.getAttribute('src') || '';
            if (!src || src.includes('data:')) return;

            // 부모 요소들을 순회하며 텍스트 찾기
            let name = '';
            let el = img.closest('a') || img.closest('li') || img.closest('div');

            // 인접 요소 탐색 (최대 5레벨 상위까지)
            let parent = img.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                // 형제 요소에서 텍스트 찾기
                const siblings = parent.querySelectorAll(
                    'strong, h3, h4, p, span[class*="name"], span[class*="title"], ' +
                    'div[class*="name"], div[class*="title"]'
                );
                for (const sib of siblings) {
                    const text = sib.textContent?.trim();
                    if (text && text.length > 0 && text.length < 50 && text !== '') {
                        name = text;
                        break;
                    }
                }
                if (name) break;

                // 부모의 텍스트 직접 확인
                const directText = Array.from(parent.childNodes)
                    .filter(n => n.nodeType === 3)
                    .map(n => n.textContent?.trim())
                    .filter(t => t && t.length > 0 && t.length < 50)
                    .join('');
                if (directText) {
                    name = directText;
                    break;
                }

                parent = parent.parentElement;
            }

            // alt 속성 확인
            if (!name) {
                name = img.alt || '';
            }

            if (src) {
                results.push({ name: name, image_url: src });
            }
        });

        return results;
    }""")

    for entry in entries:
        items.append({
            "name": entry["name"],
            "image_url": entry["image_url"],
            "source": "Weverse",
        })

    return items


async def _extract_dearu(page, selector: str) -> list[dict]:
    """dearu/lysn: thumbnail 이미지 + 인접 strong/이름 추출"""
    items = []

    entries = await page.evaluate("""(selector) => {
        const results = [];
        const imgs = document.querySelectorAll(selector);

        imgs.forEach(img => {
            const src = img.src || img.getAttribute('src') || '';
            if (!src || src.includes('data:')) return;

            // 부모 a 태그나 li에서 이름 찾기
            let name = '';
            const container = img.closest('a') || img.closest('li') || img.closest('div');

            if (container) {
                // strong 태그 (가장 흔한 패턴)
                const strong = container.querySelector('strong');
                if (strong) {
                    name = strong.textContent?.trim() || '';
                }

                // strong 없으면 다른 텍스트 요소
                if (!name) {
                    const textEls = container.querySelectorAll('p, span, h3, h4, div[class*="name"]');
                    for (const el of textEls) {
                        const text = el.textContent?.trim();
                        if (text && text.length > 0 && text.length < 50 && !text.includes('http')) {
                            name = text;
                            break;
                        }
                    }
                }
            }

            if (!name) name = img.alt || '';

            results.push({ name: name, image_url: src });
        });

        return results;
    }""", selector)

    for entry in entries:
        items.append({
            "name": entry["name"],
            "image_url": entry["image_url"],
            "source": "dearu/lysn",
        })

    return items


def download_image(url: str, filepath: str) -> bool:
    """이미지 다운로드"""
    try:
        # wevpstatic URL은 type 파라미터 제거하여 원본 크기 요청
        clean_url = re.sub(r'\?type=.*$', '', url)
        req = urllib.request.Request(clean_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://weverse.io/",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        with open(filepath, "wb") as f:
            f.write(data)
        return True
    except Exception as e:
        print(f"    Download failed: {e}")
        # type 파라미터 포함하여 재시도
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://weverse.io/",
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            with open(filepath, "wb") as f:
                f.write(data)
            return True
        except Exception as e2:
            print(f"    Retry failed: {e2}")
            return False


async def main():
    from playwright.async_api import async_playwright

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(RESULT_JSON), exist_ok=True)

    all_found = []       # 전체 크롤링 결과
    matched = {}         # artist_name → {image_url, source, found_name}
    not_found = []       # 매칭 실패 아티스트

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="ko-KR",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        for source in CRAWL_SOURCES:
            items = await crawl_source(page, source)
            all_found.extend(items)

            # 매칭
            for item in items:
                if not item["name"]:
                    continue
                artist = match_artist(item["name"])
                if artist and artist not in matched:
                    matched[artist] = {
                        "image_url": item["image_url"],
                        "source": source["name"],
                        "found_name": item["name"],
                    }
                    print(f"  ✓ MATCHED: {item['name']} → {artist}")

            # 이미 20개 다 찾으면 종료
            if len(matched) >= len(TARGET_ARTISTS):
                print(f"\n모든 아티스트 매칭 완료!")
                break

        await browser.close()

    # ── 결과 정리 ──
    print(f"\n{'='*50}")
    print(f"매칭 결과: {len(matched)}/{len(TARGET_ARTISTS)}")
    print(f"{'='*50}")

    # 매칭된 아티스트 출력 + 다운로드
    result_matched = []
    for artist, info in sorted(matched.items()):
        print(f"  ✓ {artist:20s} ← {info['found_name']:20s} [{info['source']}]")

        ext = "jpg"
        if ".png" in info["image_url"].lower():
            ext = "png"
        elif ".webp" in info["image_url"].lower():
            ext = "webp"

        filename = f"{artist}.{ext}"
        filepath = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(filepath):
            print(f"    [SKIP] {filename} already exists")
        else:
            ok = download_image(info["image_url"], filepath)
            if ok:
                size_kb = os.path.getsize(filepath) / 1024
                print(f"    [OK] {filename} ({size_kb:.1f} KB)")
            else:
                print(f"    [FAIL] {filename}")

        result_matched.append({
            "name_en": artist,
            "source": info["source"],
            "found_name": info["found_name"],
            "image_url": info["image_url"],
            "file": filename,
        })

    # 미매칭 아티스트
    for artist in sorted(TARGET_ARTISTS.keys()):
        if artist not in matched:
            not_found.append(artist)
            print(f"  ✗ {artist} — NOT FOUND")

    # ── JSON 저장 ──
    result = {
        "total_crawled": len(all_found),
        "matched_count": len(matched),
        "not_found_count": len(not_found),
        "matched": result_matched,
        "not_found": not_found,
    }

    with open(RESULT_JSON, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nResults saved to: {RESULT_JSON}")
    print(f"Images saved to: {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
