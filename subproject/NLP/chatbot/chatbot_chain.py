
"""
chatbot_chain.py — 핵심 RAG 파이프라인 오케스트레이션
====================================================
파이프라인:
  1. Multi-Query (원본 + 3 변형)
  2. Multi-Source Retrieval (PDF + POI 컬렉션 4개)
  3. 중복 제거
  4. Rerank (BGE-reranker-v2-m3)
  5. Context 조립
  6. Groq LLM 응답 생성
"""
from __future__ import annotations

from collections import defaultdict

import chromadb
from groq import Groq

from chatbot.config import (
    CHROMA_HOST,
    CHROMA_PORT,
    PDF_COLLECTION,
    POI_COLLECTIONS,
    GROQ_MODEL,
    GROQ_API_KEY,
    RETRIEVE_TOP_K_PDF,
    RETRIEVE_TOP_K_POI,
    RERANK_TOP_K,
    MAX_HISTORY_TURNS,
    TORCHSERVE_URL,
)
from chatbot.multi_query import generate_query_variants

import httpx

# ── 싱글턴 ────────────────────────────────────────────────────────────────────
_chroma: chromadb.ClientAPI | None = None
_groq: Groq | None = None

# 세션별 대화 이력 (인메모리)
_sessions: dict[str, list[dict]] = defaultdict(list)


def _embed_texts(texts: list[str]) -> list[list[float]]:
    """TorchServe 경유 SentenceTransformer 임베딩 (동기)"""
    resp = httpx.post(
        f"{TORCHSERVE_URL}/predictions/embedder",
        json={"text": texts},
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()


def _rerank_via_torchserve(query: str, documents: list[str]) -> list[float]:
    """TorchServe 경유 Cross-encoder 리랭킹 (동기)"""
    resp = httpx.post(
        f"{TORCHSERVE_URL}/predictions/reranker",
        json={"query": query, "documents": documents},
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()


def _get_chroma() -> chromadb.ClientAPI:
    global _chroma
    if _chroma is None:
        _chroma = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    return _chroma


def _get_groq() -> Groq:
    global _groq
    if _groq is None:
        _groq = Groq(api_key=GROQ_API_KEY)
    return _groq


# ── 검색 ──────────────────────────────────────────────────────────────────────
def _search_collection(
    collection_name: str,
    query_vec: list[float],
    top_k: int,
    source_type: str,
) -> list[dict]:
    """단일 ChromaDB 컬렉션 검색"""
    try:
        col = _get_chroma().get_collection(collection_name)
    except Exception:
        return []

    res = col.query(
        query_embeddings=[query_vec],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    passages = []
    for doc, meta, dist in zip(
        res["documents"][0], res["metadatas"][0], res["distances"][0]
    ):
        passages.append({
            "text": doc,
            "metadata": meta,
            "source_type": source_type,
            "collection": collection_name,
            "chroma_distance": float(dist),
        })
    return passages


def _multi_source_retrieve(queries: list[str]) -> list[dict]:
    """멀티쿼리 × 멀티소스 검색 → 통합"""
    all_passages: list[dict] = []
    seen_keys: set[str] = set()

    # 배치 임베딩 (TorchServe)
    all_vecs = _embed_texts(queries)

    for query, vec in zip(queries, all_vecs):

        # PDF 컬렉션
        for p in _search_collection(PDF_COLLECTION, vec, RETRIEVE_TOP_K_PDF, "pdf"):
            key = p["metadata"].get("source_pdf", "") + str(p["metadata"].get("page", "")) + str(p["metadata"].get("chunk_index", ""))
            if key not in seen_keys:
                seen_keys.add(key)
                all_passages.append(p)

        # POI 컬렉션 4개
        for col_name in POI_COLLECTIONS:
            for p in _search_collection(col_name, vec, RETRIEVE_TOP_K_POI, "poi"):
                poi_name = p["metadata"].get("name", p["text"][:50])
                if poi_name not in seen_keys:
                    seen_keys.add(poi_name)
                    all_passages.append(p)

    return all_passages


# ── 응답 생성 ─────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """당신은 한국 여행 전문 AI 챗봇 'K-Ride 가이드'입니다.

규칙:
1. 반드시 제공된 [참고 자료] 내용을 기반으로 답변하세요.
2. 참고 자료가 부족하거나 "관련 데이터가 없습니다"라고 되어 있다면, 억지로 지어내지 말고 "죄송합니다. 현재 데이터베이스에 요청하신 조건에 맞는 장소나 맛집 정보가 없습니다."라고 솔직하게 답변하세요.
3. 답변은 친절하고 구체적으로, 한국어로 작성하세요.
4. POI(관광지) 정보가 있으면 이름, 주소, 특징을 포함하세요.
5. 출처(PDF 파일명 또는 컬렉션명)를 [출처: ...] 형식으로 답변 끝에 명시하세요."""


def _build_context(passages: list[dict]) -> tuple[str, list[str], list[dict]]:
    """리랭킹된 패시지로 컨텍스트 조립 → (context_str, sources, pois)"""
    context_parts: list[str] = []
    sources: list[str] = set()
    pois: list[dict] = []

    for i, p in enumerate(passages, 1):
        text = p["text"][:500]
        context_parts.append(f"[{i}] {text}")

        if p["source_type"] == "pdf":
            sources.add(p["metadata"].get("source_pdf", "PDF"))
        else:
            sources.add(p.get("collection", "POI"))
            meta = p.get("metadata", {})
            if meta.get("name"):
                pois.append({
                    "name": meta.get("name", ""),
                    "address": meta.get("address", ""),
                    "category": meta.get("category", ""),
                    "lat": meta.get("lat"),
                    "lon": meta.get("lon"),
                })

    return "\n\n".join(context_parts), list(sources), pois


def chat(message: str, session_id: str, context: dict | None = None) -> dict:
    """
    챗봇 메인 파이프라인.

    Returns: {"reply": str, "sources": list, "pois": list}
    """
    # 1. Multi-Query
    queries = generate_query_variants(message)

    # 2. Multi-Source Retrieval
    passages = _multi_source_retrieve(queries)

    # 3. Rerank (TorchServe 경유)
    if passages:
        docs = [p.get("text", "") for p in passages]
        scores = _rerank_via_torchserve(message, docs)
        for passage, score in zip(passages, scores):
            passage["rerank_score"] = float(score)
            
        # 유사도 커트라인 적용 (ms-marco 기준 0.0 이하면 관련 없음으로 간주)
        RERANK_THRESHOLD = 0.0
        filtered_passages = [p for p in passages if p["rerank_score"] > RERANK_THRESHOLD]
        passages = sorted(filtered_passages, key=lambda x: x["rerank_score"], reverse=True)[:RERANK_TOP_K]

    # 4. Context 조립
    if not passages:
        context_str = "[참고 자료 없음] 검색된 관련 장소나 데이터가 데이터베이스에 없습니다."
        sources = []
        pois = []
    else:
        context_str, sources, pois = _build_context(passages)

    # 5. 대화 이력 구성
    history = _sessions[session_id][-MAX_HISTORY_TURNS * 2:]  # 최근 N턴

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({
        "role": "user",
        "content": f"""[참고 자료]
{context_str}

[사용자 질문]
{message}""",
    })

    # 6. Groq LLM 응답
    try:
        resp = _get_groq().chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        reply = resp.choices[0].message.content
    except Exception as e:
        reply = f"응답 생성 중 오류가 발생했습니다: {e}"

    # 이력 저장
    _sessions[session_id].append({"role": "user", "content": message})
    _sessions[session_id].append({"role": "assistant", "content": reply})

    # 이력 트리밍
    if len(_sessions[session_id]) > MAX_HISTORY_TURNS * 2:
        _sessions[session_id] = _sessions[session_id][-MAX_HISTORY_TURNS * 2:]

    return {
        "reply": reply,
        "sources": sources,
        "pois": pois,
    }


def reset_session(session_id: str):
    """세션 초기화"""
    _sessions.pop(session_id, None)
