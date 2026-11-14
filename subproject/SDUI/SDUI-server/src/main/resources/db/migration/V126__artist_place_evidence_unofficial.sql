-- 2026-11-14: 아티스트-장소 근거에 '비공식(UNOFFICIAL)' 상태 추가.
-- 공식 자료나 언론은 장소 이름을 밝히지 않았지만 팬 자료가 같은 장소를 일관되게 가리키는 경우.
-- 화면에는 '비공식' 배지로 보이고, VERIFIED처럼 추천 코스(확정 근거)에는 들어가지 않는다.
-- 누가 그렇게 판단했는지 남기도록 reviewer를 필수로 한다.
ALTER TABLE artist_place_evidence DROP CONSTRAINT artist_place_evidence_status_check;
ALTER TABLE artist_place_evidence ADD CONSTRAINT artist_place_evidence_status_check
    CHECK (status IN ('PENDING','UNOFFICIAL','VERIFIED','REVOKED'));
ALTER TABLE artist_place_evidence ADD CONSTRAINT artist_place_evidence_unofficial_reviewer_check
    CHECK (status <> 'UNOFFICIAL' OR (reviewer IS NOT NULL AND length(trim(reviewer)) > 0));
