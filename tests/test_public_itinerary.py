import os
from types import SimpleNamespace
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from src.api.public_itinerary import router,ground_plan
from src.api.itinerary_budget import reserve_budget,record_usage


@pytest.mark.parametrize('raw', [None, [], {'itinerary':None}, {'itinerary':{}},
    {'itinerary':[None, {'morning':{'places':None}}]},
    {'itinerary':[{'morning':{'places':[{'poiId':[]},{'poiId':{}},None]}}]}])
def test_malformed_generated_values_never_escape_grounding(raw):
    result=ground_plan(raw, {})
    assert result['itinerary']==[]
    assert result['resolvedMarkerCount']==0


@pytest.mark.parametrize('field', ['artists','regions','purposes'])
def test_oversized_conditions_rejected_before_catalog_lookup(field):
    from src.api.public_itinerary import PublicItineraryRequest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):PublicItineraryRequest(**{field:['x'*101]})


def test_fixed_evaluation_preserves_days_sources_and_marker_count():
    # Synthetic fixed catalog: regression evidence, not live recommendation quality.
    source={key:{'id':key,'name':key,'address':'서울','lat':37.5,'lon':127}
            for key in ('a','b','c')}
    raw={'itinerary':[
        {'morning':{'places':[{'poiId':'a'},{'poiId':'invented'}]},'evening':{'places':[{'poiId':'b'}]}},
        {'afternoon':{'places':[{'poiId':'a'},{'poiId':'c'}]}},
        {'morning':{'places':[{'poiId':'extra'}]}}]}
    result=ground_plan(raw,source,max_days=2)
    assert [d['day'] for d in result['itinerary']]==[1,2]
    assert [m['id'] for m in result['mapData']['markers']]==['a','b','c']
    assert result['resolvedMarkerCount']==3
    assert result['rejectedPlaceCount']==2

def test_grounding_discards_invented_and_duplicate_places_and_coordinates():
    source={'a':{'id':'a','name':'공개 장소','address':'서울','lat':37.5,'lon':127}}
    raw={'itinerary':[{'morning':{'places':[{'poiId':'a','name':'거짓 이름','lat':0},{'poiId':'fake'},{'poiId':'a'}]}}]}
    result=ground_plan(raw,source)
    assert result['resolvedMarkerCount']==1 and result['rejectedPlaceCount']==2
    assert result['mapData']['markers'][0]['name']=='공개 장소'
    assert result['mapData']['markers'][0]['lat']==37.5
    assert ground_plan(raw,{})['itinerary']==[]

def test_budget_is_persistent_and_atomic(tmp_path,monkeypatch):
    for key,value in {'ITINERARY_BUDGET_DB':str(tmp_path/'ledger.sqlite'),'ITINERARY_INPUT_USD_PER_M':'1','ITINERARY_OUTPUT_USD_PER_M':'1','ITINERARY_DAILY_USD':'0.003'}.items():monkeypatch.setenv(key,value)
    def reserve():
        try:return reserve_budget('7',1000,1000)
        except RuntimeError:return None
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:reserve(),range(2)))
    successful=[r for r in results if r];assert len(successful)==1
    usage=record_usage(successful[0],SimpleNamespace(prompt_tokens=100,completion_tokens=100))
    assert usage['estimatedCostUsd']==.0002
    with pytest.raises(RuntimeError,match='exhausted'):reserve_budget('8',1000,1000)

def test_internal_auth_and_empty_result(monkeypatch):
    from src.api import public_itinerary as module
    app=FastAPI();app.include_router(router);client=TestClient(app)
    monkeypatch.setenv('KRIDE_INTERNAL_TOKEN','fixture-only')
    monkeypatch.setenv('KRIDE_AI_TEST_USERS','7')
    assert client.post('/api/public/itinerary',json={}).status_code==401
    monkeypatch.setattr(module,'generate_public',lambda *_:{'itinerary':[],'status':'empty_candidates'})
    r=client.post('/api/public/itinerary',json={'regions':['서울']},headers={'X-Kride-Token':'fixture-only','X-Kride-User':'7'})
    assert r.status_code==200 and r.json()['status']=='empty_candidates'

def test_empty_candidates_never_load_paid_client(monkeypatch):
    from src.api import public_itinerary as module
    from src.api import rag_client
    monkeypatch.setattr(module,'public_catalog',lambda:{})
    monkeypatch.setattr(module,'search_public',lambda *_:[])
    monkeypatch.setattr(rag_client,'get_chroma',lambda:object())
    monkeypatch.delenv('GROQ_API_KEY',raising=False)
    assert module.generate_public(module.PublicItineraryRequest(),'7')['usage'] is None

def test_full_generation_rechecks_approval_and_records_usage(tmp_path,monkeypatch):
    monkeypatch.setenv('KRIDE_AI_MODEL','fixture-model')
    import groq
    from src.api import public_itinerary as module,rag_client
    source={'a':{'id':'a','name':'공개 장소','address':'서울','lat':37.5,'lon':127},'b':{'id':'b','name':'취소 예정','address':'서울','lat':37.6,'lon':127}}
    calls=iter([source,{'a':source['a']}])
    monkeypatch.setattr(module,'public_catalog',lambda:next(calls))
    monkeypatch.setattr(module,'search_public',lambda *_:list(source.values()))
    monkeypatch.setattr(rag_client,'get_chroma',lambda:object())
    response=SimpleNamespace(usage=SimpleNamespace(prompt_tokens=100,completion_tokens=50),choices=[SimpleNamespace(message=SimpleNamespace(content='{"itinerary":[{"morning":{"places":[{"poiId":"a"},{"poiId":"b"},{"poiId":"invented"}]}}]}'))])
    monkeypatch.setattr(groq,'Groq',lambda **_:SimpleNamespace(close=lambda:None,chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_:response))))
    for key,value in {'GROQ_API_KEY':'fixture','ITINERARY_BUDGET_DB':str(tmp_path/'usage.sqlite'),'ITINERARY_INPUT_USD_PER_M':'1','ITINERARY_OUTPUT_USD_PER_M':'1','ITINERARY_DAILY_USD':'1'}.items():monkeypatch.setenv(key,value)
    result=module.generate_public(module.PublicItineraryRequest(regions=['서울']),'7')
    assert result['resolvedMarkerCount']==1 and result['rejectedPlaceCount']==2
    assert result['sourcePoiCount']==1 and result['usage']['inputTokens']==100

def test_cpu_entrypoint_exposes_only_selected_features():
    from src.api.cpu_app import app
    client=TestClient(app)
    assert client.post('/api/public/itinerary',json={}).status_code==401
    assert client.get('/api/users/7/route-history').status_code==404
    assert client.post('/jobs/celery/embed',json={'texts':['x']}).status_code==404
