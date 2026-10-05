"""Search a versioned Chroma collection, rechecking current public catalog IDs."""
import math
import os
from datetime import datetime, timezone
import httpx

COLLECTION = 'kride_public_poi_v1'


def public_catalog():
    base = os.environ.get('KRIDE_PUBLIC_CATALOG_URL', '').rstrip('/')
    if not base:
        raise RuntimeError('public_catalog_unconfigured')
    response = httpx.get(base + '/api/v1/tour/holy', timeout=8)
    response.raise_for_status()
    rows = response.json().get('data')
    if not isinstance(rows, list):
        raise RuntimeError('public_catalog_invalid')
    checked = datetime.now(timezone.utc).isoformat()
    result = {}
    for row in rows:
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
