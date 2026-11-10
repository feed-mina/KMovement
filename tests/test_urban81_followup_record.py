"""Offline checks for the URBAN81 follow-up review record and its draft SQL.

The record must stay a hold/PENDING review: no production write, no VERIFIED
status, no group inheritance from Mingyu's solo appearance, and every value the
draft SQL relies on must stay inside the V125 table constraints.
"""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECORD = ROOT / "dataset/reviews/urban81-current-conditions-20261110.json"
DRAFT = ROOT / "docs/2026-11-10/urban81-followup/proposed_pending_rows.sql"
MIGRATIONS = ROOT / "subproject/SDUI/SDUI-server/src/main/resources/db/migration"
V125_ACTIONS = {"MV", "CONTENT_VISIT", "SNS", "POPUP", "ALBUM_PHOTO", "COLLABORATION_EVENT"}
TIME = re.compile(r"^\d{2}:\d{2}$")


def seconds(mmss):
    m, s = mmss.split(":")
    return int(m) * 60 + int(s)


class Urban81FollowupRecordTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.record = json.loads(RECORD.read_text(encoding="utf-8"))
        cls.draft = DRAFT.read_text(encoding="utf-8")

    def test_record_is_hold_without_production_write(self):
        self.assertEqual(self.record["decision"], "hold")
        self.assertIs(self.record["productionWrite"], False)

    def test_record_points_at_the_seed_row(self):
        seed = (MIGRATIONS / "V90__holy_poi_nationwide_seed.sql").read_text(encoding="utf-8")
        place = self.record["place"]
        self.assertIn(f"('{place['sourceContentId']}', 'HOLY', 'CRAWL', '{place['seedTitle']}', '{place['seedAddress']}'", seed)

    def test_member_evidence_does_not_inherit_to_group(self):
        video = self.record["originalVideo"]
        self.assertIs(video["groupInheritance"], False)
        self.assertIn("민규", video["member"])
        self.assertIn("only Mingyu appears", self.draft)

    def test_scenes_are_ordered_and_inside_the_video(self):
        scenes = self.record["originalVideo"]["scenes"]
        self.assertGreaterEqual(len(scenes), 3)
        last_end = 0
        for scene in scenes:
            self.assertRegex(scene["from"], TIME)
            self.assertRegex(scene["to"], TIME)
            self.assertLessEqual(last_end, seconds(scene["from"]))
            self.assertLess(seconds(scene["from"]), seconds(scene["to"]))
            last_end = seconds(scene["to"])
        self.assertLessEqual(last_end, 19 * 60 + 23)

    def test_unverified_values_are_labelled(self):
        cond = self.record["currentConditions"]
        self.assertNotIn("verified", cond["hours"]["status"].replace("not_field_verified", ""))
        self.assertEqual(cond["reservation"]["status"], "no_operator_terms")
        self.assertEqual(self.record["originalVideo"]["exactSeatContinuity"], "unknown")

    def test_minimum_cost_matches_the_cheapest_menu_item(self):
        cond = self.record["currentConditions"]
        cheapest = min(item["price"] for item in cond["menu"]["items"])
        self.assertEqual(cond["costPerPersonKrw"]["minimum"], cheapest)
        self.assertIn(f"\n  {cheapest},\n", self.draft)

    def test_draft_is_a_dry_run_with_pending_rows_only(self):
        self.assertTrue(self.draft.rstrip().splitlines()[-1].startswith("ROLLBACK;"))
        self.assertNotIn("'VERIFIED'", self.draft)
        self.assertEqual(self.draft.count("'PENDING'"), 2)
        self.assertNotRegex(self.draft, r"(?i)\b(update|delete)\s")
        self.assertFalse(list(MIGRATIONS.glob("*urban81*")))

    def test_draft_values_fit_v125_constraints(self):
        actions = set(re.findall(r"'([A-Z_]+)',\n  'https://", self.draft))
        self.assertTrue(actions)
        self.assertTrue(actions <= V125_ACTIONS)
        for url in re.findall(r"'(https?://[^']+)'", self.draft):
            self.assertRegex(url, r"^https://[^/]+")


if __name__ == "__main__":
    unittest.main()
