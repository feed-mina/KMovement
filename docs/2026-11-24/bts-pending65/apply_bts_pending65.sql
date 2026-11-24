-- BTS 보류 64곳 판정 (2026-11-24, 민아님 지시: Claude 추천대로 반영). 돈의문(3745)은 검수 2차에서 이미 아님 처리.
--   비공식 16곳: 팬·여행 자료나 기사 한 곳이 이 장소를 가리킴(공식 원본 없음)
--   아님 48곳: 1~5묶음 조사와 2026-11-24 재검색에서 근거를 못 찾았거나, 폐업·이전·장소 혼동
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_bts_pending65.sql
-- 되돌리기: tmp_b65 의 poi_sqno 로 bts 행을 status='PENDING', reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_b65(poi_sqno bigint, title text, new_status text, note text) ON COMMIT DROP;
INSERT INTO tmp_b65 VALUES
  (3663,'금강산대게횟집','UNOFFICIAL','에스콰이어 코리아 기사(뷔 추천), 상가정보 2025-12 영업 확인'),
  (3665,'달아실','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3666,'소양강댐 물 문화관','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3667,'어스17','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3669,'원조연탄갈비','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3672,'포러데이 팔당','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3686,'달성공원','UNOFFICIAL','지역 신문 칼럼 1건'),
  (3702,'듀자미','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3723,'화랑대 철도공원','UNOFFICIAL','팬 글·해외 기사'),
  (3727,'평화의 공원','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3734,'성수연방','UNOFFICIAL','팬 블로그'),
  (3735,'멜로워 성수 더 플래그쉽','REVOKED','근거 없음, 상호 변경(베통)'),
  (3743,'북악팔각정','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3746,'조계사','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3748,'윤동주문학관','UNOFFICIAL','여행 블로그'),
  (3749,'청와대 사랑채','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3751,'국립현대미술관 덕수궁','UNOFFICIAL','엘르 코리아 기사'),
  (3756,'인천배낚시 광복낚시','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3757,'향일암','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3758,'자산공원 일출정','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3768,'본태박물관','UNOFFICIAL','팬 계정 기록(2019-08 트윗)'),
  (3771,'생각하는정원','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3763,'전주드림랜드','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3670,'다람쥐마을 누룽지백숙','UNOFFICIAL','크리에이트립 사인 사진'),
  (3671,'효교','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3681,'지브로 하우스 & studio','REVOKED','사적 방문·업체 이전, 공개 성지 부적합'),
  (3682,'브라운 슈가','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3690,'곱창쌀롱연탄구이','REVOKED','폐업 보도, 영업 확인 안 됨'),
  (3694,'달맞이길','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3695,'해운대 부산횟집','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3701,'다독인더시티','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3706,'우가','REVOKED','근거 없음, 매장 이전'),
  (3707,'Scopa The Chef','UNOFFICIAL','해외 매체 언급'),
  (3709,'벨뷰','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3711,'카페 캠프통','UNOFFICIAL','강남구 관광 사이트 촬영지 소개'),
  (3712,'질할브로스 청담점','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3713,'우돈청','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3714,'더이삭플라워','UNOFFICIAL','달려라 방탄 EP.99 꽃집 정황'),
  (3715,'꽃새우 영번지 역삼점','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3717,'페인팅룸','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3718,'CHAI797 역삼GFC점','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3728,'스타스퀘어','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3730,'그 집','UNOFFICIAL','팬 글(5주년 회식)'),
  (3732,'동작대교 주차장','REVOKED','근거 없음, 좌표도 300m 이상 어긋남'),
  (3733,'본앤브레드','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3736,'오쓰세이로무시','REVOKED','폐점 표시, 영업 확인 안 됨'),
  (3737,'함경도찹쌀순대','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3738,'올림픽공원 나홀로나무','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3739,'삼보 청국장','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3740,'오브스토리지 앤게더','UNOFFICIAL','여행 매체·블로그가 EP.45 촬영지로 일관'),
  (3742,'인왕산','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3744,'학고재','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3747,'대선칼국수','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3752,'코끼리볼링장','UNOFFICIAL','팬 자료(EP.19)'),
  (3753,'피크닉','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3754,'정서진광장','REVOKED','촬영지 지명 근거 없음(추정)'),
  (3760,'대승 한지마을','REVOKED','근거 없음, 오성한옥마을과 혼동 추정'),
  (3764,'호남각','REVOKED','근거 없음(리뷰 2건만)'),
  (3765,'풍년제과 한옥마을3호점','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3766,'전주전통술박물관','UNOFFICIAL','박물관 홍보 현수막(블로그)'),
  (3767,'카멜리아힐','REVOKED','포스터 배경 설명과 불일치'),
  (3769,'유리네식당','REVOKED','원 게시물·기사·팬 자료 모두 못 찾음'),
  (3772,'다람쥐식탁','REVOKED','매장 2곳(한림·표선) 중 어느 곳인지 불명, 블로그 1건'),
  (3774,'아라리오갤러리','UNOFFICIAL','지역 언론 기사 한 줄(야외 조각광장)');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM tmp_b65 x
  JOIN artist_place_evidence e ON e.poi_sqno = x.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'bts';
  IF n <> 64 THEN RAISE EXCEPTION 'expected 64 PENDING bts rows, found %', n; END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-24 BTS 보류 판정: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_b65 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-24 BTS 보류 판정: 아님 (' || x.note || ')'
FROM tmp_b65 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

-- 확인: 비공식 16, 아님 48, 남은 BTS 보류 0 기대
SELECT x.new_status, e.status, count(*) FROM tmp_b65 x JOIN artist_place_evidence e USING (poi_sqno) JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'bts' GROUP BY 1,2 ORDER BY 1,2;
SELECT count(*) AS bts_pending_left FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'bts' AND e.status = 'PENDING';
