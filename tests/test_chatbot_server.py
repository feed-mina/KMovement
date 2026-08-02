"""
test_chatbot_server.py — 챗봇 서버 + 체인 + 멀티쿼리 + 리랭커 테스트
==================================================================
실행:
    cd D:/kride-project
    pytest tests/test_chatbot_server.py -v

외부 의존성(Groq, ChromaDB, SentenceTransformer, CrossEncoder)은
모두 stub/mock 처리 — 서버 없이 실행 가능.
"""


from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch, PropertyMock
from collections import defaultdict

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# 외부 패키지 stub
# ─────────────────────────────────────────────────────────────────────────────
def _stub(name: str):
    if name not in sys.modules:
        mod = types.ModuleType(name)
        sys.modules[name] = mod
    return sys.modules[name]


for _pkg in [
    "chromadb",
    "groq",
    "sentence_transformers",
    "langchain_community",
    "langchain_community.document_loaders",
    "langchain_text_splitters",
]:
    _stub(_pkg)

# CrossEncoder stub
_st = sys.modules["sentence_transformers"]
_st.CrossEncoder = MagicMock
_st.SentenceTransformer = MagicMock

# Groq stub
_groq_mod = sys.modules["groq"]
_groq_mod.Groq = MagicMock


# ─────────────────────────────────────────────────────────────────────────────
# chatbot.config stub (chatbot 패키지 설정 오버라이드)
# ─────────────────────────────────────────────────────────────────────────────
_config_mod = types.ModuleType("chatbot.config")
_config_mod.CHROMA_PATH = "/tmp/chroma_test"
# chatbot_chain 이 로컬 경로 대신 원격 Chroma 로 옮겨 가면서 CHROMA_HOST/PORT 와
# TORCHSERVE_URL 을 읽기 시작했다. stub 이 따라가지 않아 이 파일은 수집 단계에서
# 죽어 있었다 — 아래 test_chatbot_config_stub_covers_what_the_chain_imports 가
# 다음번 표류를 잡는다.
_config_mod.CHROMA_HOST = "localhost"
_config_mod.CHROMA_PORT = 8100
_config_mod.TORCHSERVE_URL = "http://localhost:8085"
_config_mod.PDF_DIR = "/tmp/pdf_test"
_config_mod.MODELS_DIR = "/tmp/models_test"
_config_mod.PDF_COLLECTION = "test_pdf"
_config_mod.POI_COLLECTIONS = ["test_poi_1"]
_config_mod.EMBED_MODEL = "test-model"
_config_mod.GROQ_MODEL = "test-groq"
_config_mod.RERANKER_MODEL = "test-reranker"
_config_mod.CHUNK_SIZE = 100
_config_mod.CHUNK_OVERLAP = 20
_config_mod.MAX_HISTORY_TURNS = 3
_config_mod.MULTI_QUERY_COUNT = 2
_config_mod.RETRIEVE_TOP_K_PDF = 3
_config_mod.RETRIEVE_TOP_K_POI = 2
_config_mod.RERANK_TOP_K = 5
_config_mod.GROQ_API_KEY = "test-key"

# chatbot 패키지 stub
_chatbot_pkg = types.ModuleType("chatbot")
_chatbot_pkg.__path__ = []
sys.modules["chatbot"] = _chatbot_pkg
sys.modules["chatbot.config"] = _config_mod


# ─────────────────────────────────────────────────────────────────────────────
# chatbot 모듈 import (stub 후)
# ─────────────────────────────────────────────────────────────────────────────
import importlib.util, os

_NLP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "subproject", "NLP")

def _load_chatbot_module(name: str, filename: str):
    path = os.path.join(_NLP_DIR, "chatbot", filename)
    spec = importlib.util.spec_from_file_location(f"chatbot.{name}", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[f"chatbot.{name}"] = mod
    spec.loader.exec_module(mod)
    return mod


# 1) reranker
reranker_mod = _load_chatbot_module("reranker", "reranker.py")

# 2) multi_query
multi_query_mod = _load_chatbot_module("multi_query", "multi_query.py")

# 3) chatbot_chain
chain_mod = _load_chatbot_module("chatbot_chain", "chatbot_chain.py")

# 4) chatbot_server
server_mod = _load_chatbot_module("chatbot_server", "chatbot_server.py")


from fastapi.testclient import TestClient

app = server_mod.app
client = TestClient(app)


# ═════════════════════════════════════════════════════════════════════════════
# 1. Reranker 단위 테스트
# ═════════════════════════════════════════════════════════════════════════════
class TestReranker:
    def _make_reranker(self, scores):
        """mock 모델로 Reranker 생성"""
        r = reranker_mod.Reranker.__new__(reranker_mod.Reranker)
        r.model_name = "test"
        mock_model = MagicMock()
        mock_model.predict.return_value = scores
        r._model = mock_model
        return r

    def test_empty_passages(self):
        r = self._make_reranker([])
        assert r.rerank("test query", []) == []

    def test_rerank_returns_top_k(self):
        passages = [{"text": f"doc {i}"} for i in range(5)]
        scores = [0.1, 0.9, 0.5, 0.3, 0.7]
        r = self._make_reranker(scores)
        result = r.rerank("query", passages, top_k=3)
        assert len(result) == 3

    def test_rerank_sorted_by_score(self):
        passages = [{"text": "low"}, {"text": "high"}, {"text": "mid"}]
        scores = [0.1, 0.9, 0.5]
        r = self._make_reranker(scores)
        result = r.rerank("query", passages, top_k=3)
        assert result[0]["text"] == "high"
        assert result[-1]["text"] == "low"

    def test_rerank_adds_score_field(self):
        passages = [{"text": "doc"}]
        r = self._make_reranker([0.75])
        result = r.rerank("query", passages, top_k=1)
        assert "rerank_score" in result[0]
        assert result[0]["rerank_score"] == 0.75

    def test_rerank_custom_text_key(self):
        passages = [{"content": "doc"}]
        r = self._make_reranker([0.5])
        r.rerank("query", passages, text_key="content", top_k=1)
        r._model.predict.assert_called_once()
        call_args = r._model.predict.call_args[0][0]
        assert call_args[0] == ("query", "doc")


# ═════════════════════════════════════════════════════════════════════════════
# 2. Multi-Query 단위 테스트
# ═════════════════════════════════════════════════════════════════════════════
class TestMultiQuery:
    def test_no_api_key_returns_original(self):
        """GROQ_API_KEY 없으면 원본만 반환"""
        original_key = _config_mod.GROQ_API_KEY
        _config_mod.GROQ_API_KEY = ""
        multi_query_mod.GROQ_API_KEY = ""
        try:
            result = multi_query_mod.generate_query_variants("서울 맛집 추천")
            assert result == ["서울 맛집 추천"]
        finally:
            _config_mod.GROQ_API_KEY = original_key
            multi_query_mod.GROQ_API_KEY = original_key

    def test_includes_original_query(self):
        """반환 리스트 첫 번째는 항상 원본 쿼리"""
        mock_resp = MagicMock()
        mock_resp.choices[0].message.content = "Seoul restaurant recommendations\nBest places to eat in Seoul"
        mock_groq = MagicMock()
        mock_groq.chat.completions.create.return_value = mock_resp
        # GROQ_API_KEY가 설정되어 있어야 Groq 호출을 시도함
        multi_query_mod.GROQ_API_KEY = "test-key"
        multi_query_mod._groq = mock_groq
        try:
            result = multi_query_mod.generate_query_variants("서울 맛집")
            assert result[0] == "서울 맛집"
            assert len(result) >= 2
        finally:
            multi_query_mod._groq = None
            multi_query_mod.GROQ_API_KEY = _config_mod.GROQ_API_KEY

    def test_groq_exception_returns_original(self):
        """Groq 호출 실패 시 원본만 반환"""
        mock_groq = MagicMock()
        mock_groq.chat.completions.create.side_effect = Exception("API 오류")
        multi_query_mod._groq = mock_groq
        try:
            result = multi_query_mod.generate_query_variants("제주 여행")
            assert result == ["제주 여행"]
        finally:
            multi_query_mod._groq = None

    def test_variants_capped_at_count(self):
        """변형 수가 MULTI_QUERY_COUNT 이하"""
        mock_resp = MagicMock()
        mock_resp.choices[0].message.content = "변형1\n변형2\n변형3\n변형4\n변형5"
        mock_groq = MagicMock()
        mock_groq.chat.completions.create.return_value = mock_resp
        multi_query_mod._groq = mock_groq
        try:
            result = multi_query_mod.generate_query_variants("테스트")
            # 원본 + 최대 MULTI_QUERY_COUNT 변형
            assert len(result) <= 1 + _config_mod.MULTI_QUERY_COUNT
        finally:
            multi_query_mod._groq = None


# ═════════════════════════════════════════════════════════════════════════════
# 3. chatbot_chain 단위 테스트
# ═════════════════════════════════════════════════════════════════════════════
class TestChatbotChain:
    def test_build_context_pdf_source(self):
        passages = [{
            "text": "서울은 한국의 수도입니다.",
            "source_type": "pdf",
            "metadata": {"source_pdf": "travel_guide.pdf", "page": 3},
            "collection": "kride_pdf_knowledge",
        }]
        ctx, sources, pois = chain_mod._build_context(passages)
        assert "서울은 한국의 수도" in ctx
        assert "travel_guide.pdf" in sources
        assert pois == []

    def test_build_context_poi_source(self):
        passages = [{
            "text": "경복궁은 조선시대 궁궐입니다.",
            "source_type": "poi",
            "metadata": {"name": "경복궁", "address": "서울 종로구", "category": "kculture", "lat": 37.58, "lon": 126.97},
            "collection": "kride_poi_kculture",
        }]
        ctx, sources, pois = chain_mod._build_context(passages)
        assert len(pois) == 1
        assert pois[0]["name"] == "경복궁"
        assert pois[0]["lat"] == 37.58

    def test_build_context_empty(self):
        ctx, sources, pois = chain_mod._build_context([])
        assert ctx == ""
        assert sources == []
        assert pois == []

    def test_build_context_mixed_sources(self):
        passages = [
            {"text": "PDF 내용", "source_type": "pdf", "metadata": {"source_pdf": "guide.pdf"}, "collection": "pdf"},
            {"text": "POI 내용", "source_type": "poi", "metadata": {"name": "남산타워"}, "collection": "poi_col"},
        ]
        ctx, sources, pois = chain_mod._build_context(passages)
        assert len(sources) == 2
        assert len(pois) == 1

    def test_reset_session(self):
        chain_mod._sessions["test_session"] = [{"role": "user", "content": "hi"}]
        chain_mod.reset_session("test_session")
        assert "test_session" not in chain_mod._sessions

    def test_reset_nonexistent_session(self):
        chain_mod.reset_session("nonexistent")  # 예외 없이 통과

    def test_chat_pipeline(self):
        """chat() 전체 파이프라인 mock 테스트"""
        mock_col = MagicMock()
        mock_col.query.return_value = {
            "documents": [["서울 맛집 정보"]],
            "metadatas": [[{"name": "광장시장", "address": "서울 종로구", "category": "food"}]],
            "distances": [[0.3]],
        }
        mock_chroma = MagicMock()
        mock_chroma.get_collection.return_value = mock_col

        mock_groq_resp = MagicMock()
        mock_groq_resp.choices[0].message.content = "광장시장을 추천합니다!"
        mock_groq = MagicMock()
        mock_groq.chat.completions.create.return_value = mock_groq_resp

        # 싱글턴 교체
        chain_mod._chroma = mock_chroma
        chain_mod._groq = mock_groq

        # 임베딩과 리랭킹은 TorchServe HTTP 호출이다. 로컬 싱글턴을 대신 넣으면
        # 실제 요청이 나가 localhost:8085 로 붙으려다 죽는다.
        with patch.object(chain_mod, "_embed_texts", return_value=[[0.1] * 384]), \
                patch.object(chain_mod, "_rerank_via_torchserve", side_effect=lambda q, docs: [1.0] * len(docs)), \
                patch.object(multi_query_mod, "generate_query_variants", return_value=["서울 맛집"]):
            result = chain_mod.chat("서울 맛집 추천해줘", session_id="test_pipe")

        assert "reply" in result
        assert "sources" in result
        assert "pois" in result
        assert result["reply"] == "광장시장을 추천합니다!"

        # cleanup
        chain_mod._chroma = None
        chain_mod._groq = None
        chain_mod._sessions.clear()

    def test_chat_groq_failure(self):
        """Groq 호출 실패 시 오류 메시지 반환"""
        mock_chroma = MagicMock()
        mock_chroma.get_collection.side_effect = Exception("컬렉션 없음")

        mock_groq = MagicMock()
        mock_groq.chat.completions.create.side_effect = Exception("Groq 서버 오류")

        chain_mod._chroma = mock_chroma
        chain_mod._groq = mock_groq

        with patch.object(chain_mod, "_embed_texts", return_value=[[0.1] * 384]), \
                patch.object(multi_query_mod, "generate_query_variants", return_value=["test"]):
            result = chain_mod.chat("test", session_id="fail_test")

        assert "오류" in result["reply"]

        chain_mod._chroma = None
        chain_mod._groq = None
        chain_mod._sessions.clear()

    def test_session_history_trimming(self):
        """MAX_HISTORY_TURNS 이상이면 트리밍"""
        mock_chroma = MagicMock()
        mock_chroma.get_collection.side_effect = Exception("no col")
        mock_groq_resp = MagicMock()
        mock_groq_resp.choices[0].message.content = "응답"
        mock_groq = MagicMock()
        mock_groq.chat.completions.create.return_value = mock_groq_resp

        chain_mod._chroma = mock_chroma
        chain_mod._groq = mock_groq

        sid = "trim_test"
        # MAX_HISTORY_TURNS=3 → 최대 6개 메시지
        with patch.object(chain_mod, "_embed_texts", return_value=[[0.1] * 384]), \
                patch.object(multi_query_mod, "generate_query_variants", return_value=["q"]):
            for i in range(5):
                chain_mod.chat(f"msg {i}", session_id=sid)

        assert len(chain_mod._sessions[sid]) <= _config_mod.MAX_HISTORY_TURNS * 2

        chain_mod._chroma = None
        chain_mod._groq = None
        chain_mod._sessions.clear()


# ═════════════════════════════════════════════════════════════════════════════
# 4. 챗봇 서버 엔드포인트 테스트
# ═════════════════════════════════════════════════════════════════════════════
class TestChatbotServer:
    def test_health(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "kride-chatbot"
        assert "active_sessions" in body

    def test_chat_endpoint(self):
        """POST /chat → 정상 응답"""
        mock_result = {"reply": "테스트 답변", "sources": ["guide.pdf"], "pois": []}
        server_mod._session_meta.clear()
        with patch.object(server_mod, "chat", return_value=mock_result):
            resp = client.post("/chat", json={
                "message": "서울 추천해줘",
                "session_id": "s1",
                "user_id": "u1",
            })
        assert resp.status_code == 200
        body = resp.json()
        assert body["reply"] == "테스트 답변"
        assert body["user_id"] == "u1"
        assert body["timestamp"] != ""
        assert body["session_started_at"] != ""
        server_mod._session_meta.clear()

    def test_chat_default_fields(self):
        """기본값으로 요청"""
        mock_result = {"reply": "ok", "sources": [], "pois": []}
        server_mod._session_meta.clear()
        with patch.object(server_mod, "chat", return_value=mock_result):
            resp = client.post("/chat", json={"message": "hello"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == "anonymous"
        server_mod._session_meta.clear()

    def test_chat_missing_message_422(self):
        """message 필드 누락 → 422"""
        resp = client.post("/chat", json={})
        assert resp.status_code == 422

    def test_chat_session_tracking(self):
        """세션 메타 추적 — 첫 요청 시 started_at 기록"""
        server_mod._session_meta.clear()
        mock_result = {"reply": "r", "sources": [], "pois": []}
        with patch.object(server_mod, "chat", return_value=mock_result):
            resp1 = client.post("/chat", json={"message": "1", "session_id": "track"})
            resp2 = client.post("/chat", json={"message": "2", "session_id": "track"})

        assert resp1.json()["session_started_at"] == resp2.json()["session_started_at"]
        server_mod._session_meta.clear()

    def test_reset_endpoint(self):
        """POST /chat/reset → 세션 초기화"""
        server_mod._session_meta["reset_test"] = {
            "user_id": "u1",
            "started_at": "2026-01-01T00:00:00+09:00",
            "ended_at": None,
        }
        with patch.object(server_mod, "reset_session") as mock_reset:
            resp = client.post("/chat/reset", json={
                "session_id": "reset_test",
                "user_id": "u1",
            })
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["session_ended_at"] is not None
        mock_reset.assert_called_once_with("reset_test")

    def test_reset_nonexistent_session(self):
        """존재하지 않는 세션 리셋 → 200"""
        with patch.object(server_mod, "reset_session"):
            resp = client.post("/chat/reset", json={"session_id": "unknown"})
        assert resp.status_code == 200


# ═════════════════════════════════════════════════════════════════════════════
# 5. stub 표류 감지
# ═════════════════════════════════════════════════════════════════════════════
def test_chatbot_config_stub_covers_what_the_chain_imports():
    """chatbot.config stub 이 실제 모듈과 어긋나면 수집 단계에서 죽는다.

    chatbot_chain 이 원격 Chroma·TorchServe 로 옮겨 가며 CHROMA_HOST / CHROMA_PORT /
    TORCHSERVE_URL 을 읽기 시작했는데 stub 이 따라가지 않아, 이 파일 전체가
    ImportError 로 수집되지 못한 채 한동안 방치됐다. 파일이 통째로 빠지면 실패가
    아니라 "테스트가 없는 것"으로 보여 눈에 띄지 않는다.

    stub 을 진짜 모듈과 대조해 다음 표류를 이름으로 짚어 준다.
    """
    import ast
    from pathlib import Path

    chatbot_dir = Path(_NLP_DIR) / "chatbot"

    # 진짜 config 는 여기서 import 할 수 없다(위에서 stub 으로 덮어썼다).
    # 소스에서 최상위 대입 이름을 읽는다.
    real_names = {
        target.id
        for node in ast.parse((chatbot_dir / "config.py").read_text(encoding="utf-8")).body
        if isinstance(node, ast.Assign)
        for target in node.targets
        if isinstance(target, ast.Name) and not target.id.startswith("_")
    }

    # chatbot.config 에서 실제로 가져다 쓰는 이름만 요구한다. 설정 전부를
    # 베끼라고 하면 stub 이 무의미하게 커진다.
    imported: set[str] = set()
    for source in chatbot_dir.glob("*.py"):
        for node in ast.parse(source.read_text(encoding="utf-8")).body:
            if isinstance(node, ast.ImportFrom) and node.module == "chatbot.config":
                imported.update(alias.name for alias in node.names)

    assert imported, "chatbot.config 를 쓰는 모듈을 찾지 못했다"
    missing = sorted(name for name in imported if not hasattr(_config_mod, name))
    assert not missing, f"stub 에 없는 설정: {missing}"

    # 진짜 config 에 없는 이름을 stub 이 들고 있으면, 지워진 설정을 계속 쓰는
    # 코드를 테스트가 통과시킨다.
    stale = sorted(name for name in imported if name not in real_names)
    assert not stale, f"진짜 config 에 없는 설정: {stale}"
