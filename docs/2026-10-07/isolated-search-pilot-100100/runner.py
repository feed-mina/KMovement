"""Offline retrieval-only pilot. No production client, generation, or credential access."""
import sys, os, json, pathlib, hashlib, time, math, traceback, sqlite3
P = pathlib.Path
OUT = P('/output')

def save(name, obj):
    (OUT/name).write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')

def quality(found, relevant):
    if not relevant:
        return None
    recall = len(set(found[:5]) & set(relevant))/len(relevant)
    dcg = sum(1/math.log2(i+2) for i, x in enumerate(found[:10]) if x in relevant)
    ideal = sum(1/math.log2(i+2) for i in range(min(10, len(relevant))))
    return {'recall5': recall, 'ndcg10': dcg/ideal}

def main():
    import resource
    started = time.monotonic()
    policy = json.loads(P('/policy/run-spec.json').read_text())
    assert policy['executionAllowed'] and policy['candidateCount']==1000 and policy['questionCount']==120
    assert hashlib.sha256(P(__file__).read_bytes()).hexdigest()==policy['runnerSha256']
    for name, sha in policy['inputs'].items():
        assert hashlib.sha256((P('/inputs')/name).read_bytes()).hexdigest()==sha, name
    # Reuse the reviewed OS probes; stop before dependency/model loading. Old false policy remains immutable.
    probe = P('/checks/container-probe.py').read_text().split("sys.path.insert(0,'/runtime')")[0]
    exec(compile(probe.replace("P('/policy/execution-policy.json')", "P('/checks/execution-policy.json')"), 'boundary-probe', 'exec'), {})
    save('boundary.json', {'rechecked': True, 'source': 'same 13 original assertions before inference'})
    sys.path.insert(0, '/runtime')
    import numpy as np
    import torch
    from transformers import AutoTokenizer, AutoModel
    import chromadb
    from chromadb.config import Settings
    torch.set_num_threads(1)
    torch.manual_seed(0)
    torch.use_deterministic_algorithms(True)
    candidates = json.loads(P('/inputs/candidates.json').read_text())
    questions = json.loads(P('/inputs/questions-reviewed.json').read_text())
    ids = [x['id'] for x in candidates]
    assert len(ids)==1000 and len(set(ids))==1000 and len(questions)==120
    assert len({q['id'] for q in questions})==120
    assert all(set(q['expectedIds']) <= set(ids) for q in questions)
    for c in candidates:
        for key in ('documentA','documentC'):
            assert hashlib.sha256(c[key].encode()).hexdigest()==c[key+'Sha256']
    load_start = time.monotonic()
    tok = AutoTokenizer.from_pretrained('/model', local_files_only=True)
    model = AutoModel.from_pretrained('/model', local_files_only=True, use_safetensors=True).eval()
    load_seconds = time.monotonic()-load_start
    truncations=[]
    def encode(texts, labels):
        result=[]
        for start in range(0,len(texts),16):
            text=texts[start:start+16]
            lengths=tok(text,truncation=False,padding=False)['input_ids']
            truncations.extend(labels[start+j] for j,t in enumerate(lengths) if len(t)>512)
            batch=tok(text,max_length=512,padding=True,truncation=True,return_tensors='pt')
            with torch.inference_mode():
                h=model(**batch).last_hidden_state
                h=h.masked_fill(~batch['attention_mask'][...,None].bool(),0.0)
                v=h.sum(dim=1)/batch['attention_mask'].sum(dim=1)[...,None]
                v=torch.nn.functional.normalize(v,p=2,dim=1)
            result.append(v.cpu().numpy().astype(np.float32))
        a=np.concatenate(result)
        assert a.shape==(len(texts),384) and a.dtype==np.float32 and np.isfinite(a).all()
        assert np.max(np.abs(np.linalg.norm(a,axis=1)-1))<=1e-5
        return a
    vectors={}; build_times={}
    for key in ('A','C'):
        t=time.monotonic(); vectors[key]=encode([c['document'+key] for c in candidates], [key+':'+i for i in ids])
        build_times[key]=time.monotonic()-t
        np.save(OUT/('vectors-'+key+'.npy'),vectors[key],allow_pickle=False)
        print('EMBEDDED',key,round(build_times[key],2),flush=True)
    vectors['B']=vectors['A']
    hashes={k:hashlib.sha256(v.tobytes()).hexdigest() for k,v in vectors.items()}
    assert vectors['A'] is vectors['B'] and hashes['A']==hashes['B']
    db=OUT/'new-chroma'
    assert not db.exists(), 'refuse existing database'
    save('chroma-lifecycle.json', {'event':'before fresh client creation', 'path':str(db),'existingDatabase':False,'migrationSetting':'apply to new DB only','queueReplay':'new DB has no legacy queue; later inspect queue size','failureAction':'stop this run; no recovery/reindex'})
    client=chromadb.PersistentClient(path=str(db),settings=Settings(anonymized_telemetry=False,allow_reset=False,migrations='apply'))
    config={'hnsw':{'space':'cosine','ef_construction':100,'ef_search':100,'max_neighbors':16,'num_threads':1,'batch_size':100,'sync_threshold':1000}}
    collections={}
    for k in ('A','C'):
        collection=client.create_collection('pilot-'+k.lower(),embedding_function=None,configuration=config)
        for i in range(0,1000,100):
            collection.add(ids=ids[i:i+100],embeddings=vectors[k][i:i+100].tolist())
        assert collection.count()==1000
        collections[k]=collection
    collections['B']=collections['A']
    save('collection-config.json', {'requested':config,'actual':{k:v.configuration for k,v in collections.items()}})
    rows=[]
    for variant in ('A','B','C'):
        col=collections[variant]; matrix=vectors[variant]
        for qi,q in enumerate(questions):
            raw=q['query']; query=raw if variant=='A' else 'query: '+raw
            t=time.monotonic(); qv=encode([query],[variant+':'+q['id']])[0]; encode_ms=(time.monotonic()-t)*1000
            score=matrix@qv
            exact=sorted(range(1000),key=lambda i:(-float(score[i]),ids[i]))[:10]
            exact_ids=[ids[i] for i in exact]
            t=time.monotonic(); result=col.query(query_embeddings=[qv.tolist()],n_results=10,include=['distances']); ann_ms=(time.monotonic()-t)*1000
            ranked=sorted(zip(result['ids'][0],result['distances'][0]),key=lambda x:(x[1],x[0])); found=[x[0] for x in ranked]
            rows.append({'variant':variant,'id':q['id'],'language':q['language'],'split':q['split'],'positive':bool(q['expectedIds']),'exactIds':exact_ids,'annIds':found,'exactQuality':quality(exact_ids,q['expectedIds']),'annQuality':quality(found,q['expectedIds']),'annRecall10':len(set(found)&set(exact_ids))/10,'embeddingMs':encode_ms,'annMs':ann_ms,'queryAndSearchMs':encode_ms+ann_ms,'firstQueryInVariant':qi==0,'answerGenerated':False})
        print('QUERIED',variant,len(questions),flush=True)
    save('rows.json',rows)
    metrics={}
    for v in ('A','B','C'):
        metrics[v]={}
        for split in ('development','holdout'):
            metrics[v][split]={}
            for lang in ('ko','en','ja'):
                rs=[r for r in rows if r['variant']==v and r['split']==split and r['language']==lang and r['positive']]
                assert rs
                metrics[v][split][lang]={'n':len(rs),**{kind:{m:float(np.mean([r[kind][m] for r in rs])) for m in ('recall5','ndcg10')} for kind in ('exactQuality','annQuality')}}
    ann={v:float(np.mean([r['annRecall10'] for r in rows if r['variant']==v])) for v in ('A','B','C')}
    latency={v:{'firstQueryMs':next(r['queryAndSearchMs'] for r in rows if r['variant']==v),'warmP50Ms':float(np.percentile([r['queryAndSearchMs'] for r in rows if r['variant']==v and not r['firstQueryInVariant']],50)),'warmP95Ms':float(np.percentile([r['queryAndSearchMs'] for r in rows if r['variant']==v and not r['firstQueryInVariant']],95))} for v in ('A','B','C')}
    lifecycle={'freshDatabaseOnly':True,'chromadbVersion':chromadb.__version__,'migrations':[],'queueRows':None,'indexFiles':[]}
    with sqlite3.connect('file:'+str(db/'chroma.sqlite3')+'?mode=ro',uri=True) as conn:
        names={r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'migrations' in names:
            lifecycle['migrations']=[list(r) for r in conn.execute('SELECT dir,version,filename,hash FROM migrations')]
        if 'embeddings_queue' in names:lifecycle['queueRows']=conn.execute('SELECT count(*) FROM embeddings_queue').fetchone()[0]
    lifecycle['indexFiles']=[{'path':str(p.relative_to(db)),'bytes':p.stat().st_size} for p in db.rglob('*') if p.is_file()]
    save('chroma-lifecycle.json',lifecycle)
    result={'candidateCount':1000,'questionCount':120,'vectorHashes':hashes,'ABSameStoredVectors':hashes['A']==hashes['B'],'CSeparate':True,'metrics':metrics,'annRecall10':ann,'latency':latency,'modelLoadSeconds':load_seconds,'documentEmbeddingSeconds':build_times,'truncatedIds':truncations,'peakRSSKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'elapsedSeconds':time.monotonic()-started,'diskBytes':sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file()),'negativeEvaluation':{'status':'not_evaluated','negativeQuestionsRetrieved':sum(not q['expectedIds'] for q in questions),'reason':'search-only runner returns candidates, no application answer/abstention pipeline; retrieval is not unsupported-claim acceptance','unsupportedClaimAccepts':None,'positiveOverRefusalRate':None},'publicEligibleCount':sum(bool(c['publicEligible']) for c in candidates),'publicContractPass':False,'productionTransitionAllowed':False,'latencySlaPass':None,'coldLatencyDistribution':'not measured: model-load time and single first-query observation only','populationGeneralization':False}
    save('result.json',result)
    print('RESULT_READY',flush=True)

if __name__=='__main__':
    try: main()
    except BaseException:
        save('failure.json',{'traceback':traceback.format_exc(),'action':'stop; retain this disposable run only'})
        traceback.print_exc()
        sys.exit(1)
