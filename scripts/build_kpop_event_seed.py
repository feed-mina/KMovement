# -*- coding: utf-8 -*-
"""K-POP 활동 타임라인 → V119 event 시드 마이그레이션 생성기.

입력:
  dataset/kpop_timeline_2026_2027.json
    {"source": ..., "events": [{"artist","start","end","category","title","detail","url","status"}, ...]}

출력:
  subproject/SDUI/SDUI-server/src/main/resources/db/migration/V119__seed_kpop_real_events.sql

정책:
  - V115 의 '[샘플 데이터]' 행을 먼저 걷어낸다 (북마크/저장 항목 정리 포함).
  - artist 는 LOWER(slug) 로 조인한다. V109 이후 slug 는 대소문자 구분 없이 유일하다.
    카탈로그에 없는 아티스트의 일정은 넣지 않고 실행 로그에 남긴다.
  - region 은 NOT NULL 이라 항상 채운다.
      앨범·영상        → '온라인'   (발매·공개는 장소가 없다)
      방송            → 장소가 잡히면 그 지역, 아니면 '온라인'
      콘서트·페스티벌   → 공연장/도시로 추론, 실패하면 '미정'
      해외는 시/도 대신 국가명('일본','미국'…)을 넣는다. 지역 필터가 국내 시/도와
      섞이지 않게 하려면 이 값을 그대로 화면 필터 목록에서 제외하면 된다.
  - '추정' 일정도 노출하되 description 을 '[추정]' 으로 시작시켜 구분한다 (#239 와 같은 기조).
  - 여러 날에 걸친 일정은 시작일을 event_date 로 쓰고 기간을 description 에 적는다.
  - 모든 행의 description 끝에 SEED_MARKER 를 붙여 재실행/롤백 시 이 배치만 골라낼 수 있게 한다.

주의:
  - V119 가 어느 환경에든 적용된 뒤에는 재생성 금지 (Flyway 체크섬 불일치).
    데이터 갱신은 새 번호의 마이그레이션으로 만들 것.

사용:
  python scripts/build_kpop_event_seed.py
  python scripts/build_kpop_event_seed.py --from-html path/to/kpop-timeline.html  # 데이터셋 재추출
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATASET = REPO_ROOT / "dataset/kpop_timeline_2026_2027.json"
OUT_SQL = (
    REPO_ROOT
    / "subproject/SDUI/SDUI-server/src/main/resources/db/migration/V119__seed_kpop_real_events.sql"
)

SEED_MARKER = "출처: K-POP 활동 타임라인 2026-2027"
BATCH = 120

# --- 아티스트: 타임라인 표기 → artist.slug (LOWER 비교) -------------------------
# 괄호 안의 멤버/유닛 표기는 그룹으로 접고, 대신 title_ko 앞에 [멤버] 로 남긴다.
ARTIST_TO_SLUG = {
    "BTS": "bts",
    "블랙핑크": "blackpink",
    "세븐틴": "seventeen",
    "아이브": "ive",
    "에스파": "aespa",
    "뉴진스": "newjeans",
    "트와이스": "twice",
    "스트레이 키즈": "stray kids",
    "엑소": "exo",
    "NCT": "nct",
    "에이티즈": "ateez",
    "르세라핌": "le sserafim",
    "투모로우바이투게더": "tomorrow x together",
    "엔하이픈": "enhypen",
    "레드벨벳": "red velvet",
    "있지": "itzy",
    "라이즈": "riize",
    "보이넥스트도어": "boynextdoor",
    "데이식스": "day6",
    "(여자)아이들": "(여자)아이들",
    "지드래곤": "g-dragon",
    "아이유": "아이유(iu)",
    "태연": "태연(taeyeon)",
    "임영웅": "임영웅",
    "지코": "지코(zico)",
    "악뮤": "악뮤(akmu)",
    "박효신": "박효신",
    "이무진": "이무진",
    "볼빨간사춘기": "볼빨간사춘기",
    "백예린": "백예린",
    "성시경": "성시경",
    "장원영": "장원영",
    "차은우": "차은우",
    "유재석": "유재석",
    "침착맨": "침착맨",
    "쯔양": "쯔양",
    "곽튜브": "곽튜브",
    "빠니보틀": "빠니보틀",
    "감스트": "감스트",
    "이영지": "이영지",
    "원지의 하루": "원지의하루",
    "입짧은햇님": "입짧은햇님",
}

CATEGORY_EN = {
    "콘서트": "concert",
    "페스티벌": "festival",
    "방송": "broadcast",
    "앨범": "release",
    "영상": "video",
}

ONLINE = "온라인"
UNKNOWN = "미정"

# region → 영문 표기 (title_en 조립용)
REGION_EN = {
    "서울": "Seoul", "인천": "Incheon", "경기": "Gyeonggi", "부산": "Busan", "대구": "Daegu",
    "대전": "Daejeon", "광주": "Gwangju", "울산": "Ulsan", "세종": "Sejong", "제주": "Jeju",
    "강원": "Gangwon", "충북": "Chungbuk", "충남": "Chungnam", "전북": "Jeonbuk",
    "전남": "Jeonnam", "경북": "Gyeongbuk", "경남": "Gyeongnam",
    ONLINE: "Online", UNKNOWN: "TBD",
    "일본": "Japan", "대만": "Taiwan", "홍콩": "Hong Kong", "마카오": "Macau",
    "싱가포르": "Singapore", "태국": "Thailand", "인도네시아": "Indonesia",
    "필리핀": "Philippines", "말레이시아": "Malaysia", "베트남": "Vietnam", "중국": "China",
    "인도": "India", "미국": "United States", "캐나다": "Canada", "영국": "United Kingdom",
    "독일": "Germany", "프랑스": "France", "네덜란드": "Netherlands", "벨기에": "Belgium",
    "덴마크": "Denmark", "스웨덴": "Sweden", "스페인": "Spain", "이탈리아": "Italy",
    "폴란드": "Poland", "포르투갈": "Portugal", "호주": "Australia", "뉴질랜드": "New Zealand",
    "UAE": "UAE", "사우디아라비아": "Saudi Arabia", "브라질": "Brazil",
    "아르헨티나": "Argentina", "칠레": "Chile", "페루": "Peru", "콜롬비아": "Colombia",
    "멕시코": "Mexico",
}

# 장소 문자열 → region. 리스트 순서가 곧 우선순위다(구체적인 표기가 먼저 걸려야 한다).
REGION_RULES = [
    ("부산", ["부산아시아드", "부산 아시아드", "사직실내체육관", "사직 실내", "벡스코", "BEXCO",
             "부산항", "해운대", "부산"]),
    ("인천", ["인천아시아드", "인천 아시아드", "인스파이어", "인천문학", "인천 문학", "문학경기장",
             "송도", "영종도", "파라다이스시티", "인천대", "인천"]),
    ("경기", ["킨텍스", "KINTEX", "고양종합운동장", "고양", "일산", "수원", "성남", "용인", "파주",
             "안양", "부천", "의정부", "안산", "평택", "광명", "남양주", "하남", "화성", "가평",
             "자라섬", "동두천", "김포", "시흥", "군포", "이천"]),
    ("대구", ["대구 EXCO", "대구EXCO", "엑스코", "EXCO", "대구"]),
    ("대전", ["대전컨벤션", "대전 컨벤션", "대전"]),
    ("광주", ["김대중컨벤션", "광주여대", "광주"]),
    ("울산", ["울산"]),
    ("세종", ["세종특별", "세종시"]),
    ("제주", ["제주", "서귀포"]),
    ("강원", ["강릉", "춘천", "원주", "속초", "평창", "홍천", "인제", "양양", "정선", "철원", "고석정"]),
    ("충북", ["청주", "충주", "제천", "괴산"]),
    ("충남", ["천안", "아산", "보령", "서산", "당진", "논산"]),
    ("전북", ["전주", "익산", "군산", "정읍"]),
    ("전남", ["여수", "순천", "목포", "광양", "나주"]),
    ("경북", ["경주", "포항", "안동", "구미", "김천"]),
    ("경남", ["창원", "김해", "진주", "통영", "거제", "양산"]),
    ("서울", ["KSPO", "올림픽공원", "올림픽홀", "체조경기장", "핸드볼경기장", "잠실", "고척", "장충",
             "블루스퀘어", "예스24", "상암", "서울월드컵", "국립중앙박물관", "성수", "한남", "동대문",
             "DDP", "코엑스", "COEX", "롯데월드", "더현대", "홍대", "무신사", "노들섬", "문화비축기지",
             "여의도", "뚝섬", "목동", "세종문화회관", "연세대", "고려대", "한양대", "경희대", "건국대",
             "광운대", "세종대", "중앙대", "숙명여대", "서강대", "이화여대", "국민대", "동국대",
             "서울대", "성균관대", "한국외대", "서울"]),

    ("일본", ["도쿄돔", "도쿄", "東京", "교세라", "오사카성", "오사카", "요코하마", "K-Arena",
             "PIA ARENA", "나고야", "반테린", "후쿠오카", "마린메세", "삿포로", "사이타마", "벨루나",
             "고베", "히로시마", "센다이", "지바", "게이오", "아리아케", "인텍스", "니가타", "시즈오카",
             "가나가와", "미야기", "세키스이", "사가", "SAGA아레나", "나가노", "빅햇", "가와사키",
             "오키나와", "일본", "Tokyo", "Osaka", "Nagoya", "Fukuoka", "Sapporo", "Yokohama",
             "Saitama", "Belluna", "Kyocera"]),
    ("대만", ["타이베이", "가오슝", "타이중", "타오위안", "대만", "Taipei", "Kaohsiung", "NTSU"]),
    ("홍콩", ["홍콩", "카이탁", "AsiaWorld", "Hong Kong"]),
    ("마카오", ["마카오", "Macao", "Macau", "Galaxy Arena", "Venetian", "Cotai"]),
    ("싱가포르", ["싱가포르", "Singapore"]),
    ("태국", ["방콕", "태국", "IMPACT", "임팩트", "BITEC", "Thunderdome", "Rajamangala", "Bangkok"]),
    ("인도네시아", ["자카르타", "인도네시아", "ICE BSD", "Indonesia Arena", "Jakarta", "발리"]),
    ("필리핀", ["마닐라", "필리핀", "Mall of Asia", "Araneta", "Manila", "Bulacan"]),
    ("말레이시아", ["쿠알라룸푸르", "말레이시아", "Axiata", "Bukit Jalil", "Kuala Lumpur"]),
    ("베트남", ["하노이", "호치민", "베트남", "Hanoi"]),
    ("중국", ["상하이", "베이징", "광저우", "선전", "청두", "중국", "Shanghai", "Beijing"]),
    ("인도", ["뭄바이", "뉴델리", "인도 "]),
    # 미국 규칙의 '오클랜드'(Oakland)보다 먼저 걸려야 뉴질랜드 Auckland 공연이 미국으로 새지 않는다.
    ("뉴질랜드", ["뉴질랜드", "Auckland", "Spark Arena"]),
    ("미국", ["뉴욕", "로스앤젤레스", "LA ", "시카고", "애틀랜타", "워싱턴", "필라델피아", "시애틀",
             "샌프란시스코", "오클랜드", "댈러스", "휴스턴", "라스베이거스", "보스턴", "마이애미",
             "덴버", "피닉스", "뉴어크", "인디오", "애너하임", "포트워스", "올랜도", "샬럿",
             "디트로이트", "세인트폴", "오스틴", "샌디에이고", "폭스보로", "볼티모어", "알링턴",
             "새너제이", "폼파노비치", "내슈빌", "탬파", "롤리", "콜럼버스", "밀워키", "미국",
             "Crypto.com", "MetLife", "Prudential", "Tacoma", "Climate Pledge",
             "American Airlines Center", "Capital One", "UBS", "Oakland Arena", "캐피털 원",
             "엑스피니티", "스테이트팜", "Barclays", "Madison Square", "Kia Forum", "SoFi",
             "Allegiant", "Chase Center", "Moody Center", "United Center", "Little Caesars",
             "기아 센터", "Kia Center", "스펙트럼 센터", "리틀 시저스", "그랜드 카지노", "무디 센터",
             "Snapdragon", "Gillette", "M&T Bank", "AT&T Stadium", "SAP Center", "그랜트파크",
             "Grant Park", "T-Mobile Stage", "Pompano"]),
    ("캐나다", ["토론토", "밴쿠버", "몬트리올", "캐나다", "Rogers Arena", "Queen Elizabeth Theatre",
              "Scotiabank"]),
    ("영국", ["런던", "맨체스터", "영국", "Tottenham Hotspur", "O2 Arena", "Co-op Live", "London"]),
    ("독일", ["베를린", "쾰른", "함부르크", "프랑크푸르트", "뮌헨", "독일", "Uber Arena", "Lanxess",
             "Berlin"]),
    ("프랑스", ["파리", "낭테르", "프랑스", "Accor Arena", "Plenitude", "Paris"]),
    ("네덜란드", ["암스테르담", "네덜란드", "Ziggo Dome"]),
    ("벨기에", ["브뤼셀", "벨기에", "ING Arena"]),
    ("덴마크", ["코펜하겐", "덴마크", "Royal Arena"]),
    ("스웨덴", ["스톡홀름", "스웨덴"]),
    ("스페인", ["바르셀로나", "마드리드", "스페인", "Estadi Olímpic", "Palau Sant Jordi"]),
    ("이탈리아", ["밀라노", "이탈리아", "Unipol"]),
    ("폴란드", ["바르샤바", "폴란드"]),
    ("포르투갈", ["리스본", "포르투갈", "메오 아레나", "Lisbon"]),
    ("호주", ["시드니", "멜버른", "브리즈번", "호주", "Rod Laver", "Qudos Bank", "Sydney",
             "Melbourne"]),
    ("UAE", ["두바이", "아부다비", "UAE", "Dubai"]),
    ("사우디아라비아", ["리야드", "제다", "사우디"]),
    ("브라질", ["상파울루", "리우", "브라질", "Autódromo"]),
    ("아르헨티나", ["부에노스아이레스", "아르헨티나"]),
    ("칠레", ["산티아고", "칠레", "Cerrillos"]),
    ("페루", ["리마", "페루", "San Marcos", "Costa 21"]),
    ("콜롬비아", ["보고타", "콜롬비아", "Vive Claro", "El Campín"]),
    ("멕시코", ["멕시코", "몬테레이"]),
]

VENUE_CATEGORIES = {"콘서트", "페스티벌"}
PLACELESS_CATEGORIES = {"앨범", "영상"}


def resolve_region(category: str, title: str, detail: str) -> str:
    """이벤트 성격과 장소 문자열로 region 을 정한다. 항상 값을 돌려준다."""
    if category in PLACELESS_CATEGORIES:
        return ONLINE
    hay = f"{title} {detail}"
    for region, keywords in REGION_RULES:
        if any(keyword in hay for keyword in keywords):
            return region
    return ONLINE if category == "방송" else UNKNOWN


def split_unit(artist: str) -> tuple[str, str | None]:
    """'블랙핑크 (제니)' → ('블랙핑크', '제니'). 괄호가 없으면 (원문, None)."""
    # '(여자)아이들' 은 괄호로 끝나지 않으므로 fullmatch 가 걸리지 않는다.
    matched = re.fullmatch(r"(.+?)\s*\((.+)\)", artist)
    if not matched:
        return artist, None
    return matched.group(1).strip(), matched.group(2).strip()


def resolve_venue(category: str, detail: str, region: str) -> str | None:
    """detail 의 첫 조각을 공연장으로 쓴다. 장소가 없는 이벤트는 비운다."""
    if category not in VENUE_CATEGORIES or region in (ONLINE, UNKNOWN) or not detail:
        return None
    venue = detail.split(" / ")[0].strip()
    # '3회', '3회 전석 매진' 같은 회차 정보는 장소가 아니다 (description 에는 그대로 남는다).
    venue = re.sub(r"\s*\d+\s*회(\s*전석\s*매진)?\s*$", "", venue).strip()
    # '일본 개최' 처럼 지역만 되풀이하는 조각은 공연장이 아니다.
    if len(venue) < 3 or re.fullmatch(r"\S*\s*개최", venue):
        return None
    return clip(venue, 200) or None


def normalize_date(value: str) -> tuple[str, bool]:
    """'2026-03' 처럼 일자가 없는 원본은 그 달 1일로 당긴다. (날짜, 월단위여부)"""
    if re.fullmatch(r"\d{4}-\d{2}", value):
        return f"{value}-01", True
    return value, False


def build_description(event: dict) -> str:
    parts = []
    status = event.get("status")
    if status == "추정":
        parts.append("[추정] 공식 발표 전이라 근거가 약한 추정 일정입니다.")
    elif status == "예정":
        parts.append("[예정] 진행 중이거나 세부 일정이 확정되지 않았습니다.")
    if event.get("detail"):
        parts.append(event["detail"])

    start, month_only = normalize_date(event["start"])
    if month_only:
        # event_date 는 NOT NULL 이라 1일로 채웠다. 원본이 '그 달 중' 이었음을 남긴다.
        parts.append(f"날짜 미정: {event['start']} 중 (달력에는 1일로 표시)")
    elif event.get("end") and event["end"] != start:
        parts.append(f"기간: {start} ~ {event['end']}")

    parts.append(f"구분: {event['category']}")
    parts.append(SEED_MARKER)
    return " / ".join(parts)


def build_title_en_tail(event: dict, region: str) -> str:
    """한글 제목을 번역하지 않는다. 원제의 영문 조각 + 분류 + 지역으로 식별용 꼬리를 만든다.

    앞의 아티스트명은 카탈로그와 어긋나지 않도록 SQL 에서 artist.name_en 을 붙인다.
    """
    # 숫자로 시작하는 조각('2ND WORLD TOUR')이 잘리지 않도록 첫 글자에 숫자도 허용하고,
    # 대신 알파벳이 하나도 없는 조각(회차 숫자 등)은 버린다.
    fragments = re.findall(r"[A-Za-z0-9][A-Za-z0-9&.:!\-]*(?:\s+[A-Za-z0-9&.:!\-]+)*", event["title"])
    fragments = [fragment.strip(" -:.,&") for fragment in fragments]
    latin = " ".join(
        fragment for fragment in fragments if len(fragment) >= 3 and re.search(r"[A-Za-z]", fragment)
    )
    pieces = [CATEGORY_EN.get(event["category"], "event")]
    if latin:
        pieces.append(f"- {latin}")
    region_en = REGION_EN.get(region)
    if region_en and region_en not in ("Online", "TBD"):
        pieces.append(f"({region_en})")
    return clip(" ".join(pieces), 160)


def clip(value: str, limit: int) -> str:
    value = (value or "").strip()
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def q(value, null_type: str = "text") -> str:
    """VALUES 목록에서 전부 NULL 인 컬럼은 타입 추론이 실패하므로 NULL 을 캐스팅한다."""
    if value is None or value == "":
        return f"CAST(NULL AS {null_type})"
    return "'" + str(value).replace("'", "''") + "'"


def extract_from_html(html_path: Path) -> dict:
    """타임라인 HTML 의 `const EV = [...]` 를 읽어 데이터셋 형태로 바꾼다."""
    source = html_path.read_text(encoding="utf-8")
    matched = re.search(r"const EV\s*=\s*(\[.*?\]);", source, re.S)
    if not matched:
        raise SystemExit(f"{html_path}: `const EV = [...]` 를 찾지 못했다")
    raw = json.loads(matched.group(1))
    events = [
        {
            "artist": row["a"],
            "start": row["d"],
            "end": row.get("e") or None,
            "category": row["c"],
            "title": row["t"],
            "detail": row.get("x") or None,
            "url": row.get("u") or None,
            "status": row.get("f") or "확정",
        }
        for row in raw
    ]
    events.sort(key=lambda e: (e["start"], e["artist"], e["title"]))
    title = re.search(r"<title>(.*?)</title>", source, re.S)
    return {
        "source": (title.group(1).strip() if title else "K-POP 활동 타임라인"),
        "note": "아티스트별 활동 일정 원본. scripts/build_kpop_event_seed.py 가 이 파일을 읽는다.",
        "range": {"from": min(e["start"] for e in events), "to": max(e["start"] for e in events)},
        "events": events,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-html", type=Path, help="타임라인 HTML 에서 데이터셋을 다시 추출한다")
    args = parser.parse_args()

    if args.from_html:
        dataset = extract_from_html(args.from_html)
        DATASET.parent.mkdir(parents=True, exist_ok=True)
        DATASET.write_text(
            json.dumps(dataset, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        print(f"데이터셋 {len(dataset['events'])}건 → {DATASET.relative_to(REPO_ROOT)}")

    if not DATASET.exists():
        print(f"입력 없음: {DATASET}", file=sys.stderr)
        return 1

    dataset = json.loads(DATASET.read_text(encoding="utf-8"))
    rows, skipped, seen = [], Counter(), set()

    for event in dataset["events"]:
        group, unit = split_unit(event["artist"])
        slug = ARTIST_TO_SLUG.get(group)
        if slug is None:
            skipped[event["artist"]] += 1
            continue

        region = resolve_region(event["category"], event["title"], event.get("detail") or "")
        title_ko = clip(f"[{unit}] {event['title']}" if unit else event["title"], 200)
        event_date, _ = normalize_date(event["start"])
        key = (slug, title_ko, event_date)
        if key in seen:
            continue
        seen.add(key)

        rows.append(
            {
                "slug": slug,
                "title_ko": title_ko,
                "title_en_tail": build_title_en_tail(event, region),
                "region": region,
                "venue": resolve_venue(event["category"], event.get("detail") or "", region),
                "event_date": event_date,
                "description": build_description(event),
                "official_url": event.get("url"),
            }
        )

    rows.sort(key=lambda r: (r["event_date"], r["slug"], r["title_ko"]))
    OUT_SQL.write_text(render_sql(dataset, rows), encoding="utf-8")

    print(f"{len(rows)}건 → {OUT_SQL.relative_to(REPO_ROOT)}")
    print("지역 분포:", dict(Counter(r["region"] for r in rows).most_common()))
    if skipped:
        print("카탈로그에 없어 제외:", dict(skipped))
    return 0


def render_sql(dataset: dict, rows: list[dict]) -> str:
    regions = Counter(r["region"] for r in rows)
    domestic = sorted(
        (region, count)
        for region, count in regions.items()
        if region in {"서울", "인천", "경기", "부산", "대구", "대전", "광주", "울산", "세종",
                      "제주", "강원", "충북", "충남", "전북", "전남", "경북", "경남"}
    )
    out = [
        "-- V119__seed_kpop_real_events.sql",
        "-- 생성기: scripts/build_kpop_event_seed.py (직접 편집하지 말 것)",
        f"-- 원본: {dataset['source']}",
        "--",
        "-- V115 가 넣은 '[샘플 데이터]' 상대 날짜 일정을 실제 활동 일정으로 교체한다.",
        f"-- 수록 범위 {dataset['range']['from']} ~ {dataset['range']['to']}, "
        f"총 {len(rows)}건.",
        f"-- 국내 {sum(count for _, count in domestic)}건"
        f"({', '.join(f'{region} {count}' for region, count in domestic)}), "
        f"온라인 {regions.get(ONLINE, 0)}건, 나머지는 해외 국가명.",
        "--",
        "-- region 규칙: 앨범·영상은 '온라인', 방송은 현장이 있으면 그 지역, 콘서트·페스티벌은",
        "-- 공연장/도시로 추론하고 실패하면 '미정'. 해외는 시/도 대신 국가명을 넣는다.",
        "-- 추정 일정은 노출하되 description 이 '[추정]' 으로 시작한다.",
        "--",
        f"-- 이 배치만 되돌리려면: DELETE FROM event WHERE description LIKE '%{SEED_MARKER}%';",
        "-- (북마크가 걸려 있으면 event_bookmark·saved_item 을 먼저 정리해야 한다.)",
        "--",
        "-- 지난 일정도 그대로 담는다. 목록이 과거부터 열리지 않게 하는 기본 범위는 데이터가 아니라",
        "-- KpopController.events() 의 COALESCE(:fromDate, CURRENT_DATE) 가 정한다.",
        "",
        "BEGIN;",
        "",
        "-- 1) 샘플 일정 제거. event_bookmark/saved_item 이 event 를 참조하므로 먼저 정리한다.",
        "DELETE FROM event_bookmark",
        "WHERE event_id IN (SELECT event_id FROM event WHERE description LIKE '[샘플 데이터]%');",
        "",
        "DELETE FROM saved_item",
        "WHERE item_type = 'EVENT'",
        "  AND item_ref IN (SELECT event_id FROM event WHERE description LIKE '[샘플 데이터]%');",
        "",
        "UPDATE product_candidate",
        "SET event_id = NULL,",
        "    updated_at = NOW()",
        "WHERE event_id IN (SELECT event_id FROM event WHERE description LIKE '[샘플 데이터]%');",
        "",
        "DELETE FROM event WHERE description LIKE '[샘플 데이터]%';",
        "",
        "-- 2) 실제 활동 일정 적재. 카탈로그에 없는 아티스트는 JOIN 에서 자연히 빠진다.",
        "--    이미 같은 (아티스트, 제목, 날짜) 가 있으면 건너뛴다. 두 번 돌려도 중복되지 않고,",
        "--    사용자가 담아둔 북마크가 걸린 기존 행을 지웠다 다시 넣는 일도 없다.",
    ]

    for start in range(0, len(rows), BATCH):
        chunk = rows[start : start + BATCH]
        out.append(
            "WITH seed(slug_key, title_ko, title_en_tail, region, venue, event_date, description, official_url) AS ("
        )
        out.append("    VALUES")
        values = [
            "        ("
            + ", ".join(
                [
                    q(r["slug"]),
                    q(r["title_ko"]),
                    q(r["title_en_tail"]),
                    q(r["region"]),
                    q(r["venue"], "varchar"),
                    f"DATE {q(r['event_date'])}",
                    q(r["description"]),
                    q(r["official_url"]),
                ]
            )
            + ")"
            for r in chunk
        ]
        out.append(",\n".join(values))
        out.append(")")
        out.append("INSERT INTO event (")
        out.append(
            "    artist_id, title_ko, title_en, region, venue, event_date, description, official_url, approved_yn"
        )
        out.append(")")
        out.append("SELECT")
        out.append("    a.artist_id,")
        out.append("    seed.title_ko,")
        out.append("    LEFT(a.name_en || ' ' || seed.title_en_tail, 200),")
        out.append("    seed.region,")
        out.append("    seed.venue,")
        out.append("    seed.event_date,")
        out.append("    seed.description,")
        out.append("    COALESCE(seed.official_url, a.official_url),")
        out.append("    'Y'")
        out.append("FROM seed")
        out.append("JOIN artist a ON LOWER(a.slug) = seed.slug_key")
        out.append("WHERE a.approved_yn = 'Y'")
        out.append("  AND NOT EXISTS (")
        out.append("      SELECT 1")
        out.append("      FROM event existing")
        out.append("      WHERE existing.artist_id = a.artist_id")
        out.append("        AND existing.title_ko = seed.title_ko")
        out.append("        AND existing.event_date = seed.event_date")
        out.append("  );")
        out.append("")

    out += [
        "COMMIT;",
        "",
    ]
    return "\n".join(out)


if __name__ == "__main__":
    raise SystemExit(main())
