from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api import public_itinerary as module
from src.api.course_context import issue_context


def setup(monkeypatch):
    monkeypatch.setenv('KRIDE_INTERNAL_TOKEN', 'fixture-internal-' * 4)
    monkeypatch.setenv('KRIDE_COURSE_SIGNING_KEY', 'fixture-signing-' * 4)
    monkeypatch.setenv('KRIDE_AI_TEST_USERS', '1,2')
    catalog = {'poi:17': {'id': 'poi:17', 'name': '서울 시험 장소', 'address': '서울 시험 주소', 'lat': 37.5, 'lon': 127.0}}
    monkeypatch.setattr(module, 'public_catalog', lambda: catalog)
    app = FastAPI()
    app.include_router(module.router)
    token = issue_context('1', ['poi:17'], catalog)['courseContext']
    return TestClient(app), catalog, token


def auth(user='1'):
    return {'X-Kride-Token': 'fixture-internal-' * 4, 'X-Kride-User': user}


def test_signed_course_snapshot_is_stable_and_retains_official_ids(monkeypatch):
    client, _, token = setup(monkeypatch)
    body = {'courseContext': token, 'poiId': 'poi:17'}
    response = client.post('/api/public/itinerary/video-context', json=body, headers=auth())
    assert response.status_code == 200
    assert response.json()['poiId'] == 'poi:17'
    assert len(response.json()['itineraryId']) == 32
    assert response.json() == client.post('/api/public/itinerary/video-context', json=body, headers=auth()).json()


def test_wrong_owner_tampering_unknown_place_and_revocation(monkeypatch):
    client, catalog, token = setup(monkeypatch)
    endpoint = '/api/public/itinerary/video-context'
    body = {'courseContext': token, 'poiId': 'poi:17'}
    assert client.post(endpoint, json=body).status_code == 401
    assert client.post(endpoint, json=body, headers=auth('2')).status_code == 409
    assert client.post(endpoint, json={**body, 'courseContext': 'tampered' + token}, headers=auth()).status_code == 409
    assert client.post(endpoint, json={**body, 'poiId': 'other:123'}, headers=auth()).status_code == 422
    catalog['poi:17']['address'] = 'changed branch'
    assert client.post(endpoint, json=body, headers=auth()).status_code == 409


def test_cpu_deployment_includes_the_context_endpoint(monkeypatch):
    setup(monkeypatch)
    from src.api.cpu_app import app
    client = TestClient(app)
    response = client.post('/api/public/itinerary/video-context', json={'courseContext': 'fixture', 'poiId': 'poi:17'})
    assert response.status_code == 401
