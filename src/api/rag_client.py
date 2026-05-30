"""rag_client.py — ChromaDB 벡터 검색 + Groq LLM (TorchServe 경유)"""
from __future__ import annotations
import math
import os
import time
import threading
import chromadb
from groq import Groq

from src.api.torchserve_client import embed_texts_sync

GROQ_MODEL  = "llama-3.3-70b-versatile"
CHROMA_MODE = os.environ.get("CHROMA_MODE", "http").strip().lower()

# ChromaDB — HttpClient 모드 (서버 분리)
CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8100"))
CHROMA_PATH = os.environ.get("CHROMA_PATH", "chroma_db")


# ── 서킷 브레이커 ─────────────────────────────────────────────────────────
class CircuitBreaker:
    """간단한 서킷 브레이커 — CLOSED → OPEN → HALF_OPEN → CLOSED 순환"""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
    ):
        self._lock = threading.Lock()
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._half_open_max_calls = half_open_max_calls
        self._failure_count = 0
        self._half_open_calls = 0
        self._state = "CLOSED"          # CLOSED | OPEN | HALF_OPEN
        self._opened_at: float = 0.0

    @property
    def state(self) -> str:
        with self._lock:
            if self._state == "OPEN" and (time.time() - self._opened_at) >= self._recovery_timeout:
                self._state = "HALF_OPEN"
                self._half_open_calls = 0
            return self._state

    def allow_request(self) -> bool:
        s = self.state
        if s == "CLOSED":
            return True
        if s == "HALF_OPEN":
            with self._lock:
                if self._half_open_calls < self._half_open_max_calls:
                    self._half_open_calls += 1
                    return True
            return False
        return False  # OPEN

    def record_success(self) -> None:
        with self._lock:
            self._failure_count = 0
            self._state = "CLOSED"

    def record_failure(self) -> None:
        with self._lock:
            self._failure_count += 1
            if self._failure_count >= self._failure_threshold:
                self._state = "OPEN"
                self._opened_at = time.time()
                print(f"[CircuitBreaker] OPEN — {self._failure_count}회 연속 실패, {self._recovery_timeout}초 후 재시도")


_groq_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=30.0)


# ── 싱글턴 초기화 ──────────────────────────────────────────────────────────
_chroma: chromadb.ClientAPI | None = None
_groq: Groq | None = None


def get_chroma() -> chromadb.ClientAPI:
    global _chroma
    if _chroma is None:
        if CHROMA_MODE in {"persistent", "local"}:
            _chroma = chromadb.PersistentClient(path=CHROMA_PATH)
        else:
            _chroma = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    return _chroma


def get_groq() -> Groq:
    global _groq
    if _groq is None:
        _groq = Groq(api_key=os.environ["GROQ_API_KEY"])
    return _groq


def _check_groq_breaker() -> None:
    """서킷 브레이커 상태 확인 — OPEN이면 예외 발생"""
    if not _groq_breaker.allow_request():
        raise RuntimeError(
            f"Groq API 서킷 브레이커 OPEN 상태입니다 (상태: {_groq_breaker.state}). "
            "잠시 후 다시 시도해주세요."
        )


# ── ChromaDB 컬렉션 이름 (기존 4개) ────────────────────────────────────────
# kride_poi_kculture / kride_poi_food / kride_poi_nature / kride_poi_history
COLLECTION_MAP = {
    "kculture":  "kride_poi_kculture",
    "food":      "kride_poi_food",
    "nature":    "kride_poi_nature",
    "history":   "kride_poi_history",
    "shopping":  "kride_poi_kculture",   # fallback
    "rest":      "kride_poi_nature",     # fallback
}


def _collection_names_for_chat() -> list[str]:
    names = list(dict.fromkeys(COLLECTION_MAP.values()))
    names.insert(0, "kride_pdf_knowledge")
    return names


def _query_collection(collection_name: str, query_vec: list[float], top_k: int) -> list[dict]:
    try:
        col = get_chroma().get_collection(collection_name)
    except Exception:
        return []

    try:
        res = col.query(
            query_embeddings=[query_vec],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
    except Exception:
        return []

    documents = (res.get("documents") or [[]])[0]
    metadatas = (res.get("metadatas") or [[]])[0]
    distances = (res.get("distances") or [[]])[0]

    rows: list[dict] = []
    for doc, meta, dist in zip(documents, metadatas, distances):
        rows.append({
            "text": doc,
            "metadata": meta or {},
            "distance": float(dist),
            "collection": collection_name,
        })
    return rows


def search_chat_context(message: str, top_k: int = 4) -> list[dict]:
    query_vec = embed_texts_sync([message])[0]
    passages: list[dict] = []
    seen: set[str] = set()

    for collection_name in _collection_names_for_chat():
        for row in _query_collection(collection_name, query_vec, top_k):
            meta = row.get("metadata", {})
            key = str(meta.get("id") or meta.get("name") or row.get("text", "")[:80])
            if key in seen:
                continue
            seen.add(key)
            passages.append(row)

    return sorted(passages, key=lambda row: row.get("distance", 1.0))[:top_k * 2]


def generate_chat_answer(message: str) -> str:
    passages = search_chat_context(message, top_k=3)
    context = "\n".join(
        f"- {p.get('text', '')[:500]}"
        for p in passages[:8]
        if p.get("text")
    )
    if not context:
        context = "No retrieved context was available."

    prompt = f"""Answer the user's K-Ride travel question in Korean.
Use only the retrieved context when it is relevant. If the context is thin, say what is missing and give a careful general answer.

[Retrieved context]
{context}

[User question]
{message}
"""
    _check_groq_breaker()
    try:
        resp = get_groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are K-Ride Guide, a concise Korean travel assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=700,
        )
        _groq_breaker.record_success()
        return resp.choices[0].message.content
    except Exception as e:
        _groq_breaker.record_failure()
        raise


def generate_chat_answer_stream(message: str):
    """토큰 단위 스트리밍 제너레이터 — Groq stream=True"""
    _check_groq_breaker()
    passages = search_chat_context(message, top_k=3)
    context = "\n".join(
        f"- {p.get('text', '')[:500]}"
        for p in passages[:8]
        if p.get("text")
    )
    if not context:
        context = "No retrieved context was available."

    prompt = f"""Answer the user's K-Ride travel question in Korean.
Use only the retrieved context when it is relevant. If the context is thin, say what is missing and give a careful general answer.

[Retrieved context]
{context}

[User question]
{message}
"""
    try:
        stream = get_groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are K-Ride Guide, a concise Korean travel assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=700,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
        _groq_breaker.record_success()
    except Exception as e:
        _groq_breaker.record_failure()
        raise


def search_pois_by_purpose(
    purposes: list[str],
    query_text: str,
    top_k: int = 5,
) -> list[dict]:
    """purposes 기반 ChromaDB 벡터 검색"""
    chroma   = get_chroma()
    query_vec = embed_texts_sync([query_text])[0]

    results: list[dict] = []
    seen_ids: set[str] = set()

    for purpose in purposes:
        collection_name = COLLECTION_MAP.get(purpose, "kride_poi_kculture")
        try:
            col = chroma.get_collection(collection_name)
        except Exception:
            continue

        res = col.query(
            query_embeddings=[query_vec],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        for meta, dist in zip(res["metadatas"][0], res["distances"][0]):
            poi_id = meta.get("id", meta.get("name", ""))
            if poi_id not in seen_ids:
                seen_ids.add(poi_id)
                results.append({**meta, "similarity": round(1 - dist, 3), "purpose": purpose})

    return results


def generate_recommendation_text(
    pois: list[dict],
    artists: list[str],
    regions: list[str],
    purposes: list[str],
    lang: str = "ko",
) -> str:
    """RAG 기반 추천 이유 텍스트 생성"""
    context = "\n".join([
        f"- {p.get('name', '')} ({p.get('sido', '')}): {p.get('address', '')}"
        for p in pois[:8]
    ])
    prompt = f"""아래 POI 목록만 참고해서 여행 추천 이유를 3~4문장으로 작성하세요.
목록에 없는 장소는 절대 언급하지 마세요.

아티스트: {', '.join(artists)}
지역: {', '.join(regions)}
여행목적: {', '.join(purposes)}

[POI 목록]
{context}

한국어로 친절하게 작성하세요."""

    _check_groq_breaker()
    try:
        resp = get_groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "당신은 한국 여행 전문 AI 가이드입니다."},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.7,
            max_tokens=512,
        )
        _groq_breaker.record_success()
        return resp.choices[0].message.content
    except Exception:
        _groq_breaker.record_failure()
        raise


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 거리 (km)"""
    R = 6371.0
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat, dlon = rlat2 - rlat1, rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _cluster_pois_by_proximity(pois: list[dict]) -> list[dict]:
    """Nearest Neighbor 휴리스틱으로 POI를 지리적 순서로 정렬"""
    if len(pois) <= 2:
        return pois

    # 좌표 없는 POI는 끝에 붙이기
    with_coords = [p for p in pois if p.get("lat") and p.get("lon")]
    without_coords = [p for p in pois if not (p.get("lat") and p.get("lon"))]

    if len(with_coords) <= 1:
        return pois

    remaining = list(with_coords)
    ordered = [remaining.pop(0)]

    while remaining:
        last = ordered[-1]
        nearest_idx = min(
            range(len(remaining)),
            key=lambda i: _haversine(
                last["lat"], last["lon"],
                remaining[i]["lat"], remaining[i]["lon"],
            ),
        )
        ordered.append(remaining.pop(nearest_idx))

    return ordered + without_coords


def generate_itinerary(
    duration: str,
    artists: list[str],
    regions: list[str],
    purposes: list[str],
    budget: dict,
    pois: list[dict],
) -> dict:
    """Groq LLM → 일정 JSON 생성

    duration: "당일치기" | "1박2일" | "2박3일"
    반환: {"itinerary": [{"day": 1, "morning": {"places": [...]}, "afternoon": {"places": [...]}}]}
    """
    day_count = {"당일치기": 1, "1박2일": 2, "2박3일": 3}.get(duration, 1)

    # 일정별 고정 배분
    ALLOCATION = {
        1: [(4, 4)],                      # 당일치기: 오전4 + 오후4 = 8
        2: [(3, 3), (3, 2)],              # 1박2일: 6 + 5 = 11
        3: [(3, 2), (3, 3), (2, 2)],      # 2박3일: 5 + 6 + 4 = 15
    }
    alloc = ALLOCATION.get(day_count, [(4, 4)])

    # 배분 설명 문자열
    alloc_desc = "\n".join(
        f"  - {d}일차: 오전 {m}곳, 오후 {a}곳"
        for d, (m, a) in enumerate(alloc, 1)
    )

    # POI를 주소에서 지역 추출하여 그룹별로 표시
    region_groups: dict[str, list[str]] = {}
    for i, p in enumerate(pois):
        addr = p.get("address", "")
        # 주소에서 시/도 + 시/군/구 추출
        parts = addr.split()
        region_key = " ".join(parts[:2]) if len(parts) >= 2 else (parts[0] if parts else "기타")
        
        # 아티스트 방문 정보 추가
        visited_artists = p.get("artists")
        artist_info = ""
        if visited_artists and isinstance(visited_artists, list):
            artist_info = f" [{', '.join(visited_artists)} 방문]"
            
        line = f"  {i+1}. {p.get('name','?')} ({p.get('category','?')}){artist_info} — {addr}"
        region_groups.setdefault(region_key, []).append(line)

    context_lines = []
    for region_key, lines in region_groups.items():
        context_lines.append(f"[{region_key}]")
        context_lines.extend(lines)
    context = "\n".join(context_lines)

    system_prompt = (
        "당신은 한국 여행 일정 전문가이자 동선 최적화 전문가입니다. "
        "반드시 제공된 POI 목록에서만 장소를 선택하세요. "
        "같은 지역의 장소를 같은 날, 같은 시간대에 묶어 이동 거리를 최소화하세요. "
        "응답은 순수 JSON만 출력하고 다른 텍스트는 포함하지 마세요."
    )

    user_prompt = f"""아래 조건에 맞는 {day_count}일 여행 일정을 JSON으로 생성하세요.

여행기간: {duration} ({day_count}일)
선택아티스트: {', '.join(artists)}
선택지역: {', '.join(regions)}
여행목적: {', '.join(purposes)}
예산: {budget.get('min', 0):,}원 ~ {budget.get('max', 2000000):,}원

[중요 규칙]
1. 아래 배분을 정확히 지켜주세요:
{alloc_desc}
2. 같은 지역의 장소를 같은 날/시간대에 배치하세요 (동선 최적화)
3. 모든 장소에 추천 이유(reason)를 반드시 작성하세요. (목록에 [OOO 방문] 표시가 있다면, 추천 이유에 "OOO가 방문한 곳으로..." 처럼 반드시 포함하세요)
4. 제공된 POI 목록의 장소만 사용하세요 (이름과 주소를 정확히 복사)

[사용 가능한 POI 목록 — 지역별 그룹]
{context}

출력 형식 (JSON만, 설명 없이):
{{
  "itinerary": [
    {{
      "day": 1,
      "morning": {{
        "places": [
          {{"name": "장소명", "address": "주소", "reason": "이 장소를 추천하는 이유 한 문장"}}
        ]
      }},
      "afternoon": {{
        "places": [
          {{"name": "장소명", "address": "주소", "reason": "이 장소를 추천하는 이유 한 문장"}}
        ]
      }}
    }}
  ]
}}
"""

    _check_groq_breaker()
    try:
        resp = get_groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=3000,
        )
        _groq_breaker.record_success()
    except Exception:
        _groq_breaker.record_failure()
        raise
    import json
    raw = resp.choices[0].message.content.strip()
    # JSON 블록만 추출 (```json ... ``` 래핑 대응)
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        return {"itinerary": [], "raw": raw, "error": "JSON 파싱 실패"}
