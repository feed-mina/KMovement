import chromadb
import pytest
from src.api.public_search import index_catalog,search_public

def embed(texts):
    return [[1.,0.,0.] if '서울' in t else [0.,1.,0.] for t in texts]

def item(i,name,address):
    return dict(id=i,poi_id=i,name=name,address=address,artist='',lat=37.5,lon=127.,sourceUrl='https://example.test/'+i,verifiedAt='2026-10-05',visibility='PUBLIC')

def test_real_chroma_persistence_and_live_revocation(tmp_path):
    catalog={'a':item('a','서울 장소','서울'),'b':item('b','부산 장소','부산')}
    client=chromadb.PersistentClient(path=str(tmp_path/'chroma'))
    assert index_catalog(client,embed,catalog,'fixture-3d')['count']==2
    assert search_public(client,embed,catalog,'서울','fixture-3d',regions=['서울'])[0]['id']=='a'
    reopened=chromadb.PersistentClient(path=str(tmp_path/'chroma'))
    assert search_public(reopened,embed,catalog,'서울','fixture-3d')[0]['id']=='a'
    del catalog['a']
    assert search_public(reopened,embed,catalog,'서울','fixture-3d',regions=['서울'])==[]
    assert index_catalog(reopened,embed,catalog,'fixture-3d')['removed']==1
    assert index_catalog(reopened,embed,catalog,'fixture-3d')['count']==1
    with pytest.raises(RuntimeError,match='mismatch'):
        search_public(reopened,embed,catalog,'서울','wrong-model')


def test_curated_locations_bypass_legacy_first_300_without_mutating_it(monkeypatch):
    import httpx
    from src.api.public_search import public_catalog, curated_catalog
    monkeypatch.setenv('KRIDE_PUBLIC_CATALOG_URL','https://fixture.test')
    rows=[{'contentId':i,'title':'출처 없음','addr':'서울','mapY':37.5,'mapX':127,'sourceUrl':''} for i in range(300)]
    monkeypatch.setattr(httpx,'get',lambda *_a,**_k:httpx.Response(200,json={'data':rows},request=httpx.Request('GET','https://fixture.test')))
    curated=curated_catalog()
    assert len(curated)==3 and set(public_catalog())==set(curated)
    assert all(p['artist']=='' and p['sourceUrl']==p['coordinateSourceUrl'] for p in curated.values())
    assert all(r['sourceUrl']=='' for r in rows)


def test_withdrawn_expired_or_invalid_coordinate_candidates_are_ineligible(tmp_path):
    import json
    from pathlib import Path
    from datetime import datetime,timezone
    from src.api.public_search import curated_catalog
    payload=json.loads(Path('src/api/seoul_public_pois.json').read_text(encoding='utf-8'))
    payload['items'][0]['approved']=False
    payload['items'][1]['reviewBy']='2026-10-01T00:00:00+00:00'
    payload['items'][2]['lat']=float('nan')
    path=tmp_path/'catalog.json';path.write_text(json.dumps(payload),encoding='utf-8')
    assert curated_catalog(path,datetime(2026,10,7,tzinfo=timezone.utc))=={}


def test_empty_refresh_refuses_to_destroy_existing_index(tmp_path):
    client=chromadb.PersistentClient(path=str(tmp_path/'chroma'))
    source={'a':item('a','서울 장소','서울')}
    index_catalog(client,embed,source,'fixture-3d')
    with pytest.raises(RuntimeError,match='empty_catalog_refuse_index'):
        index_catalog(client,embed,{},'fixture-3d')
    assert search_public(client,embed,source,'서울','fixture-3d')[0]['id']=='a'
