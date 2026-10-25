import csv
import hashlib
import io
import json
import unittest
from pathlib import Path
from scripts.audit_artist_place_lineage import build_audit, read_master
from src.api.artist_place_policy import legacy_general_place

ROOT = Path(__file__).resolve().parents[1]


class CandidateAuditTests(unittest.TestCase):
    def setUp(self):
        self.scope = {"items": [{"slug": "bts", "displayName": "BTS",
            "entityType": "music_group", "candidateAliases": ["방탄소년단"]},
            {"slug": "empty", "displayName": "Empty", "entityType": "channel", "candidateAliases": []}]}

    def row(self, name="Cafe", address="Seoul 1", artist="방탄소년단"):
        return {"아티스트": artist, "장소명": name, "주소": address}

    def test_duplicate_rows_preserve_source_row_numbers(self):
        summary, artists, candidates, _ = build_audit([self.row(), self.row()], self.scope, "a")
        self.assertEqual(summary["duplicateExtraRows"], 1)
        self.assertEqual(candidates[0]["sourceRows"], [2, 3])
        self.assertEqual(artists[1]["unique_candidates"], 0)

    def test_same_name_different_branch_never_merges(self):
        data = build_audit([self.row(), self.row(address="Busan 1")], self.scope, "a")
        self.assertEqual(data[0]["uniqueCandidateRelations"], 2)

    def test_missing_addresses_are_not_collapsed(self):
        self.assertEqual(build_audit([self.row(address=""), self.row(address="")], self.scope, "a")[0]["uniqueCandidateRelations"], 2)

    def test_extra_artists_are_not_silently_added(self):
        result = build_audit([self.row(artist="Other")], self.scope, "a")
        self.assertEqual(result[0]["targetArtists"], 2)
        self.assertEqual(result[3], {"Other": 1})

    def test_alias_is_candidate_not_verified_fact(self):
        summary, _, candidates, _ = build_audit([self.row()], self.scope, "a")
        self.assertIsNone(summary["factAccuracy"])
        self.assertIsNone(summary["verifiedCoverage"])
        self.assertFalse(candidates[0]["personalizedEligible"])
        self.assertEqual(candidates[0]["relationStatus"], "U")

    def test_ambiguous_alias_fails(self):
        self.scope["items"][1]["candidateAliases"] = ["방탄소년단"]
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            build_audit([self.row()], self.scope, "a")

    def test_live_master_replaces_seed_and_retains_unknown_artists(self):
        master = read_master({"data": {"items": [
            {"id": 700, "slug": "bts", "nameKo": "BTS"},
            {"id": 900, "slug": "new-creator", "nameKo": "New"}], "totalCount": 2}})
        summary, artists, _, _ = build_audit([self.row()], self.scope, "a", master)
        self.assertEqual([p["artist_id"] for p in artists], [700, 900])
        self.assertEqual(artists[1]["entity_type"], "unclassified")
        self.assertIn("approved", summary["scopeBasis"])

    def test_partial_paginated_export_fails(self):
        with self.assertRaisesRegex(ValueError, "incomplete_pagination"):
            read_master({"data": {"items": [], "totalCount": 60}})

    def test_duplicate_live_identity_fails(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            read_master({"data": {"items": [{"artistId": 1, "slug": "x"},
                {"artistId": 1, "slug": "y"}], "totalCount": 2}})

    def test_repository_artifacts_reproduce_and_keep_all_targets(self):
        scope = json.loads((ROOT/"dataset/policies/artist-place-scope.json").read_text(encoding="utf-8"))
        raw = (ROOT/"dataset/source/kculture_media/kcisa_media_locations_2023.csv").read_bytes()
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
        summary, artists, _, _ = build_audit(rows, scope, hashlib.sha256(raw.replace(b"\r\n",b"\n")).hexdigest())
        self.assertEqual(len(artists), 48)
        self.assertEqual(summary["sourceRows"], 1962)
        self.assertEqual(summary["artistsWithAliasCandidates"], 19)
        stored = json.loads((ROOT/"docs/2026-10-25/artist-place-lineage/summary.json").read_text(encoding="utf-8"))
        self.assertTrue(all(stored[k] == v for k,v in summary.items()))


class LegacyRecommendationPolicyTests(unittest.TestCase):
    def setUp(self):
        self.row = dict(contentId="legacy-1", title="Place", addr="Seoul",
            mapY=37.5, mapX=127, sourceUrl="https://official.example/place",
            artist="BTS", reviewStatus="APPROVED", verifiedAt="2026-10-01")

    def test_artist_claim_and_import_time_are_not_verification(self):
        result = legacy_general_place(self.row, "2026-10-25T00:00:00Z")
        self.assertEqual(result["artist"], "")
        self.assertFalse(result["personalizedEligible"])
        self.assertNotIn("verifiedAt", result)
        self.assertEqual(result["fetchedAt"], "2026-10-25T00:00:00Z")
        self.assertEqual(self.row["artist"], "BTS")

    def test_generic_location_keeps_its_identity_and_coordinates(self):
        result = legacy_general_place(self.row, "now")
        self.assertEqual((result["id"],result["lat"],result["lon"]), ("tour:legacy-1",37.5,127.0))
        self.assertEqual(result["hoursStatus"], "unknown")

    def test_invalid_evidence_or_coordinates_fail_closed(self):
        for change in ({"sourceUrl": "https://"}, {"sourceUrl":"https://u:p@host/x"},
                {"sourceUrl":123}, {"title":[]}, {"mapY":float("nan")},
                {"mapY":True}, {"mapX":139}, {"contentId":False}):
            with self.subTest(change=change):
                self.assertIsNone(legacy_general_place({**self.row, **change}, "now"))


class CatalogIntegrationTests(unittest.TestCase):
    def test_runtime_catalog_strips_claim_without_mutating_upstream(self):
        import os
        from unittest.mock import patch
        import httpx
        from src.api.public_search import public_catalog
        row = dict(contentId="1", title="Place", addr="Seoul", mapY=37.5, mapX=127,
                   sourceUrl="https://official.example/1", artist="BTS", reviewStatus="APPROVED")
        response = httpx.Response(200, json={"data":[row]},
                                  request=httpx.Request("GET","https://fixture.test"))
        with patch.dict(os.environ, {"KRIDE_PUBLIC_CATALOG_URL":"https://fixture.test"}, clear=True), \
                patch("src.api.public_search.curated_catalog", return_value={}), \
                patch("src.api.public_search.httpx.get", return_value=response):
            place = public_catalog()["tour:1"]
        self.assertEqual(place["artist"], "")
        self.assertNotIn("verifiedAt", place)
        self.assertIn("fetchedAt", place)
        self.assertEqual(row["artist"], "BTS")

    def test_official_curated_verification_is_preserved(self):
        import os
        from unittest.mock import patch
        import httpx
        from src.api.public_search import public_catalog
        curated = {"curated:seoul:1":{"artist":"","verifiedAt":"2026-10-01"}}
        response = httpx.Response(200,json={"data":[]},
                                  request=httpx.Request("GET","https://fixture.test"))
        with patch.dict(os.environ, {"KRIDE_PUBLIC_CATALOG_URL":"https://fixture.test"}, clear=True), \
                patch("src.api.public_search.curated_catalog", return_value=curated), \
                patch("src.api.public_search.httpx.get", return_value=response):
            self.assertEqual(public_catalog(), curated)


class SeedSafetyTests(unittest.TestCase):
    def test_migration_and_existing_output_paths_are_rejected(self):
        from scripts.build_holy_poi_seed import output_path
        with self.assertRaises(ValueError):
            output_path(ROOT/"subproject/SDUI/SDUI-server/src/main/resources/db/migration/V999__unsafe.sql")
        with self.assertRaises(ValueError):
            output_path(ROOT/"README.md")

    def test_generator_stages_pending_without_deleting_or_reapproving(self):
        import os
        import tempfile
        from unittest.mock import patch
        from scripts import build_holy_poi_seed as module
        base = "C:/Users/Samsung/AppData/Local/Temp" if os.name == "nt" else None
        with tempfile.TemporaryDirectory(dir=base) as folder:
            folder = Path(folder)
            with (folder/"kride_db_poi.csv").open("w",encoding="utf-8",newline="") as stream:
                w=csv.DictWriter(stream,fieldnames=["tmp_poi_id","name","address","category","sido","lat","lon"])
                w.writeheader()
                w.writerow(dict(tmp_poi_id="1",name="Cafe",address="Seoul 1",category="kpop",
                                sido="서울특별시",lat=37.5,lon=127))
                w.writerow(dict(tmp_poi_id="2",name="Cafe",address="Seoul 2",category="kpop",
                                sido="서울특별시",lat=37.5,lon=127))
            (folder/"kride_db_artist_poi.csv").write_text(
                "tmp_poi_id,artist_name\n1,BTS\n2,BTS\n",encoding="utf-8")
            output=folder/"pending.sql"
            with patch.object(module,"DATASET",folder):
                self.assertEqual(module.main(["--output",str(output)]),0)
            sql=output.read_text(encoding="utf-8")
            self.assertEqual(sql.count("'PENDING'"),2)
            self.assertNotIn("'APPROVED'",sql)
            self.assertNotIn("DELETE FROM",sql)
            self.assertIn("ON CONFLICT (content_id) DO NOTHING",sql)

class LiveSnapshotTests(unittest.TestCase):
    def test_read_only_transaction_exports_only_approved_fields(self):
        from deploy.hostinger.audit_artist_place import snapshot, SQL
        from unittest.mock import Mock
        payload={"snapshotOrigin":"hostinger_postgresql_read_only","data":{"items":[],"totalCount":0}}
        run=Mock(return_value=Mock(returncode=0,stdout=json.dumps(payload)))
        self.assertEqual(snapshot(run,lambda:"srv1869569"),payload)
        self.assertIn("REPEATABLE READ READ ONLY",SQL)
        self.assertIn("ROLLBACK",SQL)
        self.assertIn("WHERE approved_yn = 'Y'",SQL)
        self.assertNotIn("user_sqno",SQL)
        self.assertEqual(run.call_args.kwargs["input"],SQL)

    def test_snapshot_stops_on_unexpected_host_or_failed_query(self):
        from deploy.hostinger.audit_artist_place import snapshot
        from unittest.mock import Mock
        run=Mock(return_value=Mock(returncode=1,stdout=""))
        with self.assertRaisesRegex(RuntimeError,"unexpected_host"):
            snapshot(run,lambda:"other")
        run.assert_not_called()
        with self.assertRaisesRegex(RuntimeError,"snapshot_failed"):
            snapshot(run,lambda:"srv1869569")

if __name__ == "__main__":
    unittest.main()
