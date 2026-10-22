from unittest.mock import Mock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from src.api import public_itinerary as module


@pytest.fixture
def endpoint(monkeypatch):
    monkeypatch.setenv('KRIDE_INTERNAL_TOKEN', 'contract-fixture')
    monkeypatch.setenv('KRIDE_AI_TEST_USERS', '7')
    generated = Mock(return_value={'status': 'ok', 'itinerary': [{'day': 1}]})
    monkeypatch.setattr(module, 'generate_public', generated)
    app = FastAPI()
    app.include_router(module.router)
    return TestClient(app), generated


HEADERS = {'X-Kride-Token': 'contract-fixture', 'X-Kride-User': '7'}
BODY = {'duration': '당일치기', 'regions': ['서울'], 'artists': ['BTS'], 'purposes': ['문화체험'], 'budget': {'min': 30000, 'max': 200000}, 'responseLocale': 'ja'}


@pytest.mark.parametrize('consent', [None, False])
def test_missing_or_false_consent_rejected_before_generation(endpoint, consent):
    client, generated = endpoint
    body = dict(BODY)
    if consent is not None:
        body['acknowledgeUnverifiedConditions'] = consent
    result = client.post('/api/public/itinerary', json=body, headers=HEADERS)
    assert result.status_code == 422
    assert result.json()['detail']['code'] == 'consent_required'
    generated.assert_not_called()


def test_explicit_consent_preserves_full_contract(endpoint):
    client, generated = endpoint
    body = {**BODY, 'acknowledgeUnverifiedConditions': True}
    result = client.post('/api/public/itinerary', json=body, headers=HEADERS)
    assert result.status_code == 200
    req, identity = generated.call_args.args
    assert req.model_dump() == body
    assert identity == '7'


@pytest.mark.parametrize('change', [{'regions': ['부산']}, {'duration': '1박2일'}, {'regions': []}, {'regions': ['서울', '제주']}])
def test_unsupported_conditions_are_not_silently_rewritten(endpoint, change):
    client, generated = endpoint
    result = client.post('/api/public/itinerary', json={**BODY, **change, 'acknowledgeUnverifiedConditions': True}, headers=HEADERS)
    assert result.status_code == 422
    assert result.json()['detail']['code'] == 'unsupported_conditions'
    generated.assert_not_called()


@pytest.mark.parametrize('consent', ['true', 1, 'false'])
def test_coerced_consent_is_not_accepted(endpoint, consent):
    client, generated = endpoint
    result = client.post('/api/public/itinerary', json={**BODY, 'acknowledgeUnverifiedConditions': consent}, headers=HEADERS)
    assert result.status_code == 422
    assert isinstance(result.json()['detail'], list)
    generated.assert_not_called()


@pytest.mark.parametrize('headers,status', [({}, 401), ({**HEADERS, 'X-Kride-User': '8'}, 403)])
def test_auth_rejection_does_not_generate(endpoint, headers, status):
    client, generated = endpoint
    assert client.post('/api/public/itinerary', json={**BODY, 'acknowledgeUnverifiedConditions': True}, headers=headers).status_code == status
    generated.assert_not_called()
