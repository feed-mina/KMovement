import unittest
from scripts.review_artist_place_identity import compare,distance
def row(name,address,artist="그룹",lat="37",lon="127"):
    return {"장소명":name,"주소":address,"아티스트":artist,"위도":lat,"경도":lon}
def snap(places):
    return {"places":places}
def place(id,name,address,lat=37,lon=127):
    return {"id":id,"name":name,"address":address,"lat":lat,"lon":lon}
class IdentityBranchReviewTests(unittest.TestCase):
    def test_name_alone_does_not_match_other_branch(self):
        result,_,_,_=compare([row("카페","서울")],snap([place(3,"카페","부산")]),set())
        self.assertEqual(result[0]["match"],"same_name_address_differs")
        self.assertEqual(result[0]["dbIds"],[])
    def test_same_coordinates_do_not_override_address(self):
        result,_,_,_=compare([row("호텔","본관")],snap([place(3,"호텔","별관")]),set())
        self.assertEqual(result[0]["dbIds"],[])
    def test_same_building_keeps_different_venues(self):
        results,groups,_,_=compare([row("시장","주소"),row("칼국수","주소")],snap([]),set())
        self.assertEqual(len(results),2);self.assertEqual(len(groups),1)
        self.assertEqual(groups[0]["decision"],"hold_no_automatic_merge")
    def test_coordinate_conflict_is_visible(self):
        r,_,_,_=compare([row("카페","주소")],snap([place(3,"카페","주소",38,127)]),set())
        self.assertGreater(r[0]["maxExactMatchDistanceM"],50)
        self.assertFalse(r[0]["artistVisitVerified"])
    def test_group_labels_never_inherit_to_member(self):
        r,_,_,_=compare([row("카페","주소","그룹")],snap([place(3,"카페","주소")]),set())
        self.assertEqual(r[0]["sourceArtistLabels"],["그룹"])
        self.assertFalse(r[0]["mergeApplied"])
    def test_deferred_labels_are_excluded(self):
        r,_,_,total=compare([row("카페","주소","보류")],snap([]),{"보류"})
        self.assertEqual((r,total),([],0))
    def test_exact_text_is_only_a_candidate(self):
        r,_,_,_=compare([row(" 카페 ","주소")],snap([place(3,"카페","주소")]),set())
        self.assertEqual(r[0]["dbIds"],[3]);self.assertFalse(r[0]["artistVisitVerified"])
if __name__=="__main__":unittest.main()
