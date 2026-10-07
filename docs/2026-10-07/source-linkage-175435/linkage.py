from pathlib import Path
import json,csv,hashlib,math,re,collections,datetime,itertools
W=Path(__file__).parent
G=Path('D:/KMovement/models/kride_graph.json')
C=W.parent/'independent-review-20261007/places11-source-freeze-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(name,obj): (W/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
def norm(s):return ' '.join(str(s or '').strip().casefold().split())
def present(s):return norm(s) not in ('','nan','none','null')
def road(s):return norm(re.sub(r'\([^)]*\)','',s))
def dist(a,b):
 x,y=map(math.radians,[float(a['lat']),float(b['lat'])]); dx=y-x;dy=math.radians(float(b['lon'])-float(a['lon']))
 return 6371000*2*math.asin(min(1,math.sqrt(math.sin(dx/2)**2+math.cos(x)*math.cos(y)*math.sin(dy/2)**2)))
spec={'version':'source-linkage-v1','scope':'read-only source crosswalk; no identity auto-merge or public admission','duplicateKey':'nonempty name,address; strip/casefold/collapse whitespace','distanceTriageMeters':{'near':100},'distanceMeaning':'review prioritization only, not identity proof or accuracy threshold','officialJoin':'exact normalized name and address; retain every matching source row','names':'reuse hash-verified independent catalog evidence only; no invented translations','price':'unknown','artist':'unknown','executionAllowed':False,'productionPromoted':False}
dump('rules-v1.json',spec)
before=sha(G);assert before=='49110f8c6074a1028f687c448d1dda745ed313f5ec94e99d9cfd6af59547903c'
csvsha=sha(W/'official-media.csv');assert csvsha=='1eba00010a3274e58a302d3dfdf0b7e56b4d7af3fe03680edfeae9866845ce3c'
graph=json.loads(G.read_text(encoding='utf-8'));places=[x for x in graph['nodes'] if x['type']=='POI'];byid={x['id']:x for x in places};groups=collections.defaultdict(list)
for p in places:
 if present(p.get('name')) and present(p.get('address')):groups[(norm(p['name']),norm(p['address']))].append(p)
dups=[];dmap={}
for key,ps in sorted(groups.items()):
 if len(ps)<2:continue
 spread=max(dist(a,b) for a,b in itertools.combinations(ps,2));gid='dup-'+hashlib.sha256(('\0'.join(key)).encode()).hexdigest()[:16]
 status='same-coordinates' if spread<0.01 else ('within-100m' if spread<=100 else 'coordinate-conflict-over-100m')
 d={'groupId':gid,'name':ps[0]['name'],'address':ps[0]['address'],'ids':[p['id'] for p in ps],'spreadMeters':round(spread,3),'triage':status,'physicalIdentity':'pending-review','categories':sorted(set(p.get('category','') for p in ps))};dups.append(d)
 for p in ps:dmap[p['id']]=gid
official=list(csv.DictReader((W/'official-media.csv').open(encoding='cp949',newline='')));idx=collections.defaultdict(list)
for i,r in enumerate(official):
 try:lat,lon=float(r['위도']),float(r['경도']);valid=math.isfinite(lat) and math.isfinite(lon) and -90<=lat<=90 and -180<=lon<=180
 except (ValueError,TypeError):lat=lon=None;valid=False
 o={'csvRecord':i+1,'sequence':r['연번'],'name':r['장소명'],'address':r['주소'],'lat':lat,'lon':lon,'coordinateValid':valid,'sourceUpdatedAt':r['최종작성일']}
 if norm(o['name']) and norm(o['address']):idx[(norm(o['name']),norm(o['address']))].append(o)
catalog=json.loads((C/'catalog-11-v1.json').read_text(encoding='utf-8'));hashchecks={}
for c in catalog['items']:
 for n in c['names'].values():
  p=C/n['sourceFile'];h=sha(p);assert h==n['sourceSha256'];hashchecks[n['sourceFile']]=h
manual=[];nmap={}
for c in catalog['items']:
 for p in places:
  if norm(p['name'])==norm(c['name']) and road(p.get('address'))==road(c['address']):
   d=round(dist(p,c),3);m={'legacyId':p['id'],'canonicalId':c['id'],'legacyName':p['name'],'canonicalName':c['name'],'originalAddress':p['address'],'officialAddress':c['address'],'distanceMeters':d,'identity':'name-and-road-address-supported; independent-crosswalk-review-pending','coordinates':'review-difference' if d>100 else 'near-published-marker-not-entrance-verified','names':c['names'],'previousReview':c['independentReview'],'price':'unknown','artist':'unknown','publicEligible':False};manual.append(m);nmap[p['id']]=m
ledger=[];repairs=[];sourcecounts=collections.Counter();sourceids=set()
for p in places:
 os=idx.get((norm(p['name']),norm(p.get('address'))),[]);ds=[dist(p,o) for o in os if o['coordinateValid']]
 status='unlinked'
 if os:
  sourceids.add(p['id']);status='exact-name-address-coordinates-within-100m' if len(ds)==len(os) and max(ds)<=100 else 'exact-name-address-coordinate-review'
 sourcecounts[status]+=1
 flags=[]
 if not present(p.get('address')):flags.append('address-missing')
 if not (33<=p['lat']<=39 and 124<=p['lon']<=132):flags.append('outside-korea-triage-box')
 if os and status.endswith('review'):flags.append('official-coordinate-difference-or-invalid')
 if p['id'] in nmap and nmap[p['id']]['distanceMeters']>100:flags.append('reviewed-catalog-coordinate-difference')
 entry={'id':p['id'],'name':p['name'],'duplicateGroup':dmap.get(p['id']),'identityStatus':'pending-review','officialSourceStatus':status,'officialCsvRows':os,'multilingualEvidence':nmap.get(p['id']),'reviewFlags':flags,'price':'unknown','artist':'unknown','publicEligible':False};ledger.append(entry)
 if flags:repairs.append({'id':p['id'],'original':p,'flags':flags,'proposedOfficialRows':os,'action':'review-only; do not overwrite'})
def jsonl(name,rows):
 with (W/name).open('w',encoding='utf-8') as f:
  for r in rows:f.write(json.dumps(r,ensure_ascii=False)+'\n')
jsonl('place-linkage-local.jsonl',ledger);jsonl('duplicate-review-local.jsonl',dups);jsonl('address-coordinate-review-local.jsonl',repairs)
dump('multilingual-crosswalk.json',manual)
summary={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stage':'2 source linkage; partial factual verification','originalRows':len(places),'duplicateGroups':len(dups),'duplicateRows':sum(len(x['ids']) for x in dups),'duplicateTriage':dict(collections.Counter(x['triage'] for x in dups)),'officialDatasetRows':len(official),'officialSourceUrl':'https://www.data.go.kr/data/15111405/fileData.do','officialDownloadUrl':'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003000299&fileDetailSn=1&insertDataPrcus=N','officialCsvSha256':csvsha,'officialRowLinkCounts':dict(sourcecounts),'officialMatchedLegacyIds':len(sourceids),'multilingualLinkedLegacyRows':len(manual),'multilingualDistinctFacilities':len(set(x['canonicalId'] for x in manual)),'multilingualUnlinkedRows':len(places)-len(manual),'sourceLinkedUnionRows':len(sourceids|set(nmap)),'addressCoordinateReviewRows':len(repairs),'reviewFlags':dict(collections.Counter(f for r in repairs for f in r['flags'])),'originalGraphSha256':before,'originalGraphUnchanged':sha(G)==before,'catalogSha256':sha(C/'catalog-11-v1.json'),'cachedSourceHashes':hashchecks,'cachedEvidenceMeaning':'previous independent review reused after hash verification; not a fresh page or on-site review','automaticMerges':0,'newPublicApprovals':0,'searchExecuted':False,'productionChanged':False,'localLedgers':{n:sha(W/n) for n in ['place-linkage-local.jsonl','duplicate-review-local.jsonl','address-coordinate-review-local.jsonl','multilingual-crosswalk.json','rules-v1.json']}}
assert len(places)==40664 and len(dups)==3313
dump('linkage-result.json',summary);print(json.dumps(summary,ensure_ascii=False,indent=2))
