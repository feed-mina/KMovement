"""Real PostgreSQL test database only. No production connection or network evidence fetch."""
import gzip,json,os,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
@unittest.skipUnless(os.environ.get("KRIDE_POLICY_TEST_DSN"),"isolated PostgreSQL fixture not configured")
class ArtistEvidencePostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg
        cls.pg=psycopg
        cls.conn=psycopg.connect(os.environ["KRIDE_POLICY_TEST_DSN"])
        cls.conn.execute("""
            CREATE TABLE artist(artist_id bigint primary key,slug text,approved_yn text);
            CREATE TABLE holy_content(content_sqno bigint primary key,source_ref text unique);
            CREATE TABLE tour_poi(poi_sqno bigint primary key,title text,addr text,map_y double precision,map_x double precision,review_status text,source text default 'CRAWL');
            CREATE TABLE holy_content_poi(content_sqno bigint references holy_content,poi_sqno bigint references tour_poi,unique(content_sqno,poi_sqno));
            CREATE TABLE query_master(sql_key text,query_text text,updated_at timestamptz);
            INSERT INTO query_master(sql_key) VALUES ('kride_artist_list');
        """)
        live=json.loads(gzip.decompress((ROOT/"docs/2026-10-25/identity-branch-review/production-public-snapshot.json.gz").read_bytes()))
        with cls.conn.cursor() as c:
            c.executemany("INSERT INTO artist VALUES (%s,%s,%s)",[(a["id"],a["slug"],a["approvedYn"]) for a in live["data"]["items"]])
            c.executemany("INSERT INTO holy_content VALUES (%s,%s)",[(v["id"],v["sourceRef"]) for v in live["contents"]])
            c.executemany("INSERT INTO tour_poi(poi_sqno,title,addr,map_y,map_x,review_status) VALUES (%s,%s,%s,%s,%s,%s)",[(v["id"],v["name"],v["address"],v["lat"],v["lon"],v["reviewStatus"]) for v in live["places"]])
            c.executemany("INSERT INTO holy_content_poi VALUES (%s,%s)",[(r["contentId"],r["poiId"]) for r in live["relations"]])
        cls.conn.execute((ROOT/"subproject/SDUI/SDUI-server/src/main/resources/db/migration/V125__artist_identity_evidence_and_visit_policy.sql").read_text(encoding="utf-8"))
        cls.conn.commit()
    @classmethod
    def tearDownClass(cls):cls.conn.close()
    def tearDown(self):self.conn.rollback()
    def tuple(self):
        return self.conn.execute("SELECT a.content_sqno,a.artist_id,h.poi_sqno FROM holy_content_artist a JOIN holy_content_poi h USING(content_sqno) WHERE artist_id=1 LIMIT 1").fetchone()
    def insert_policy(self):
        cid,aid,pid=self.tuple()
        self.conn.execute("""
          INSERT INTO poi_visit_policy(poi_sqno,poi_name_snapshot,poi_address_snapshot,poi_lat_snapshot,poi_lon_snapshot,weekly_hours,hours_source_url,
          cost_krw,cost_source_url,cost_evidence,status,verified_at,review_by,reviewer)
          SELECT poi_sqno,title,addr,map_y,map_x,%s::jsonb,'https://official.example.test/hours',10000,
          'https://official.example.test/cost','SYNTHETIC cost fixture','VERIFIED',now(),now()+interval '1 day','fixture-reviewer'
          FROM tour_poi WHERE poi_sqno=%s
        """,(json.dumps({str(d):[[540,1200]] for d in range(7)}),pid))
        return cid,aid,pid
    def insert_evidence(self):
        cid,aid,pid=self.insert_policy()
        self.conn.execute("""
          INSERT INTO artist_place_evidence(content_sqno,artist_id,poi_sqno,poi_name_snapshot,poi_address_snapshot,poi_lat_snapshot,poi_lon_snapshot,action,
          source_url,artist_evidence,place_evidence,action_evidence,locator,status,verified_at,review_by,reviewer)
          SELECT %s,%s,poi_sqno,title,addr,map_y,map_x,'CONTENT_VISIT','https://official.example.test/video','SYNTHETIC identity',
          'SYNTHETIC branch','SYNTHETIC action','00:10','VERIFIED',now(),now()+interval '1 day','fixture-reviewer'
          FROM tour_poi WHERE poi_sqno=%s
        """,(cid,aid,pid))
        return cid,aid,pid
    def test_numeric_backfill_preserves_ids_and_never_promotes_visits(self):
        self.assertEqual(self.conn.execute("SELECT count(*) FROM holy_content_artist").fetchone()[0],20)
        self.assertEqual(self.conn.execute("SELECT count(*) FROM artist_place_evidence").fetchone()[0],0)
        self.assertEqual(self.conn.execute("SELECT artist_id FROM artist WHERE slug='아이유(IU)'").fetchone()[0],17)
        self.assertIn('artist_id AS "artistId"',self.conn.execute("SELECT query_text FROM query_master").fetchone()[0])
    def test_url_only_cannot_verify(self):
        cid,aid,pid=self.tuple()
        with self.assertRaises(self.pg.errors.NotNullViolation):
            with self.conn.transaction():
                self.conn.execute("INSERT INTO artist_place_evidence(content_sqno,artist_id,poi_sqno,action,source_url,status) VALUES (%s,%s,%s,'SNS','https://example.test','VERIFIED')",(cid,aid,pid))
    def test_composite_fk_blocks_unlinked_member(self):
        cid,aid,pid=self.insert_evidence()
        with self.assertRaises(self.pg.errors.ForeignKeyViolation):
            with self.conn.transaction():
                self.conn.execute("UPDATE artist_place_evidence SET artist_id=38")
    def test_verified_row_without_reviewer_is_rejected(self):
        self.insert_evidence()
        with self.assertRaises(self.pg.errors.CheckViolation):
            with self.conn.transaction():self.conn.execute("UPDATE artist_place_evidence SET reviewer=NULL")
    def test_verified_payload_and_revocation(self):
        cid,aid,pid=self.insert_evidence()
        payload=self.conn.execute("SELECT payload FROM verified_visit_catalog WHERE poi_sqno=%s",(pid,)).fetchone()[0]
        self.assertEqual(payload["artistEvidence"][0]["artistId"],1)
        self.assertEqual(payload["artistEvidence"][0]["poiId"],"poi:"+str(pid))
        self.conn.execute("UPDATE artist_place_evidence SET status='REVOKED'")
        payload=self.conn.execute("SELECT payload FROM verified_visit_catalog WHERE poi_sqno=%s",(pid,)).fetchone()[0]
        self.assertEqual(payload["artistEvidence"],[])
        self.conn.execute("UPDATE poi_visit_policy SET status='REVOKED'")
        self.assertEqual(self.conn.execute("SELECT count(*) FROM verified_visit_catalog").fetchone()[0],0)
    def test_renamed_business_requires_fresh_branch_review(self):
        cid,aid,pid=self.insert_evidence()
        self.conn.execute("UPDATE tour_poi SET title='SYNTHETIC replacement shop' WHERE poi_sqno=%s",(pid,))
        self.assertEqual(self.conn.execute("SELECT count(*) FROM verified_visit_catalog").fetchone()[0],0)
    def test_address_edit_invalidates_old_branch_review(self):
        cid,aid,pid=self.insert_evidence()
        self.conn.execute("UPDATE tour_poi SET addr='SYNTHETIC different branch' WHERE poi_sqno=%s",(pid,))
        self.assertEqual(self.conn.execute("SELECT count(*) FROM verified_visit_catalog").fetchone()[0],0)
if __name__=="__main__":unittest.main()
