"""Reviewed release catalogs and immutable index contracts.

Preparation files are not public catalogs. Admission requires a separate review
record bound to the exact candidate file, with author/reviewer separation.
"""
import hashlib
import json
import math
import re
import os
import struct
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

CONTRACT = 'kride-reviewed-multilingual-v2'
OFFICIAL_HOSTS = {'culture.seoul.go.kr','english.seoul.go.kr','japanese.seoul.go.kr',
                  'museum.seoul.go.kr','english.visitseoul.net','japanese.visitseoul.net',
                  'english.visitkorea.or.kr','japanese.visitkorea.or.kr','royal.khs.go.kr'}


def official_url(value):
    if not isinstance(value,str):return False
    u=urlparse(value)
    return u.scheme=='https' and u.hostname in OFFICIAL_HOSTS and not u.username and not u.password and not u.fragment


def load_reviewed_catalog(path, review_path, now=None):
    raw=Path(path).read_bytes();data=json.loads(raw);review=json.loads(Path(review_path).read_text(encoding='utf-8'))
    digest=hashlib.sha256(raw).hexdigest();now=now or datetime.now(timezone.utc)
    if (data.get('contract')!=CONTRACT or review.get('catalogSha256')!=digest or
        review.get('decision')!='approved' or not review.get('reviewer') or
        review['reviewer']==data.get('author') or not data.get('author')):
        raise ValueError('catalog_independent_review_required')
    items=data.get('items');result={}
    if not isinstance(items,list) or not items:raise ValueError('empty_reviewed_catalog')
    for p in items:
        try:
            identity=p['id'];e=p['evidence'];names=p['names']
            if not re.fullmatch(r'curated:seoul:\d+',identity) or identity in result:raise ValueError()
            if not p['address'].startswith('서울') or p['region']!='서울':raise ValueError()
            if not all(isinstance(p[k],str) and 0<len(p[k])<500 for k in ('name','address')):raise ValueError()
            if not all(isinstance(p[k],(float,int)) and math.isfinite(p[k]) for k in ('lat','lon')):raise ValueError()
            if not (37.4<p['lat']<37.7 and 126.7<p['lon']<127.3):raise ValueError()
            if not datetime.fromisoformat(p['verifiedAt'])<=now<datetime.fromisoformat(p['reviewBy']):raise ValueError()
            for field in ('name','coordinates','region'):
                proof=e[field]
                if (proof['status']!='verified' or not official_url(proof['sourceUrl']) or
                    not re.fullmatch('[0-9a-f]{64}',proof['sourceSha256']) or not proof.get('locator')):raise ValueError()
            if e['name']['value']!=p['name'] or e['region']['value']!=p['region']:raise ValueError()
            if e['coordinates']['value']!={'lat':p['lat'],'lon':p['lon']}:raise ValueError()
            for locale in ('ko','en','ja'):
                n=names[locale]
                if (n['status']!='verified' or not isinstance(n['value'],str) or not 0<len(n['value'])<200 or
                    not official_url(n['sourceUrl']) or not n.get('locator') or
                    not re.fullmatch('[0-9a-f]{64}',n['sourceSha256'])):raise ValueError()
            # This first contract does not make any price/artist claims.
            if e['price']['status'] not in ('unknown','unsupported') or e['artist']['status'] not in ('unknown','unsupported'):raise ValueError()
            result[identity]={**p,'poi_id':identity,'artist':'','sourceUrl':e['name']['sourceUrl'],
                'coordinateSourceUrl':e['coordinates']['sourceUrl'],'visibility':'PUBLIC',
                'evidenceGrade':'REVIEWED_MULTILINGUAL_LOCATION','catalogSha256':digest}
        except (KeyError,TypeError,ValueError):
            raise ValueError('invalid_reviewed_candidate:'+str(p.get('id','unknown'))) from None
    return result,digest


def normalized_name(value):
    return re.sub(r'\s+',' ',unicodedata.normalize('NFC',value)).casefold().strip()


def name_matches(query,catalog):
    """Return verified entity matches only. Original names/documents stay unchanged."""
    q=normalized_name(query);matches=[]
    for identity,p in catalog.items():
        names=[p['name']]+[n['value'] for n in p.get('names',{}).values() if isinstance(n,dict) and n.get('status')=='verified']
        for name in names:
            n=normalized_name(name)
            # Latin word boundaries avoid matching a name inside a different word.
            found=re.search(r'(?<![a-z0-9])'+re.escape(n)+r'(?![a-z0-9])',q) if re.search('[a-z]',n) else n in q
            if n and found:matches.append(identity);break
    return matches


def document_text(place):
    names=[place['names'][l]['value'] for l in ('ko','en','ja')]
    return 'passage: '+' | '.join(names+[place['address'],place['region']])


def build_new_collection(client, embed, catalog, name, model_revision, catalog_sha):
    if not re.fullmatch(r'kride_public_v2_[a-z0-9_]{8,80}',name):raise ValueError('separate_collection_required')
    if not re.fullmatch('[0-9a-f]{40}',model_revision) or not re.fullmatch('[0-9a-f]{64}',catalog_sha):raise ValueError('pinned_hashes_required')
    if not catalog:raise ValueError('empty_catalog')
    docs=[document_text(p) for p in catalog.values()]
    doc_sha=hashlib.sha256(json.dumps(docs,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    # create_collection deliberately fails if it already exists; no upsert/delete.
    vectors=embed(docs)
    try:
        vectors=[[struct.unpack('<f',struct.pack('<f',float(x)))[0] for x in v] for v in vectors]
        if len(vectors)!=len(docs) or any(len(v)!=384 or any(not math.isfinite(x) for x in v) or abs(math.sqrt(sum(x*x for x in v))-1)>1e-5 for v in vectors):
            raise ValueError('invalid_embeddings')
    except (TypeError, OverflowError, struct.error):
        raise ValueError('invalid_embeddings') from None
    col=client.create_collection(name,metadata={'contract':CONTRACT,'modelRevision':model_revision,'catalogSha256':catalog_sha,'documentSha256':doc_sha,'hnsw:space':'cosine'})
    col.add(ids=list(catalog),documents=docs,embeddings=vectors,metadatas=[{'poiId':i,'catalogSha256':catalog_sha} for i in catalog])
    if col.count()!=len(catalog):raise RuntimeError('incomplete_new_collection_do_not_promote')
    return {'collection':name,'count':col.count(),'catalogSha256':catalog_sha,'documentSha256':doc_sha,'modelRevision':model_revision}


def search_reviewed(client, embed, catalog, query, regions=(), top_k=8):
    name=os.environ.get('KRIDE_PUBLIC_COLLECTION','')
    revision=os.environ.get('KRIDE_EMBED_REVISION','')
    if not re.fullmatch(r'kride_public_v2_[a-z0-9_]{8,80}',name) or not re.fullmatch('[0-9a-f]{40}',revision):
        raise RuntimeError('reviewed_search_release_unconfigured')
    hashes={p.get('catalogSha256') for p in catalog.values()}
    if len(hashes)!=1 or None in hashes:raise RuntimeError('mixed_catalog_revisions')
    sha=next(iter(hashes));col=client.get_collection(name)
    docs=[document_text(p) for p in catalog.values()]
    doc_sha=hashlib.sha256(json.dumps(docs,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
    expected={'contract':CONTRACT,'modelRevision':revision,'catalogSha256':sha,'documentSha256':doc_sha}
    if not col.metadata or any(col.metadata.get(k)!=v for k,v in expected.items()) or col.count()!=len(catalog):
        raise RuntimeError('reviewed_search_release_mismatch')
    response=col.query(query_embeddings=embed(['query: '+query]),n_results=min(len(catalog),max(32,top_k)),include=['distances'])
    distance=dict(zip(response['ids'][0],response['distances'][0]))
    # Entity-aware ordering is a separate change, not the fixed-vector A/B prefix test.
    matches=name_matches(query,catalog)
    order=list(dict.fromkeys(matches+response['ids'][0]));result=[]
    for identity in order:
        p=catalog.get(identity)
        if p is None or regions and p['region'] not in regions:continue
        if identity not in distance or not math.isfinite(float(distance[identity])):continue
        result.append({**p,'distance':float(distance[identity]),'nameMatched':identity in matches})
        if len(result)==top_k:break
    return result
