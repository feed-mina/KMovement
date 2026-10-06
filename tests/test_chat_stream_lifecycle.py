"""F13 lifecycle contracts with synthetic provider output; no paid calls."""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient


def test_provider_stream_closes_when_consumer_stops(monkeypatch):
    from src.api import rag_client as rag
    monkeypatch.setattr(rag, '_check_groq_breaker', lambda: None)
    monkeypatch.setattr(rag, 'search_chat_context', lambda *a, **k: [])
    chunk=SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content='token'))])
    class Provider:
        close=Mock()
        def __iter__(self): return iter([chunk,chunk])
    provider=Provider()
    monkeypatch.setattr(rag,'get_groq',lambda:SimpleNamespace(chat=SimpleNamespace(
        completions=SimpleNamespace(create=lambda **k:provider))))
    tokens=rag.generate_chat_answer_stream('fixture question')
    assert next(tokens)=='token'
    tokens.close()
    provider.close.assert_called_once()


@pytest.mark.parametrize('fails',[False,True])
def test_event_order_completion_and_error_are_explicit(monkeypatch,fails):
    from src.api import fastapi_server as api
    closed=[]
    def generate(*a,**k):
        try:
            yield 'first'
            if fails: raise RuntimeError('private provider detail')
            yield 'second'
        finally:closed.append(True)
    monkeypatch.setattr(api,'generate_chat_answer_stream',generate)
    monkeypatch.setattr(api,'_build_graphrag_chat_context',lambda *_:'')
    response=TestClient(api.app).post('/api/chat/stream',json={'message':'fixture question'})
    assert response.status_code==200
    assert response.headers['x-accel-buffering']=='no'
    assert response.text.count('data: [DONE]')==1
    assert response.text.index('first')<response.text.index('[DONE]')
    assert ('generation_failed' in response.text)==fails
    assert 'private provider detail' not in response.text
    assert closed==[True]
