import hashlib,json,math
from copy import deepcopy
from datetime import datetime,timezone
import pytest
from src.api.multilingual_catalog import load_reviewed_catalog,build_new_collection,CONTRACT,name_matches,search_reviewed,document_text


@pytest.fixture
def documents(tmp_path):
    url='https://culture.seoul.go.kr/culture/culture/cultureSpace/view.do?facCode=100867'
    proof=lambda value:{'status':'verified','value':value,'sourceUrl':url,'sourceSha256':'a'*64,'locator':'test fixture only'}
    item={'id':'curated:seoul:100867','name':'시험박물관','region':'서울','address':'서울 종로구','lat':37.55,'lon':126.98,
        'verifiedAt':'2026-10-01T00:00:00+00:00','reviewBy':'2026-11-01T00:00:00+00:00',
        'names':{l:proof(n) for l,n in [('ko','시험박물관'),('en','Test Museum'),('ja','試験博物館')]},
        'evidence':{'name':proof('시험박물관'),'coordinates':proof({'lat':37.55,'lon':126.98}),'region':proof('서울'),'price':{'status':'unknown'},'artist':{'status':'unknown'}}}
    data={'contract':CONTRACT,'author':'fixture-author','items':[item]}
    def save(change=None,reviewer='fixture-independent-reviewer',digest=None):
        d=deepcopy(data)
        if change:change(d)
        path=tmp_path/'catalog.json';path.write_text(json.dumps(d),encoding='utf-8')
        review=tmp_path/'review.json';review.write_text(json.dumps({'decision':'approved','catalogSha256':digest or hashlib.sha256(path.read_bytes()).hexdigest(),'reviewer':reviewer}))
        return path,review
    return data,save


def test_review_is_bound_to_author_and_exact_content(documents):
    data,save=documents;now=datetime(2026,10,7,tzinfo=timezone.utc)
    catalog,_=load_reviewed_catalog(*save(),now=now);assert len(catalog)==1
    for kw in [{'reviewer':'fixture-author'},{'digest':'b'*64}]:
        with pytest.raises(ValueError):load_reviewed_catalog(*save(**kw),now=now)


@pytest.mark.parametrize('field',['coordinates','name','region'])
def test_claim_must_match_field_evidence(documents,field):
    _,save=documents
    def change(d):d['items'][0]['evidence'][field]['value']='unrelated'
    with pytest.raises(ValueError):load_reviewed_catalog(*save(change),now=datetime(2026,10,7,tzinfo=timezone.utc))


def test_unverified_language_does_not_become_public(documents):
    _,save=documents
    def change(d):d['items'][0]['names']['ja']['status']='pending'
    with pytest.raises(ValueError):load_reviewed_catalog(*save(change),now=datetime(2026,10,7,tzinfo=timezone.utc))


def test_new_index_never_upserts_or_deletes(documents):
    _,save=documents;c,d=load_reviewed_catalog(*save(),now=datetime(2026,10,7,tzinfo=timezone.utc))
    class Client:
        def create_collection(self,*args,**kwargs):raise RuntimeError('already exists')
    with pytest.raises(ValueError):build_new_collection(Client(),lambda docs:[],c,'kride_public_poi_v1','a'*40,d)
    with pytest.raises(RuntimeError,match='already exists'):build_new_collection(Client(),lambda docs:[[1.0]+[0.0]*383],c,'kride_public_v2_fixture01','a'*40,d)


def test_aliases_require_review_and_word_boundaries(documents):
    _,save=documents;c,_=load_reviewed_catalog(*save(),now=datetime(2026,10,7,tzinfo=timezone.utc))
    assert len(name_matches('Tell me about TEST MUSEUM',c))==1
    assert name_matches('Test Museums',c)==[]
    assert len(name_matches('試験博物館はどこですか',c))==1


def test_search_checks_release_before_embedding_or_query(documents,monkeypatch):
    _,save=documents;c,sha=load_reviewed_catalog(*save(),now=datetime(2026,10,7,tzinfo=timezone.utc))
    monkeypatch.setenv('KRIDE_PUBLIC_COLLECTION','kride_public_v2_fixture01')
    monkeypatch.setenv('KRIDE_EMBED_REVISION','a'*40)
    class Collection:
        metadata={'contract':CONTRACT,'modelRevision':'b'*40,'catalogSha256':sha}
        def count(self):return 1
        def query(self,**kw):raise AssertionError('must not query mismatched release')
    class Client:
        def get_collection(self,name):return Collection()
    with pytest.raises(RuntimeError,match='release_mismatch'):
        search_reviewed(Client(),lambda docs:pytest.fail('must not embed'),c,'museum')


def test_search_returns_current_sources_and_keeps_query_prefix(documents,monkeypatch):
    _,save=documents;c,sha=load_reviewed_catalog(*save(),now=datetime(2026,10,7,tzinfo=timezone.utc))
    monkeypatch.setenv('KRIDE_PUBLIC_COLLECTION','kride_public_v2_fixture01')
    monkeypatch.setenv('KRIDE_EMBED_REVISION','a'*40)
    docs=[document_text(p) for p in c.values()]
    class Collection:
        metadata={'contract':CONTRACT,'modelRevision':'a'*40,'catalogSha256':sha,'documentSha256':hashlib.sha256(json.dumps(docs,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()}
        def count(self):return 1
        def query(self,**kw):return {'ids':[['curated:seoul:100867']],'distances':[[0.1]]}
    class Client:
        def get_collection(self,name):return Collection()
    def embed(texts):
        assert texts==['query: Test Museum'];return [[1.0]+[0.0]*383]
    result=search_reviewed(Client(),embed,c,'Test Museum',['서울'],1)
    assert result[0]['nameMatched'] and result[0]['sourceUrl']==c['curated:seoul:100867']['sourceUrl']
    assert search_reviewed(Client(),embed,c,'Test Museum',['경기'],1)==[]


@pytest.mark.parametrize('vector',[[0.0]*384,[float('nan')]*384,[1.0]*383])
def test_bad_vectors_fail_before_creating_collection(documents,vector):
    _,save=documents;c,sha=load_reviewed_catalog(*save(),now=datetime(2026,10,7,tzinfo=timezone.utc))
    class Client:
        def create_collection(self,*a,**kw):pytest.fail('invalid vectors must not create a collection')
    with pytest.raises(ValueError,match='invalid_embeddings'):
        build_new_collection(Client(),lambda docs:[vector],c,'kride_public_v2_fixture01','a'*40,sha)


def test_reviewed_runtime_requires_offline_pinned_model(monkeypatch):
    import sys,types
    from src.api import torchserve_client as runtime
    monkeypatch.setenv('KRIDE_REVIEWED_CATALOG_PATH','test-fixture.json')
    monkeypatch.delenv('KRIDE_EMBED_REVISION',raising=False)
    with pytest.raises(RuntimeError,match='pinned_embedding_revision_required'):runtime.embed_texts_sync(['query: museum'])
    calls=[]
    class Model:
        def __init__(self,name,**kw):calls.append(kw)
        def encode(self,texts,**kw):return [[1.0]+[0.0]*383]
    monkeypatch.setitem(sys.modules,'sentence_transformers',types.SimpleNamespace(SentenceTransformer=Model))
    monkeypatch.setattr(runtime,'_local_embedder',None)
    monkeypatch.setenv('KRIDE_EMBED_REVISION','a'*40)
    monkeypatch.setattr(runtime.httpx,'post',lambda *a,**kw:pytest.fail('must not use remote unpinned model'))
    assert len(runtime.embed_texts_sync(['query: museum'])[0])==384
    assert calls==[{'revision':'a'*40,'local_files_only':True}]
