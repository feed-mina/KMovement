import copy
import json
import unittest
from pathlib import Path
from scripts.reconcile_artist_catalog import reconcile, validate_live_master

ROOT = Path(__file__).resolve().parents[1]


class CatalogReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.policy = dict(placePolicy="explicit_artist_only_no_group_or_channel_inheritance",
            retained=[dict(slug="아이유(IU)", displayName="아이유(IU)", entityType="music_individual",
                           aliases=["아이유", "IU"], artistId=None),
                      dict(slug="차은우", displayName="차은우", entityType="music_individual",
                           aliases=["차은우"], artistId=None)],
            incoming=[dict(name="New artist", aliases=[], inheritGroupPlaces=False)],
            deferred=[dict(name="2:00 AM")])

    def master(self, extra=()):
        items=[dict(id=7101,slug="아이유(IU)",nameKo="아이유",nameEn="IU",approvedYn="Y"),
               dict(id=9207,slug="차은우",nameKo="차은우",approvedYn="Y"),*extra]
        return dict(masterScope="all_artists",allArtistCount=len(items),
                    data=dict(totalCount=len(items),items=items))

    def test_retains_iu_and_cha_even_when_not_in_new_names(self):
        summary, records, _ = reconcile(self.policy)
        self.assertEqual([r["slug"] for r in records[:2]],["아이유(IU)","차은우"])
        self.assertEqual(summary["retainedCount"],2)

    def test_existing_alias_is_duplicate_not_new(self):
        summary, records, decisions = reconcile(self.policy,incoming=[dict(name="IU")])
        self.assertEqual(summary["duplicateCount"],1)
        self.assertEqual(summary["newCount"],0)
        self.assertEqual(decisions[0]["matchedSlugs"],["아이유(IU)"])
        self.assertEqual(len(records),2)

    def test_live_ids_survive_and_input_is_not_mutated(self):
        payload=self.master()
        before=copy.deepcopy(payload)
        live=validate_live_master(payload)
        summary, records, _=reconcile(self.policy,live)
        self.assertEqual([r["artistId"] for r in records],[7101,9207,None])
        self.assertEqual(summary["existingIdsReassigned"],0)
        self.assertEqual(payload,before)

    def test_disapproved_existing_artist_is_not_duplicated_or_reapproved(self):
        payload=self.master();payload["data"]["items"][0]["approvedYn"]="N"
        summary, records, decisions=reconcile(self.policy,validate_live_master(payload),
                                              incoming=[dict(name="아이유")])
        self.assertEqual(decisions[0]["matchedArtistIds"],[7101])
        self.assertEqual(records[0]["approvedYn"],"N")
        self.assertEqual(summary["newCount"],0)

    def test_repeated_name_with_case_and_spacing_does_not_create_second_record(self):
        summary, records, decisions=reconcile(self.policy,incoming=[
            dict(name="New Artist"),dict(name="  NEW   ARTIST ")])
        self.assertEqual((summary["newCount"],summary["duplicateCount"]),(1,1))
        self.assertEqual(decisions[0]["proposedKey"],decisions[1]["proposedKey"])
        self.assertEqual(len(records),3)

    def test_ambiguous_existing_matches_are_held_and_both_ids_preserved(self):
        extra=[dict(id=11,slug="same-one",nameKo="Same",approvedYn="Y"),
               dict(id=12,slug="same-two",nameKo="Same",approvedYn="Y")]
        summary, records, decisions=reconcile(self.policy,validate_live_master(self.master(extra)),
                                              incoming=[dict(name="Same")])
        self.assertEqual(summary["holdCount"],1)
        self.assertEqual(decisions[0]["matchedArtistIds"],[11,12])
        self.assertEqual({r["artistId"] for r in records},{7101,9207,11,12})

    def test_ambiguous_new_aliases_are_not_merged(self):
        summary, _, decisions=reconcile(self.policy,incoming=[
            dict(name="One",aliases=["x"]),dict(name="Two",aliases=["y"]),
            dict(name="Three",aliases=["x","y"])])
        self.assertEqual((summary["newCount"],summary["holdCount"]),(2,1))
        self.assertEqual(decisions[2]["reason"],"ambiguous_new_batch_aliases")

    def test_deferred_names_do_not_enter_catalog(self):
        summary, records, decisions=reconcile(self.policy,incoming=[dict(name="2:00 AM")])
        self.assertEqual(summary["holdCount"],1)
        self.assertEqual(decisions[0]["reason"],"user_deferred_do_not_register")
        self.assertEqual(len(records),2)

    def test_group_and_member_stay_separate_without_place_inheritance(self):
        policy=copy.deepcopy(self.policy)
        policy["retained"] += [dict(slug="ive",displayName="IVE",entityType="music_group",
                                   aliases=["아이브"],artistId=None)]
        summary, records, decisions=reconcile(policy,incoming=[dict(name="장원영")])
        self.assertEqual(decisions[0]["classification"],"new")
        self.assertTrue(all(r["inheritGroupPlaces"] is False for r in records))
        self.assertTrue(all(r["placeRelationsAdded"]==0 for r in records))
        self.assertEqual(summary["groupPlaceRelationsInherited"],0)

    def test_requesting_inheritance_fails(self):
        with self.assertRaisesRegex(ValueError,"inheritance_forbidden"):
            reconcile(self.policy,incoming=[dict(name="Member",inheritGroupPlaces=True)])

    def test_group_individual_type_conflict_is_held(self):
        summary, _, decisions=reconcile(self.policy,incoming=[
            dict(name="아이유",entityType="music_group")])
        self.assertEqual(summary["holdCount"],1)
        self.assertEqual(decisions[0]["reason"],"entity_type_conflict")

    def test_partial_or_approved_only_master_is_rejected(self):
        for change in [dict(masterScope="approved_artists"),dict(allArtistCount=99)]:
            with self.subTest(change=change),self.assertRaises(ValueError):
                validate_live_master({**self.master(),**change})

    def test_invalid_or_duplicate_ids_are_rejected(self):
        for identity in [None,0,True,9207]:
            payload=self.master();payload["data"]["items"][0]["id"]=identity
            with self.subTest(identity=identity),self.assertRaises(ValueError):
                validate_live_master(payload)

    def test_missing_original_artist_in_live_snapshot_stops_reconciliation(self):
        payload=self.master()
        payload["data"]["items"]=payload["data"]["items"][:1]
        payload["data"]["totalCount"]=payload["allArtistCount"]=1
        with self.assertRaisesRegex(ValueError,"retained_artist_missing"):
            reconcile(self.policy,validate_live_master(payload))

    def test_malformed_alias_string_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"invalid_alias_list"):
            reconcile(self.policy,incoming=[dict(name="Other",aliases="IU")])

    def test_source_registry_reproduces_without_guessing_numeric_ids(self):
        policy=json.loads((ROOT/"dataset/policies/artist-catalog-expansion.json").read_text(encoding="utf-8"))
        summary, records, decisions=reconcile(policy)
        self.assertEqual((summary["retainedCount"],summary["incomingCount"]),(48,92))
        self.assertEqual((summary["duplicateCount"],summary["newCount"],summary["holdCount"]),(0,92,0))
        self.assertEqual(len(records),140)
        self.assertEqual(summary["deferredOutsideIncoming"],5)
        self.assertTrue(all(r["artistId"] is None for r in records))
        self.assertEqual(len({r["recordKey"] for r in records}),140)
        self.assertIn("아이유(IU)",{r["slug"] for r in records})
        self.assertIn("차은우",{r["slug"] for r in records})
        stored=json.loads((ROOT/"docs/2026-10-25/artist-catalog-reconciliation/summary.json").read_text(encoding="utf-8"))
        self.assertEqual(stored,summary)
        self.assertEqual(len(decisions),92)


if __name__ == "__main__":
    unittest.main()
