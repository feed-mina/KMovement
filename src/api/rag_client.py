"""rag_client.py — ChromaDB 벡터 검색 + Groq LLM (TorchServe 경유)"""
from __future__ import annotations
import os
import chromadb
from groq import Groq

from src.api.torchserve_client import embed_texts_sync

GROQ_MODEL  = "openai/gpt-oss-120b"
CHROMA_MODE = os.environ.get("CHROMA_MODE", "http").strip().lower()

# ChromaDB — HttpClient 모드 (서버 분리)
CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", "8100"))
CHROMA_PATH = os.environ.get("CHROMA_PATH", "chroma_db")

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
    resp = get_groq().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": "You are K-Ride Guide, a concise Korean travel assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        max_tokens=700,
    )
    return resp.choices[0].message.content


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

    resp = get_groq().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": "당신은 한국 여행 전문 AI 가이드입니다."},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.7,
        max_tokens=512,
    )
    return resp.choices[0].message.content


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

    context = "\n".join([
        f"{i+1}. {p.get('name','?')} ({p.get('sido','?')}, {p.get('category','?')}) — {p.get('address','')}"
        for i, p in enumerate(pois[:15])
    ])

    system_prompt = (
        "당신은 한국 여행 일정 전문가입니다. "
        "반드시 제공된 POI 목록에서만 장소를 선택하세요. "
        "응답은 순수 JSON만 출력하고 다른 텍스트는 포함하지 마세요."
    )

    user_prompt = f"""아래 조건에 맞는 {day_count}일 여행 일정을 JSON으로 생성하세요.

여행기간: {duration} ({day_count}일)
선택아티스트: {', '.join(artists)}
선택지역: {', '.join(regions)}
여행목적: {', '.join(purposes)}
예산: {budget.get('min', 0):,}원 ~ {budget.get('max', 2000000):,}원

[사용 가능한 POI 목록]
{context}

출력 형식 (JSON만, 설명 없이):
{{
  "itinerary": [
    {{
      "day": 1,
      "morning": {{
        "places": [
          {{"name": "장소명", "address": "주소", "tip": "한줄 팁"}}
        ]
      }},
      "afternoon": {{
        "places": [
          {{"name": "장소명", "address": "주소", "tip": "한줄 팁"}}
        ]
      }}
    }}
  ]
}}
"""

    resp = get_groq().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.5,
        max_tokens=1500,
    )
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
