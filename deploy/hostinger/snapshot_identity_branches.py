"""Read-only snapshot of artist IDs and non-UGC K-pop place metadata."""
import json
import socket
import subprocess
import sys

SQL = """
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SELECT json_build_object(
 'contract','kride-identity-branch-snapshot-v1',
 'capturedAt',CURRENT_TIMESTAMP,
 'masterScope','all_artists',
 'allArtistCount',(SELECT COUNT(*) FROM artist),
 'data',json_build_object(
   'totalCount',(SELECT COUNT(*) FROM artist),
   'items',(SELECT COALESCE(json_agg(a ORDER BY a.id),'[]'::json)
     FROM (SELECT artist_id AS id,slug,name_ko AS "nameKo",name_en AS "nameEn",
                  approved_yn AS "approvedYn" FROM artist) a)),
 'contents',(SELECT COALESCE(json_agg(c ORDER BY c.id),'[]'::json)
     FROM (SELECT content_sqno AS id,source_ref AS "sourceRef",name,name_en AS "nameEn",category
           FROM holy_content WHERE category='kpop') c),
 'relations',(SELECT COALESCE(json_agg(r ORDER BY r.id),'[]'::json)
     FROM (SELECT l.link_id AS id,l.content_sqno AS "contentId",l.poi_sqno AS "poiId",l.relationship
           FROM holy_content_poi l JOIN holy_content c ON c.content_sqno=l.content_sqno
           JOIN tour_poi p ON p.poi_sqno=l.poi_sqno
           WHERE c.category='kpop' AND p.source <> 'UGC') r),
 'places',(SELECT COALESCE(json_agg(p ORDER BY p.id),'[]'::json)
     FROM (SELECT p.poi_sqno AS id,p.content_id AS "sourceId",p.title AS name,p.addr AS address,
             p.map_y AS lat,p.map_x AS lon,p.source,p.source_url AS "sourceUrl",
             p.artist AS "legacyArtist",p.review_status AS "reviewStatus"
           FROM tour_poi p WHERE p.source <> 'UGC'
             AND EXISTS(SELECT 1 FROM holy_content_poi l JOIN holy_content c
                ON c.content_sqno=l.content_sqno
                WHERE l.poi_sqno=p.poi_sqno AND c.category='kpop')) p)
);
ROLLBACK;
"""


def snapshot(run=subprocess.run, hostname=socket.gethostname):
    if hostname() != "srv1869569":
        raise RuntimeError("unexpected_host")
    result = run(
        ["docker","exec","-i","kmovement-g1-postgres-1","sh","-lc",
         'exec psql -X -q -t -A -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
        input=SQL, text=True, capture_output=True, timeout=55)
    if result.returncode:
        raise RuntimeError("read_only_snapshot_failed")
    data = json.loads(result.stdout.strip())
    if (data.get("contract") != "kride-identity-branch-snapshot-v1"
            or data.get("allArtistCount") != len(data.get("data",{}).get("items",[]))):
        raise RuntimeError("invalid_snapshot")
    return data


if __name__ == "__main__":
    try:
        print(json.dumps(snapshot(),ensure_ascii=True))
    except Exception as error:
        print("Read-only metadata snapshot failed: "+type(error).__name__,file=sys.stderr)
        sys.exit(1)
