-- KPOP_EVENTS 화면에 보여줄 이벤트 데이터를 시딩한다.
--
-- 주의: 아래 일정은 화면/동선 확인을 위한 **샘플 데이터**이며 실제 공연 일정이 아니다.
-- 실제 일정은 #172 검수 흐름에 따라 운영에서 등록·승인해야 한다. 샘플 행은 description이
-- '[샘플 데이터]' 로 시작하므로 아래 한 문장으로 일괄 제거할 수 있다.
--
--   DELETE FROM event WHERE description LIKE '[샘플 데이터]%';
--
-- 날짜는 마이그레이션 적용 시점 기준 상대 날짜로 넣어, 배포 시점과 무관하게
-- 다가오는 일정이 보이도록 한다.

-- V82의 영문 스모크 테스트 행을 한국어/한국 지역명으로 정리한다.
-- 지역 필터가 'Seoul'과 '서울'로 갈리지 않도록 지역명 표기를 통일한다.
UPDATE event
SET title_ko = '서울 팬 여행 코스 안내',
    title_en = 'Seoul fan route guide',
    region = '서울',
    venue = '홍대 · 성수 일대',
    description = '[샘플 데이터] 화면 확인용 시드 일정입니다. 실제 일정은 공식 채널에서 확인해 주세요.',
    updated_at = NOW()
WHERE title_ko = 'Seoul fan route sample';

WITH seed(slug_key, title_ko, title_en, region, venue, day_offset) AS (
    VALUES
        ('bts',                 'BTS 팬미팅 데이 서울',        'BTS fan meeting day Seoul',      '서울', 'KSPO DOME',            12),
        ('bts',                 'BTS 굿즈 팝업 성수',          'BTS goods pop-up Seongsu',       '서울', '성수 팝업 스페이스',    26),
        ('blackpink',           'BLACKPINK 콘서트 고척',       'BLACKPINK concert Gocheok',      '서울', '고척스카이돔',          19),
        ('blackpink',           'BLACKPINK 브랜드 팝업 한남',  'BLACKPINK brand pop-up Hannam',  '서울', '한남 플래그십',         41),
        ('seventeen',           'SEVENTEEN 월드투어 서울',     'SEVENTEEN world tour Seoul',     '서울', '잠실실내체육관',        33),
        ('ive',                 'IVE 팬사인회 인천',           'IVE fan signing Incheon',        '인천', '인스파이어 아레나',      16),
        ('aespa',               'aespa 콘셉트 전시 서울',      'aespa concept exhibition Seoul', '서울', '동대문디자인플라자',    22),
        ('aespa',               'aespa 단독 콘서트 고양',      'aespa solo concert Goyang',      '고양', '고양종합운동장',        58),
        ('newjeans',            'NewJeans 팝업 카페 성수',     'NewJeans pop-up cafe Seongsu',   '서울', '성수 카페거리',          9),
        ('twice',               'TWICE 돔 투어 서울',          'TWICE dome tour Seoul',          '서울', '고척스카이돔',          47),
        ('twice',               'TWICE 팬미팅 부산',           'TWICE fan meeting Busan',        '부산', '벡스코 오디토리움',      72),
        ('stray kids',          'Stray Kids 콘서트 서울',      'Stray Kids concert Seoul',       '서울', 'KSPO DOME',            38),
        ('exo',                 'EXO 데뷔 기념 전시 서울',     'EXO anniversary exhibition',     '서울', '블루스퀘어',            29),
        ('nct',                 'NCT 유닛 쇼케이스 인천',      'NCT unit showcase Incheon',      '인천', '인스파이어 아레나',      52),
        ('ateez',              'ATEEZ 팬 콘서트 고양',         'ATEEZ fan concert Goyang',       '고양', '킨텍스 제1전시장',       64),
        ('le sserafim',         'LE SSERAFIM 뷰티 팝업 서울',  'LE SSERAFIM beauty pop-up',      '서울', '더현대 서울',           14),
        ('tomorrow x together', 'TOMORROW X TOGETHER 쇼케이스', 'TXT showcase Seoul',            '서울', '예스24 라이브홀',        24),
        ('enhypen',             'ENHYPEN 팬미팅 대구',         'ENHYPEN fan meeting Daegu',      '대구', '엑스코 오디토리움',      44),
        ('red velvet',          'Red Velvet 단독 콘서트 서울', 'Red Velvet solo concert Seoul',  '서울', '올림픽홀',              35),
        ('itzy',                'ITZY 여름 페스티벌 부산',     'ITZY summer festival Busan',     '부산', '아시아드주경기장',       55),
        ('riize',               'RIIZE 쇼케이스 서울',         'RIIZE showcase Seoul',           '서울', '예스24 라이브홀',        11),
        ('boynextdoor',         'BOYNEXTDOOR 팬사인회 서울',   'BOYNEXTDOOR fan signing Seoul',  '서울', '블루스퀘어',            18),
        ('day6',                'DAY6 밴드 라이브 서울',       'DAY6 band live Seoul',           '서울', '올림픽홀',              31),
        ('(여자)아이들',         '(여자)아이들 콘서트 서울',    'G-IDLE concert Seoul',           '서울', '잠실실내체육관',        49),
        ('g-dragon',            'G-DRAGON 단독 무대 고양',     'G-DRAGON solo stage Goyang',     '고양', '고양종합운동장',        67),
        ('아이유(iu)',           '아이유 콘서트 서울',          'IU concert Seoul',               '서울', 'KSPO DOME',            60),
        ('임영웅',              '임영웅 전국투어 대전',         'Lim Young-woong tour Daejeon',   '대전', '대전컨벤션센터',        76),
        ('악뮤(akmu)',          '악뮤 어쿠스틱 라이브 광주',    'AKMU acoustic live Gwangju',     '광주', '김대중컨벤션센터',       83)
)
INSERT INTO event (
    artist_id, title_ko, title_en, region, venue, event_date, description, official_url, approved_yn
)
SELECT
    a.artist_id,
    seed.title_ko,
    seed.title_en,
    seed.region,
    seed.venue,
    CURRENT_DATE + seed.day_offset,
    '[샘플 데이터] 화면 확인용 시드 일정입니다. 실제 일정은 공식 채널에서 확인해 주세요.',
    a.official_url,
    'Y'
FROM seed
JOIN artist a ON LOWER(a.slug) = seed.slug_key
WHERE a.approved_yn = 'Y'
  AND NOT EXISTS (
      SELECT 1
      FROM event existing
      WHERE existing.artist_id = a.artist_id
        AND existing.title_ko = seed.title_ko
  );
