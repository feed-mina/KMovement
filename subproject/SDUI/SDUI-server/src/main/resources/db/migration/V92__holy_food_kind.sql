-- V92: '성지 맛집' 구분 태깅.
--
-- 데이터 사실: CSV의 category=food 1만여 행은 전부 source=tourapi_food(공공 음식점
-- 덤프, 방영 이력·작품 링크 없음)라 성지가 아니다 — 기존 '맛집' 칩(TourAPI 실시간)과
-- 중복이므로 임포트하지 않는다. 반면 V90으로 들어온 촬영지 중 식당·카페
-- (raw_json sub_category restaurant/cafe, 방영 씬 설명 보유) 약 6천 행이 진짜
-- '성지 맛집'이다. 이들을 content_type_id='HOLY_FOOD'로 태깅해 탐색 화면의
-- 새 칩이 kind=FOOD 필터로 조회한다. (성지 칩은 전체를 계속 보여준다 — 부분집합 뷰)
--
-- 멱등: 이미 태깅된 행은 WHERE 조건에서 변화가 없다.

UPDATE tour_poi
SET content_type_id = 'HOLY_FOOD'
WHERE content_id LIKE 'kride-media-%'
  AND COALESCE(raw_json->>'sub_category', '') IN ('restaurant', 'cafe');
