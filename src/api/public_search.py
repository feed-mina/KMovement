"""Search a versioned Chroma collection, rechecking current public catalog IDs."""
import math
import os
import json
import re
import logging
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime, timezone
import httpx

COLLECTION = 'kride_public_poi_v1'
log = logging.getLogger(__name__)


def curated_catalog(path=None, now=None):
    """Reviewed public locations, independent of the legacy 300-row feed.

    Expired or withdrawn entries never become eligible from stale index data.
    The file ships with the reviewed source revision, not with caller input.
    """
    path = Path(path) if path else Path(__file__).with_name('seoul_public_pois.json')
    now = now or datetime.now(timezone.utc)
    result = {}
    for row in json.loads(path.read_text(encoding='utf-8'))['items']:
        if row.get('approved') is not True:
            continue
        try:
            identity = row['id']
            verified = datetime.fromisoformat(row['verifiedAt'])
            review = datetime.fromisoformat(row['reviewBy'])
            lat, lon = float(row['lat']), float(row['lon'])
            urls = [urlparse(row[k]) for k in ('sourceUrl', 'coordinateSourceUrl')]
            if (not re.fullmatch(r'curated:seoul:\d+', identity) or identity in result or
                not all(isinstance(row[k], str) and 0 < len(row[k]) < 500 for k in ('name','address','evidence')) or
                not row['address'].startswith('서울') or row.get('artist') != '' or
                not (verified <= now < review) or
                not all(u.scheme == 'https' and u.hostname == 'culture.seoul.go.kr' and
                        u.path == '/culture/culture/cultureSpace/view.do' and not u.username and not u.password for u in urls) or
                not (math.isfinite(lat) and math.isfinite(lon) and 37.4 < lat < 37.7 and 126.7 < lon < 127.3)):
                continue
        except (KeyError, TypeError, ValueError):
            continue
        result[identity] = dict(id=identity, poi_id=identity, name=row['name'], address=row['address'],
            lat=lat, lon=lon, artist='', sourceUrl=row['sourceUrl'], coordinateSourceUrl=row['coordinateSourceUrl'],
            verifiedAt=row['verifiedAt'], reviewBy=row['reviewBy'], visibility='PUBLIC', evidenceGrade='OFFICIAL_LOCATION')
    return result


def public_catalog():
    result = curated_catalog()
    base = os.environ.get('KRIDE_PUBLIC_CATALOG_URL', '').rstrip('/')
    if not base:
        raise RuntimeError('public_catalog_unconfigured')
    try:
        response = httpx.get(base + '/api/v1/tour/holy', timeout=8)
        response.raise_for_status()
        rows = response.json().get('data')
        if not isinstance(rows, list):
            raise RuntimeError('public_catalog_invalid')
    except (httpx.HTTPError, ValueError, RuntimeError):
        if not result:
            raise
        # The independently reviewed file remains authoritative for these IDs.
        # No old third-party catalog response is cached or served on failure.
        log.warning('Public legacy catalog unavailable; reviewed locations only')
        rows = []
    checked = datetime.now(timezone.utc).isoformat()
    for row in rows:
        if not isinstance(row, dict):
            continue
        identity, name, address = row.get('contentId'), row.get('title'), row.get('addr')
        source = row.get('sourceUrl') or ''
        try:
            lat, lon = float(row['mapY']), float(row['mapX'])
        except (KeyError, TypeError, ValueError):
            continue
        if not identity or not name or not address or not source.startswith(('https://','http://')):
            continue
        if not (math.isfinite(lat) and math.isfinite(lon) and 33 <= lat <= 39 and 124 <= lon <= 132):
            continue
        identity = 'tour:' + str(identity)
        result[identity] = dict(id=identity, poi_id=identity, name=name, address=address,
            lat=lat, lon=lon, sourceUrl=source, verifiedAt=checked, artist=row.get('artist') or '',
            visibility='PUBLIC', evidenceGrade='PUBLIC_CATALOG')
    return result


def index_catalog(client, embed, catalog, model):
    """Explicit indexing command only; query requests never mutate the index."""
    if not catalog:
        raise RuntimeError('empty_catalog_refuse_index')
    col = client.get_or_create_collection(COLLECTION, metadata={'embeddingModel':model,'contract':'e5-prefix-v1','hnsw:space':'cosine'})
    if col.metadata.get('embeddingModel') != model or col.metadata.get('contract') != 'e5-prefix-v1':
        raise RuntimeError('embedding_contract_mismatch')
    existing = set(col.get(include=[])['ids'])
    for start in range(0,len(catalog),64):
        rows=list(catalog.values())[start:start+64]
        docs=['passage: '+p['name']+' | '+p['address']+' | '+p['artist'] for p in rows]
        col.upsert(ids=[p['id'] for p in rows],documents=docs,metadatas=rows,embeddings=embed(docs))
    stale=existing-set(catalog)
    if stale:col.delete(ids=sorted(stale))
    return {'collection':COLLECTION,'count':col.count(),'removed':len(stale),'embeddingModel':model}


def search_public(client, embed, catalog, query, model, regions=(), top_k=8):
    col=client.get_collection(COLLECTION)
    if col.metadata.get('embeddingModel') != model or col.metadata.get('contract') != 'e5-prefix-v1':
        raise RuntimeError('embedding_contract_mismatch')
    if not col.count():return []
    response=col.query(query_embeddings=embed(['query: '+query]),n_results=min(col.count(),max(top_k*4,32)),include=['distances'])
    result=[]
    for identity,distance in zip(response['ids'][0],response['distances'][0]):
        # Never trust old index metadata after approval was revoked.
        item=catalog.get(identity)
        if item is None or (regions and not any(r in item['address'] for r in regions)):continue
        result.append({**item,'distance':float(distance)})
        if len(result)==top_k:break
    return result


def lookup_public(query, regions=('서울',), top_k=8):
    catalog = public_catalog()
    if not catalog:
        return []
    from src.api.rag_client import get_chroma
    from src.api.torchserve_client import embed_texts_sync, EMBED_MODEL
    return search_public(get_chroma(), embed_texts_sync, catalog, query[:1000], EMBED_MODEL, regions, top_k)
