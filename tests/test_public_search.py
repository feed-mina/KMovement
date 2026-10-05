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
