"""Policy and full generation tests use synthetic evidence, never production approvals."""
import copy,json,os,sys,unittest
from datetime import datetime,timezone
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import HTTPException
from src.api.recommendation_policy import candidates,open_slots,select_scope,verified_relations,check_budget
from src.api import public_itinerary as api

def fact(**extra):
    return {"status":"verified","verifiedAt":"2020-01-01T00:00:00+00:00",
            "reviewBy":"2099-01-01T00:00:00+00:00","sourceUrl":"https://official.example.test/proof",**extra}
def place(identity="poi:1",artist_id=1,cost=10000):
    return {"id":identity,"name":"검증 시험 장소","address":"서울 시험 주소","lat":37.5,"lon":127.0,"artist":"",
      "sourceUrl":"https://official.example.test/place","visibility":"PUBLIC",
      "openingHours":fact(weekly={str(d):[[540,1200]] for d in range(7)},dateOverrides={}),
      "cost":fact(amountKrw=cost,scope="per_person_visit",evidence="합성 시험용 1인 방문비"),
      "artistEvidence":[fact(artistId=artist_id,contentId=10,poiId=identity,action="CONTENT_VISIT",
         artistEvidence="공식 가수 신원 확인 부분",placeEvidence="주소와 점포 확인 부분",
         actionEvidence="방문 행동 확인 부분",locator="00:10-00:30")]}
def request(**changes):
    return api.PublicItineraryRequest(**{"artists":["표시 이름"],"artistIds":[1],"visitDate":"2026-10-26",
       "regions":["서울"],"budget":{"min":0,"max":30000},**changes})
class RecommendationPolicyTests(unittest.TestCase):
    def test_names_never_match(self):
        self.assertFalse(candidates(request(artistIds=[17]),{"poi:1":place()}))
    def test_group_never_inherits_to_member(self):
        self.assertFalse(verified_relations(place(),[38]))
    def test_url_alone_is_not_evidence(self):
        p=place();del p["artistEvidence"][0]["actionEvidence"]
        self.assertFalse(candidates(request(),{"poi:1":p}))
    def test_wrong_branch_is_rejected(self):
        p=place();p["artistEvidence"][0]["poiId"]="poi:2"
        self.assertFalse(candidates(request(),{"poi:1":p}))
    def test_expired_or_revoked_relation(self):
        for change in [{"status":"revoked"},{"reviewBy":"2021-01-01T00:00:00Z"}]:
            p=place();p["artistEvidence"][0].update(change)
            self.assertFalse(candidates(request(),{"poi:1":p}))
    def test_holiday_overrides_weekly_opening(self):
        p=place();p["openingHours"]["dateOverrides"]["2026-10-26"]=[]
        self.assertEqual(open_slots(p,"2026-10-26"),[])
    def test_only_holidays_and_hours_gate_visit(self):
        p=place();p.update(reservationRequired=True,lastOrder="08:00",popupEnded=True)
        self.assertEqual(open_slots(p,"2026-10-26"),["morning","afternoon","evening"])
    def test_partial_hours_filter_exact_slots(self):
        p=place();p["openingHours"]["weekly"]["0"]=[[780,800],[1080,1110]]
        self.assertEqual(open_slots(p,"2026-10-26"),["evening"])
    def test_unknown_hours_do_not_mean_open(self):
        p=place();del p["openingHours"]["weekly"]["0"]
        self.assertFalse(open_slots(p,"2026-10-26"))
    def test_unverified_hours_or_cost_excluded(self):
        for key in ["openingHours","cost"]:
            p=place();p[key]["status"]="pending"
            self.assertFalse(candidates(request(),{"poi:1":p}))
    def test_unknown_and_over_budget_costs_excluded(self):
        for value in [None,True,40000]:
            p=place();p["cost"]["amountKrw"]=value
            self.assertFalse(candidates(request(),{"poi:1":p}))
    def test_consent_not_needed_for_verified_artist(self):
        allowed,general=select_scope(request(),{"poi:1":place()})
        self.assertTrue(allowed);self.assertFalse(general)
    def test_no_automatic_general_fallback(self):
        with self.assertRaises(HTTPException) as e:
            select_scope(request(artistIds=[38]),{"poi:1":place()})
        self.assertEqual(e.exception.detail["code"],"consent_required")
    def test_explicit_general_still_checks_time_and_budget(self):
        req=request(artistIds=[38],acknowledgeUnverifiedConditions=True)
        p=place();allowed,general=select_scope(req,{"poi:1":p})
        self.assertTrue(allowed);self.assertTrue(general)
        p["cost"]["amountKrw"]=40000
        self.assertFalse(select_scope(req,{"poi:1":p})[0])
        p["cost"]["amountKrw"]=10000;p["openingHours"]["dateOverrides"][req.visitDate]=[]
        self.assertFalse(select_scope(req,{"poi:1":p})[0])
    def test_budget_checks_whole_course(self):
        p=place();p.update(allowedSlots=["morning","afternoon"],visitCostKrw=20000)
        q={**p,"id":"poi:2"}
        plan=api.ground_plan({"itinerary":[{"morning":{"places":[{"poiId":"poi:1"}]},"afternoon":{"places":[{"poiId":"poi:2"}]}}]},
                            {"poi:1":p,"poi:2":q},strict=True)
        self.assertEqual(check_budget(plan,{"min":0,"max":30000}),(False,40000))
    def test_generated_slot_outside_hours_rejected(self):
        p=place();p.update(allowedSlots=["afternoon"],visitCostKrw=10000)
        plan=api.ground_plan({"itinerary":[{"morning":{"places":[{"poiId":"poi:1"}]}}]},{"poi:1":p},strict=True)
        self.assertEqual(plan["resolvedMarkerCount"],0)
    def test_invalid_budget_and_missing_date(self):
        for req in [request(visitDate=None),request(budget={"min":True,"max":20}),request(budget={"min":20,"max":10})]:
            with self.assertRaises(HTTPException):api.validate_preferences(req)
    def test_name_only_selection_rejected(self):
        with self.assertRaises(HTTPException):api.validate_preferences(request(artistIds=[]))

    def generate(self,initial,current,raw,req=None):
        req=req or request()
        response=SimpleNamespace(usage=object(),choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(raw)))])
        create=unittest.mock.Mock(return_value=response)
        client=SimpleNamespace(close=lambda:None,chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with patch.dict(os.environ,{"GROQ_API_KEY":"synthetic"}),patch.dict(sys.modules,{"groq":SimpleNamespace(Groq=lambda **kw:client)}),\
             patch.object(api,"public_catalog",side_effect=[initial,current]),patch.object(api,"validate_signing_configuration"),\
             patch.object(api.ai_runtime,"model_settings",return_value=("synthetic",100)),patch.object(api,"reserve_budget",return_value="r"),\
             patch.object(api,"record_usage",return_value={"inputTokens":1}),patch.object(api,"issue_context",return_value={}):
            result=api.generate_public(req,"7")
        return result,json.loads(create.call_args.kwargs["messages"][1]["content"])
    def test_prompt_only_contains_filtered_candidates(self):
        p=place();wrong=place("poi:2",38);expensive=place("poi:3",1,50000)
        result,prompt=self.generate({"poi:1":p,"poi:2":wrong,"poi:3":expensive},{"poi:1":p},
            {"itinerary":[{"morning":{"places":[{"poiId":"poi:1"}]}}]})
        self.assertEqual([r["poiId"] for r in prompt["candidates"]],["poi:1"])
        self.assertEqual(result["resolvedMarkerCount"],1)
    def test_recheck_revoked_relation_after_generation(self):
        p=place();q=copy.deepcopy(p);q["artistEvidence"][0]["status"]="revoked"
        result,_=self.generate({"poi:1":p},{"poi:1":q},{"itinerary":[{"morning":{"places":[{"poiId":"poi:1"}]}}]})
        self.assertEqual(result["resolvedMarkerCount"],0)
    def test_recheck_hours_and_cost_after_generation(self):
        for field in ["cost","openingHours"]:
            p=place();q=copy.deepcopy(p);q[field]["status"]="revoked"
            result,_=self.generate({"poi:1":p},{"poi:1":q},{"itinerary":[{"morning":{"places":[{"poiId":"poi:1"}]}}]})
            self.assertFalse(result["itinerary"])
    def test_final_course_over_budget_is_not_returned(self):
        p=place(cost=20000);q=place('poi:2',cost=20000)
        result,_=self.generate({'poi:1':p,'poi:2':q},{'poi:1':p,'poi:2':q},
          {'itinerary':[{'morning':{'places':[{'poiId':'poi:1'}]},'afternoon':{'places':[{'poiId':'poi:2'}]}}]})
        self.assertFalse(result['itinerary']);self.assertEqual(result['status'],'empty_result')
    def test_other_region_cannot_block_requested_region_fallback(self):
        p=place();p['address']='부산 시험 주소'
        q=place('poi:2',artist_id=38)
        with self.assertRaises(HTTPException):
            select_scope(request(),{'poi:1':p,'poi:2':q})
        allowed,general=select_scope(request(acknowledgeUnverifiedConditions=True),{'poi:1':p,'poi:2':q})
        self.assertEqual(list(allowed),['poi:2']);self.assertTrue(general)
    def test_new_db_facts_do_not_change_immutable_search_index_contract(self):
        from src.api.public_search import search_public
        indexed={'id':'curated:one','catalogSha256':'fixture-sha'}
        with patch('src.api.multilingual_catalog.search_reviewed',return_value=[]) as search:
            search_public(None,None,{'curated:one':indexed,'poi:1':place()},'서울','fixture-model')
            self.assertEqual(search.call_args.args[2],{'curated:one':indexed})
    def test_no_paid_call_when_no_verified_candidates(self):
        with patch.object(api,"public_catalog",return_value={"poi:1":place(cost=50000)}),\
             patch.object(api,"validate_signing_configuration"),patch.object(api,"reserve_budget") as paid:
            result=api.generate_public(request(),"7")
            self.assertEqual(result["status"],"empty_candidates");paid.assert_not_called()
if __name__=="__main__":unittest.main()
