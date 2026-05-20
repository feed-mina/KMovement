"""
pdf_ingest.py — PDF 로드 → 청크 → ChromaDB 인덱싱
=================================================
실행:
    cd subproject/NLP && python -m chatbot.pdf_ingest

결과:
    chroma_db/"kride_pdf_knowledge" 컬렉션에 ~1000-3600 chunks
"""
from __future__ import annotations

import glob
import os
import sys

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import chromadb
from sentence_transformers import SentenceTransformer

from chatbot.config import (
    CHROMA_PATH,
    PDF_DIR,
    PDF_COLLECTION,
    EMBED_MODEL,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)

#  langchain의 community에서document_loaders 의 pyPDFLoader (PDF 를 로더) -> 
# langchain_Text_splitter의 RecursiveCharacterTextSplitter( 청크 분할) 
# SentenceTransformer 임베딩 모델
def load_pdfs(pdf_dir: str) -> list:
    """PDF_DIR 내 모든 .pdf 파일을 LangChain Document로 로드"""
    pdf_paths = sorted(glob.glob(os.path.join(pdf_dir, "*.pdf")))
    if not pdf_paths:
        print(f"[pdf_ingest] PDF 파일 없음: {pdf_dir}")
        return []

    print(f"[pdf_ingest] {len(pdf_paths)}개 PDF 발견")
    all_docs = []
    for path in pdf_paths:
        fname = os.path.basename(path)
        try:
            loader = PyPDFLoader(path)
            docs = loader.load()
            for doc in docs:
                doc.metadata["source_pdf"] = fname
            all_docs.extend(docs)
            print(f"  ✓ {fname}: {len(docs)} pages")
        except Exception as e:
            print(f"  ✗ {fname}: {e}")
    return all_docs


def chunk_documents(docs: list) -> list:
    """RecursiveCharacterTextSplitter로 청크 분할"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(docs)
    print(f"[pdf_ingest] 총 {len(chunks)} chunks 생성 (chunk_size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})")
    return chunks


def build_chunk_id(source_pdf: str, page: int, chunk_idx: int) -> str:
    """청크 ID 생성: {filename}_p{page}_c{chunk}"""
    stem = os.path.splitext(source_pdf)[0]
    # 파일명에서 특수문자 제거 (ChromaDB ID 안전)
    safe = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in stem)
    return f"{safe}_p{page}_c{chunk_idx}"


def ingest(batch_size: int = 100):
    """메인 인덱싱 파이프라인"""
    # 1. PDF 로드
    docs = load_pdfs(PDF_DIR)
    if not docs:
        return

    # 2. 청크 분할
    chunks = chunk_documents(docs)
    if not chunks:
        return

    # 3. 임베딩 모델 로드
    print(f"[pdf_ingest] 임베딩 모델 로딩: {EMBED_MODEL}")
    embedder = SentenceTransformer(EMBED_MODEL)

    # 4. ChromaDB 클라이언트 + 컬렉션
    print(f"[pdf_ingest] ChromaDB 연결: {CHROMA_PATH}")
    client = chromadb.PersistentClient(path=CHROMA_PATH)

    # 기존 컬렉션 있으면 삭제 후 재생성 (전체 재인덱싱)
    try:
        client.delete_collection(PDF_COLLECTION)
        print(f"[pdf_ingest] 기존 '{PDF_COLLECTION}' 컬렉션 삭제")
    except Exception:
        pass
    collection = client.create_collection(
        name=PDF_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    # 5. 배치 upsert
    # 페이지별 chunk 카운터
    page_chunk_counter: dict[tuple[str, int], int] = {}
    total = 0

    ids_batch: list[str] = []
    docs_batch: list[str] = []
    embeddings_batch: list[list[float]] = []
    metadatas_batch: list[dict] = []

    for chunk in chunks:
        source_pdf = chunk.metadata.get("source_pdf", "unknown")
        page = chunk.metadata.get("page", 0)
        key = (source_pdf, page)
        page_chunk_counter[key] = page_chunk_counter.get(key, 0) + 1
        chunk_idx = page_chunk_counter[key]

        chunk_id = build_chunk_id(source_pdf, page, chunk_idx)
        text = str(chunk.page_content or "").strip()
        if not text or len(text) < 10:
            continue

        try:
            embedding = embedder.encode(text, normalize_embeddings=True).tolist()
        except Exception as e:
            print(f"  [SKIP] 임베딩 실패 (chunk {chunk_id}): {e}")
            continue

        ids_batch.append(chunk_id)
        docs_batch.append(text)
        embeddings_batch.append(embedding)
        metadatas_batch.append({
            "source_pdf": source_pdf,
            "page": page,
            "chunk_index": chunk_idx,
        })

        if len(ids_batch) >= batch_size:
            collection.upsert(
                ids=ids_batch,
                documents=docs_batch,
                embeddings=embeddings_batch,
                metadatas=metadatas_batch,
            )
            total += len(ids_batch)
            print(f"  [batch] {total} chunks upserted...")
            ids_batch, docs_batch, embeddings_batch, metadatas_batch = [], [], [], []

    # 잔여 배치
    if ids_batch:
        collection.upsert(
            ids=ids_batch,
            documents=docs_batch,
            embeddings=embeddings_batch,
            metadatas=metadatas_batch,
        )
        total += len(ids_batch)

    print(f"\n[pdf_ingest] 완료! '{PDF_COLLECTION}' 컬렉션에 {total} chunks 인덱싱됨")
    print(f"  ChromaDB 경로: {CHROMA_PATH}")


if __name__ == "__main__":
    ingest()
