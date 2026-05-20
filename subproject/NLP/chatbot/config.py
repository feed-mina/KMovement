"""chatbot/config.py — 공통 설정"""
from __future__ import annotations
import os
from pathlib import Path

# ── 경로 ──────────────────────────────────────────────────────────────────────
_THIS_DIR = Path(__file__).resolve().parent                    # subproject/NLP/chatbot
PROJECT_ROOT = _THIS_DIR.parent.parent.parent                  # kride-project/

CHROMA_PATH = str(PROJECT_ROOT / "chroma_db")                  # 기존 chroma_db 재사용
PDF_DIR = str(PROJECT_ROOT / "dataset" / "pdf")
MODELS_DIR = str(PROJECT_ROOT / "models")

# ── ChromaDB 컬렉션 ──────────────────────────────────────────────────────────
PDF_COLLECTION = "kride_pdf_knowledge"                         # 신규 (기존 4개와 분리)
POI_COLLECTIONS = [
    "kride_poi_kculture",
    "kride_poi_food",
    "kride_poi_nature",
    "kride_poi_history",
]

# ── 임베딩 / LLM ─────────────────────────────────────────────────────────────
EMBED_MODEL = "intfloat/multilingual-e5-small"                 # 384-dim, 기존과 동일
GROQ_MODEL = "openai/gpt-oss-120b"

# ── 리랭커 ────────────────────────────────────────────────────────────────────
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"        # CPU 환경 채택 (3.5s vs BGE 96s)

# ── 청크 설정 ─────────────────────────────────────────────────────────────────
CHUNK_SIZE = 800
CHUNK_OVERLAP = 200

# ── 챗봇 ─────────────────────────────────────────────────────────────────────
MAX_HISTORY_TURNS = 10
MULTI_QUERY_COUNT = 3                                          # 원본 + 3 변형 = 4 쿼리
RETRIEVE_TOP_K_PDF = 10                                        # PDF 컬렉션 쿼리당
RETRIEVE_TOP_K_POI = 5                                         # POI 컬렉션 쿼리당
RERANK_TOP_K = 10                                              # 리랭킹 후 상위 K개

# ── 환경변수 키 ───────────────────────────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
