"""Explicit public-only index refresh. No production DB or catalog writes."""
import json
from src.api.public_search import public_catalog,index_catalog
from src.api.rag_client import get_chroma
from src.api.torchserve_client import embed_texts_sync,EMBED_MODEL
if __name__=='__main__':
    print(json.dumps(index_catalog(get_chroma(),embed_texts_sync,public_catalog(),EMBED_MODEL),ensure_ascii=False))
