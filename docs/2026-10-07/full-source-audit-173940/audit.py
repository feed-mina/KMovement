from pathlib import Path
import json,hashlib,sqlite3,shutil,collections,math,datetime,tarfile
W=Path(__file__).parent;R=Path('D:/KMovement')
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def manifest(root):
 return {p.relative_to(root).as_posix():{'sha256':sha(p),'bytes':p.stat().st_size,'mtimeNs':p.stat().st_mtime_ns} for p in root.rglob('*') if p.is_file()}
old=json.loads((R/'work-map-guide/work/release-compat-20261006/freeze-local.json').read_text(encoding='utf-8'))
root=Path(old['originalRoot']);archive=Path(old['archive']['path']);graph=R/'models/kride_graph.json'
before=manifest(root);oldhash={p['path']:p['sha256'] for p in old['originalFiles']}
assert {p:v['sha256'] for p,v in before.items()}==oldhash,'original_drift_stop'
assert not any(p.endswith(('-wal','-shm','-journal')) for p in before),'sidecar_present_stop'
archive_sha=sha(archive);assert archive_sha==old['archive']['sha256'],'archive_drift_stop'
graph_sha=sha(graph);g=json.loads(graph.read_text(encoding='utf-8'));assert sha(graph)==graph_sha
copy=W/'metadata-audit-only.sqlite3';assert not copy.exists()
shutil.copyfile(root/'chroma.sqlite3',copy)
assert sha(copy)==before['chroma.sqlite3']['sha256'] and manifest(root)==before,'source_changed_during_copy'
c=sqlite3.connect(copy.as_uri()+'?mode=ro&immutable=1',uri=True);c.execute('pragma query_only=on')
rows=c.execute("SELECT e.id,e.embedding_id,c.name FROM embeddings e JOIN segments s ON e.segment_id=s.id JOIN collections c ON s.collection=c.id WHERE c.name LIKE 'kride_poi_%'").fetchall()
meta={r[0]:{} for r in rows}
for eid,k,t,i,f in c.execute("SELECT m.id,m.key,m.string_value,m.int_value,m.float_value FROM embedding_metadata m JOIN embeddings e ON m.id=e.id JOIN segments s ON e.segment_id=s.id JOIN collections c ON s.collection=c.id WHERE c.name LIKE 'kride_poi_%'"):
 meta[eid][k]=next((v for v in (t,i,f) if v is not None),None)
collection_counts=[{'name':n,'dimension':d,'sqlRows':cnt} for n,d,cnt in c.execute('SELECT c.name,c.dimension,count(e.id) FROM collections c LEFT JOIN segments s ON s.collection=c.id LEFT JOIN embeddings e ON e.segment_id=s.id GROUP BY c.id')]
queue=c.execute('select count(*) from embeddings_queue').fetchone()[0]
c.close()
pois=[n for n in g['nodes'] if n.get('type')=='POI'];byid={n['id']:n for n in pois}
bad=lambda x:x is None or str(x).strip().lower() in ('','nan','none','null')
def coords(n):
 try:
  a,b=float(n['lat']),float(n['lon']);return math.isfinite(a) and math.isfinite(b) and -90<=a<=90 and -180<=b<=180,33<=a<=39 and 124<=b<=132
 except (KeyError,TypeError,ValueError):return False,False
def norm(s):return ' '.join(str(s or '').strip().casefold().split())
regions={'서울':'서울','부산':'부산','대구':'대구','인천':'인천','광주':'광주','대전':'대전','울산':'울산','세종':'세종','경기':'경기','강원':'강원','충청북':'충북','충북':'충북','충청남':'충남','충남':'충남','전라북':'전북','전북':'전북','전라남':'전남','전남':'전남','경상북':'경북','경북':'경북','경상남':'경남','경남':'경남','제주':'제주'}
regioncounts=collections.Counter();flags=collections.Counter();duplicates=collections.defaultdict(list);buckets=collections.Counter();matches=collections.Counter()
artistids={n['id'] for n in g['nodes'] if n.get('type')=='Artist'};allids={n['id'] for n in g['nodes']};linked=set();dangling=0
for edge in g['edges']:
 a,b=edge['source'],edge['target'];dangling+=a not in allids or b not in allids
 if a in byid and b in artistids:linked.add(a)
 if b in byid and a in artistids:linked.add(b)
with (W/'quality-flags-private.jsonl').open('x',encoding='utf-8') as f:
 for n in pois:
  world,korea=coords(n);addr=not bad(n.get('address'));name=not bad(n.get('name'));region=next((v for k,v in regions.items() if str(n.get('address','')).strip().startswith(k)),'미분류');regioncounts[region]+=1
  issues=[]
  for key,condition in [('missingName',not name),('missingAddress',not addr),('invalidWorldCoordinate',not world),('outsideKoreaHeuristicBox',not korea),('unclassifiedAddressRegion',region=='미분류'),('missingDescription',bad(n.get('description')))]:
   if condition:flags[key]+=1;issues.append(key)
  buckets['nameAddressKoreaBoxPresent' if name and addr and korea else 'coreFieldsNeedReview']+=1
  if name and addr:duplicates[(norm(n['name']),norm(n['address']))].append(n['id'])
  f.write(json.dumps({'id':n['id'],'flags':issues,'addressDerivedRegion':region},ensure_ascii=False)+'\n')
for eid,pid,col in rows:
 if pid not in byid:continue
 n=byid[pid];m=meta[eid]
 for key in ('name','address','category'):
  matches[key]+=str(n.get(key) or '')==str(m.get(key) or '')
 try:matches['coordinates']+=all(math.isfinite(float(n[k])) and math.isfinite(float(m[k])) and abs(float(n[k])-float(m[k]))<1e-8 for k in ('lat','lon'))
 except (ValueError,TypeError,KeyError):pass
docs=[m.get('chroma:document') for m in meta.values()]
urlkeys=sorted({k for m in meta.values() for k in m if 'url' in k.lower()})
sourcecount=sum(any(isinstance(v,str) and v.startswith(('http://','https://')) for k,v in m.items() if 'url' in k.lower()) for m in meta.values())
graphurls=sum(any(isinstance(v,str) and v.startswith(('http://','https://')) for k,v in n.items() if 'url' in k.lower()) for n in pois)
archive_files={}
with tarfile.open(archive,'r:gz') as t:
 for member in t:
  if member.isfile():
   stream=t.extractfile(member);h=hashlib.sha256()
   for b in iter(lambda:stream.read(1048576),b''):h.update(b)
   archive_files[member.name.removeprefix('chroma_db/')]=h.hexdigest()
after=manifest(root)
assert before==after and sha(archive)==archive_sha and sha(graph)==graph_sha and sha(copy)==before['chroma.sqlite3']['sha256'],'preservation_failed'
dup=[v for v in duplicates.values() if len(v)>1]
out={'checkedAt':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(),'scope':'stage1 read-only audit, no Chroma client/model/search/index/deployment','source':str(root),'graphPath':str(graph),'archivePath':str(archive),'originalFiles':len(before),'originalMatchesPriorFreeze':True,'originalAndGraphAndArchiveUnchanged':True,'sidecarFilesObserved':[],'snapshotClaim':'Stable file hashes observed before/after; not proof no concurrent writer and not a complete live snapshot. SQLite-only copy used for read-only metadata queries.','graphSha256':graph_sha,'sqliteSha256':sha(copy),'archiveSha256':archive_sha,'archiveFiles':len(archive_files),'archiveMatchesOriginalFiles':archive_files==oldhash,'counts':{'graphPoiRows':len(pois),'uniqueGraphPoiIds':len(byid),'duplicateGraphIds':len(pois)-len(byid),'sqlPoiRows':len(rows),'uniqueSqlPoiIds':len({r[1] for r in rows}),'idsMatched':len(set(byid)&{r[1] for r in rows}),'nonEmptySqlDocuments':sum(not bad(d) for d in docs),'duplicateExactDocumentsBeyondFirst':sum(v-1 for v in collections.Counter(d for d in docs if not bad(d)).values() if v>1),'sameNormalizedNameAddressGroups':len(dup),'sameNormalizedNameAddressRows':sum(map(len,dup)),'sameNormalizedNameAddressExcessRows':sum(len(x)-1 for x in dup),'directSourceUrlGraphRows':graphurls,'directSourceUrlSqlRows':sourcecount,'artistGraphLinkedRows':len(linked),'artistNodes':len(artistids),'danglingEdges':dangling,**dict(buckets)},'missingAndQualityFlags':dict(flags),'addressDerivedRegions':dict(regioncounts),'coordinateRule':'world-valid and Korea bounding box lat33..39 lon124..132; not administrative containment or entrance accuracy','sourceUrlMetadataKeys':urlkeys,'metadataKeys':sorted({k for m in meta.values() for k in m}),'fieldMatches':dict(matches),'collections':collection_counts,'queueRowsNotReplayed':queue,'priceEvidence':'no price claim validated','artistEvidence':'graph edges only; not source-backed artist proof','searchReadyCount':None,'publicApprovedCountFromThisAudit':0,'publicApprovalMeaning':'none approved by this structural audit; not proof external sources do not exist','previousIntegrityFailure':'Prior isolated-copy FTS5/foreign-key issues remain unresolved; no repair or integrity re-test performed','backupRegister':[{'path':'D:/kride-project/chroma_db.bak/chroma.sqlite3','kind':'legacy .bak PDF-only backup','sha256':sha(Path('D:/kride-project/chroma_db.bak/chroma.sqlite3'))}],'productionContacted':False,'originalManifest':before}
(W/'audit-result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in out.items() if k not in ('originalManifest','metadataKeys')},ensure_ascii=False))
