-- V117__mypage_preferred_artists_empty_cta.sql
-- MY_PAGE 'Preferred artists' 카드의 빈 상태를 행동 유도로 바꾼다.
--
-- 배경: 추천 요청 이력이 없으면 이 카드는 "데이터가 쌓이면 …"만 보여준다.
-- 첫 사용자에게는 카드가 죽어 보이고, 데이터를 만들 방법도 알려주지 않는다.
-- 같은 화면의 HISTORY_LIST(mypage_route_timeline)는 이미
-- emptyText/actionText/actionUrl 로 빈 상태에 진입 버튼을 둔다. 같은 계약을 쓴다.
--
-- component_props 를 통째로 다시 쓰므로, 기존 차트 설정(type/dataPath/labelKey/
-- valueKey/caption/limit)을 빠짐없이 유지한 채 빈 상태 키만 더한다.

BEGIN;

UPDATE ui_metadata
SET component_props = jsonb_build_object(
        'type', 'donut',
        'dataPath', 'preferred_artists',
        'labelKey', 'label',
        'valueKey', 'value',
        'caption', 'Artists in recommendation requests',
        'limit', 6,
        'emptyText', '아직 추천 이력이 없어요. 코스를 한 번 만들면 좋아하는 아티스트가 여기에 쌓입니다.',
        'actionText', 'K-POP 코스 만들기',
        'actionUrl', '/view/INTRO1'
    )
WHERE screen_id = 'MY_PAGE'
  AND component_id = 'mypage_route_artists_chart';

-- 같은 이유로 비어 있는 지역 차트도 같은 입구를 준다.
UPDATE ui_metadata
SET component_props = jsonb_build_object(
        'type', 'bar',
        'dataPath', 'visited_regions',
        'labelKey', 'label',
        'valueKey', 'value',
        'caption', 'Your most used regions',
        'limit', 6,
        'emptyText', '아직 다녀온 지역 기록이 없어요. 코스를 만들면 지역별로 정리해 드릴게요.',
        'actionText', 'K-POP 코스 만들기',
        'actionUrl', '/view/INTRO1'
    )
WHERE screen_id = 'MY_PAGE'
  AND component_id = 'mypage_route_regions_chart';

COMMIT;
