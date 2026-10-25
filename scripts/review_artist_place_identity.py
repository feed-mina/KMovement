"""Reproducible, read-only comparison of public artist/place metadata. Never merges records."""
import argparse,csv,hashlib,json,math,re
from collections import defaultdict,Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def key(value):
    return re.sub(r"\s+"," ",str(value or "").strip()).casefold()
def distance(a,b):
    try:
        x,y=map(math.radians,[float(a["lat"]),float(b["lat"])])
        dx=y-x;dy=math.radians(float(b["lon"])-float(a["lon"]))
        return 6371000*2*math.asin(min(1,math.sqrt(math.sin(dx/2)**2+math.cos(x)*math.cos(y)*math.sin(dy/2)**2)))
    except (ValueError,TypeError,KeyError): return None
def compare(rows,snapshot,deferred):
    selected=[r for r in rows if r["아티스트"] not in deferred]
    buckets=defaultdict(list); exact=defaultdict(list); names=defaultdict(list)
    for n,r in enumerate(rows,2):
        if r["아티스트"] not in deferred: buckets[(key(r["장소명"]),key(r["주소"]))].append((n,r))
    for p in snapshot["places"]:
        exact[(key(p["name"]),key(p["address"]))].append(p);names[key(p["name"])].append(p)
    results=[]
    for (name,address),items in sorted(buckets.items()):
        hits=exact.get((name,address),[])
        same=names.get(name,[])
        result={"name":items[0][1]["장소명"],"address":items[0][1]["주소"],
          "csvRows":[n for n,r in items],"sourceArtistLabels":sorted({r["아티스트"] for n,r in items}),
          "match":"exact_text" if hits else ("same_name_address_differs" if same else "unresolved_name"),
          "dbIds":[p["id"] for p in hits],"sameNameCandidates":[{"id":p["id"],"name":p["name"],"address":p["address"]} for p in same] if not hits else [],
          "artistVisitVerified":False,"mergeApplied":False}
        distances=[distance({"lat":r["위도"],"lon":r["경도"]},p) for n,r in items for p in hits]
        result["maxExactMatchDistanceM"]=round(max((d for d in distances if d is not None),default=0),1) if hits else None
        results.append(result)
    shared=defaultdict(set)
    for name,address in buckets: shared[address].add(name)
    groups=[{"address":a,"names":sorted(n),"decision":"hold_no_automatic_merge"} for a,n in sorted(shared.items()) if len(n)>1]
    return results,groups,Counter(x["match"] for x in results),len(selected)
def write_csv(path,items):
    if not items:return
    with path.open("w",encoding="utf-8",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=list(items[0]),lineterminator="\n");writer.writeheader()
        writer.writerows({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in row.items()} for row in items)
def main():
    p=argparse.ArgumentParser();p.add_argument("--snapshot",type=Path,required=True);p.add_argument("--output",type=Path,required=True)
    a=p.parse_args();raw=a.snapshot.read_bytes();s=json.loads(raw)
    policy=json.loads((ROOT/"dataset/policies/artist-catalog-expansion.json").read_text(encoding="utf-8"))
    rows=list(csv.DictReader((ROOT/"dataset/source/kculture_media/kcisa_media_locations_2023.csv").open(encoding="utf-8-sig")))
    results,groups,counts,total=compare(rows,s,{v["name"] for v in policy["deferred"]})
    # Exact aliases only; group membership is never an alias.
    catalog=list(csv.DictReader((a.output/"live-catalog/combined-catalog.csv").open(encoding="utf-8")))
    crosswalk=[]
    links=Counter(r["contentId"] for r in s["relations"])
    for c in s["contents"]:
        matches=[r for r in catalog if key(c["name"]) in {key(r["displayName"]),key(r["slug"]),*(key(x) for x in json.loads(r["aliases"]))}]
        crosswalk.append({"contentId":c["id"],"contentName":c["name"],"candidateArtistIds":[r["artistId"] for r in matches if r["artistId"]],
            "candidateRecordKeys":[r["recordKey"] for r in matches],
            "status":"unique_exact_alias_candidate" if len(matches)==1 else "hold",
            "rawLegacyLinkCount":links[c["id"]],"artistVisitVerified":False,"inheritedGroupLinks":0})
    summary={"capturedAt":s["capturedAt"],"snapshotSha256":hashlib.sha256(raw).hexdigest(),
       "workflowRun":"https://github.com/feed-mina/KMovement/actions/runs/40168383015",
       "liveArtists":len(s["data"]["items"]),"liveContents":len(s["contents"]),"liveRelations":len(s["relations"]),"livePlaces":len(s["places"]),
       "selectedCsvRows":total,"nameAddressBuckets":len(results),"placeMatches":dict(counts),
       "exactMatchCoordinateConflictsOver50M":sum((r["maxExactMatchDistanceM"] or 0)>50 for r in results),
       "sharedAddressDifferentNames":len(groups),"contentCrosswalk":dict(Counter(r["status"] for r in crosswalk)),
       "databaseModified":False,"artistIdsReassigned":0,"placeIdsMerged":0,"inheritedGroupLinks":0,
       "verificationNote":"Text matching and desk review do not verify artist visits or current opening hours."}
    a.output.mkdir(parents=True,exist_ok=True)
    write_csv(a.output/"place-comparison.csv",results);write_csv(a.output/"place-exceptions.csv",[r for r in results if r["match"]!="exact_text"])
    write_csv(a.output/"shared-address-review.csv",groups);write_csv(a.output/"content-artist-crosswalk.csv",crosswalk)
    (a.output/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False))
if __name__=="__main__":main()
