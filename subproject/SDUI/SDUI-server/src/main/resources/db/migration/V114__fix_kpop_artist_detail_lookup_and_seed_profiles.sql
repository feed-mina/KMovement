-- KPOP_ARTIST_DETAIL이 slug 라우트(/view/KPOP_ARTIST_DETAIL/aespa)에서 비어 있던 문제를 고치고,
-- 상세 화면에 보여줄 아티스트 간략 정보를 채운다.
--
-- 기존 쿼리는 `CAST(:contentId AS BIGINT)`로 파라미터 자체를 캐스팅했다. PostgreSQL은 Parse 단계에서
-- 해당 placeholder의 타입을 bigint로 확정하므로, CASE 분기를 타지 않더라도 slug 값('aespa')은 Bind
-- 단계에서 `invalid input syntax for type bigint`로 실패했다. 파라미터가 아니라 컬럼을 text로 캐스팅한다.

UPDATE query_master
SET query_text = 'SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn", profile, image_url AS "imageUrl", official_url AS "officialUrl", instagram_url AS "instagramUrl", youtube_url AS "youtubeUrl", x_url AS "xUrl" FROM artist WHERE approved_yn = ''Y'' AND (LOWER(slug) = LOWER(:contentId) OR CAST(artist_id AS text) = :contentId)',
    return_type = 'MULTI',
    required_params = '["contentId"]',
    param_mapping = '{"contentId":"string"}',
    updated_at = NOW()
WHERE sql_key = 'kpop_artist_detail';

-- 상세 화면은 이름/링크만으로는 정보가 비어 보이므로 대표 아티스트에 한국어 간략 정보를 채운다.
-- 나머지 아티스트는 프런트엔드 기본 문구를 그대로 사용한다.
WITH seeded(slug_key, profile_text) AS (
    VALUES
        ('bts', '월드투어와 팝업이 자주 열려 서울 도심 동선과 함께 계획하기 좋은 그룹입니다.'),
        ('blackpink', '콘서트와 패션 브랜드 팝업이 이어져 성수·한남 동선과 묶기 좋은 그룹입니다.'),
        ('seventeen', '대형 공연장 무대가 많아 공연 전후 이동 시간을 넉넉히 잡는 편이 좋습니다.'),
        ('ive', '음악방송과 팬사인회 일정이 잦아 방송국 주변 동선을 함께 확인해 보세요.'),
        ('aespa', '가상 세계관 콘셉트로 전시·팝업 연계 일정이 많은 그룹입니다.'),
        ('newjeans', '레트로 감성 콘셉트로 카페·편집숍 협업 팝업이 자주 열립니다.'),
        ('twice', '돔·스타디움 공연 비중이 높아 지방 원정 동선을 미리 확인하는 편이 좋습니다.'),
        ('stray kids', '퍼포먼스 중심 공연이 많아 스탠딩 구역 대기 시간을 감안해 주세요.'),
        ('exo', '유닛·솔로 활동이 함께 진행되어 일정이 나뉘는 경우가 많습니다.'),
        ('nct', '유닛별로 활동 지역이 달라 팔로우 후 일정 알림을 확인하는 편이 좋습니다.'),
        ('ateez', '해외 투어 비중이 높아 국내 일정은 회차가 적은 편입니다.'),
        ('le sserafim', '패션·뷰티 브랜드 협업 행사가 많아 팝업 정보를 함께 확인해 보세요.'),
        ('tomorrow x together', '팬미팅과 쇼케이스가 자주 열려 소규모 공연장 일정이 많습니다.'),
        ('enhypen', '콘셉트 전시와 연계된 팬 이벤트가 함께 열리는 경우가 많습니다.'),
        ('red velvet', '단독 콘서트와 페스티벌 무대를 오가는 일정이 이어집니다.'),
        ('itzy', '페스티벌 헤드라이너 무대가 많아 여름 일정이 집중되는 편입니다.'),
        ('riize', '데뷔 초 신인 일정으로 쇼케이스·음악방송 중심 동선이 많습니다.'),
        ('boynextdoor', '팬사인회와 쇼케이스 위주라 수도권 일정 비중이 높습니다.'),
        ('day6', '밴드 공연 특성상 라이브홀·페스티벌 무대가 많습니다.'),
        ('(여자)아이들', '자체 프로듀싱 무대가 많아 단독 공연 회차를 확인해 보세요.'),
        ('g-dragon', '단독 무대와 브랜드 행사가 함께 열려 일정 변동이 잦은 편입니다.'),
        ('아이유(iu)', '콘서트 예매 경쟁이 치열해 일정 공개 시점을 미리 확인해 두세요.'),
        ('태연(taeyeon)', '단독 콘서트와 OST 무대가 이어지는 솔로 아티스트입니다.'),
        ('임영웅', '전국 투어 규모가 커서 지역별 공연장 접근 정보를 함께 확인해 보세요.'),
        ('지코(zico)', '페스티벌과 클럽 무대를 함께 소화하는 아티스트입니다.'),
        ('악뮤(akmu)', '어쿠스틱 중심 공연이 많아 중소형 공연장 일정이 많습니다.'),
        ('박효신', '연말 단독 콘서트 중심으로 일정이 집중되는 아티스트입니다.'),
        ('이무진', '페스티벌과 소극장 공연을 오가는 싱어송라이터입니다.'),
        ('볼빨간사춘기', '계절별 소규모 단독 공연이 이어지는 아티스트입니다.'),
        ('백예린', '단독 공연 회차가 적어 일정 공개 직후 확인이 필요합니다.'),
        ('성시경', '연말 콘서트와 토크 중심 공연이 함께 열립니다.'),
        ('장원영', '브랜드 행사와 공항 일정이 많아 공개 동선 확인이 유용합니다.'),
        ('차은우', '팬미팅 투어와 브랜드 행사를 함께 진행하는 경우가 많습니다.')
)
UPDATE artist a
SET profile = seeded.profile_text,
    updated_at = NOW()
FROM seeded
WHERE LOWER(a.slug) = seeded.slug_key
  AND (a.profile IS NULL OR a.profile = '' OR a.profile !~ '[가-힣]');
