-- V50: INTRO2 아티스트 20명 업데이트 + INTRO3 경기 추가
-- 2026-05-19
-- pgAdmin에서 실행

-- ═══════════════════════════════════════════════
-- 1. INTRO2 아티스트 목록 (10명 → 20명, imageUrl 추가)
-- ═══════════════════════════════════════════════
UPDATE query_master
SET query_text = $Q$SELECT id, name, "imageUrl", name_ko FROM (VALUES
  (1,  'BTS',               '/artists/BTS.png',              '방탄소년단'),
  (2,  'BLACKPINK',         '/artists/BLACKPINK.jpg',        '블랙핑크'),
  (3,  'SUPER JUNIOR',      '/artists/SUPER JUNIOR.jpg',     '슈퍼주니어'),
  (4,  'SEVENTEEN',         '/artists/SEVENTEEN.jpg',        '세븐틴'),
  (5,  'TWICE',             '/artists/TWICE.jpg',            '트와이스'),
  (6,  'TVXQ',              '/artists/TVXQ.jpg',             '동방신기'),
  (7,  'BTOB',              '/artists/BTOB.jpg',             'BTOB'),
  (8,  'Girls'' Generation', '/artists/Girls'' Generation.jpg', '소녀시대'),
  (9,  'EXO',               '/artists/EXO.jpg',              '엑소'),
  (10, 'Red Velvet',        '/artists/Red Velvet.jpg',       '레드벨벳'),
  (11, 'NCT',               '/artists/NCT.jpg',              'NCT'),
  (12, 'INFINITE',          '/artists/INFINITE.jpg',         '인피니트'),
  (13, 'OH MY GIRL',        '/artists/OH MY GIRL.jpg',       '오마이걸'),
  (14, 'Apink',             '/artists/Apink.jpg',            '에이핑크'),
  (15, 'SHINee',            '/artists/SHINee.jpg',           '샤이니'),
  (16, 'MAMAMOO',           '/artists/MAMAMOO.jpg',          '마마무'),
  (17, 'IU',                '/artists/IU.jpg',               '아이유'),
  (18, 'TXT',               '/artists/TXT.png',              'TXT'),
  (19, 'VICTON',            '/artists/VICTON.jpg',           '빅톤'),
  (20, 'G-Dragon',          '/artists/GDragon.jpg',          '지드래곤'),
  (21, 'fromis_9',          '/artists/fromis_9.jpg',         '프로미스나인'),
  (22, 'CHUNGHA',           '/artists/CHUNGHA.jpg',          '청하'),
  (23, 'Block B',           '/artists/Block B.jpg',          '블락비'),
  (24, 'Girl''s Day',       '/artists/Girl''s Day.jpg',      '걸스데이'),
  (25, 'GOT7',              '/artists/GOT7.jpg',             'GOT7'),
  (26, 'Highlight',         '/artists/Highlight.jpg',        '하이라이트'),
  (27, 'Rain',              '/artists/Rain.jpg',             '비'),
  (28, 'NU''EST',           '/artists/NU''EST.jpg',          '뉴이스트'),
  (29, 'Kang Daniel',       '/artists/Kang Daniel.jpg',      '강다니엘'),
  (30, 'Stray Kids',        '/artists/Stray Kids.jpg',       '스트레이키즈')
) AS t(id, name, "imageUrl", name_ko)$Q$,
    description = 'KRIDE 아티스트 30명 + 썸네일 + 한국어명 (V50 2026-05-19, CSV 상위 30 기준)'
WHERE sql_key = 'kride_artist_list';

-- ═══════════════════════════════════════════════
-- 2. INTRO3 지역 목록 (12 → 13, 경기 추가)
-- ═══════════════════════════════════════════════
UPDATE query_master
SET query_text = $Q$SELECT id, name, ''::text AS "imageUrl" FROM (VALUES
  (1,'서울'),
  (2,'경기'),
  (3,'부산'),
  (4,'제주'),
  (5,'경주'),
  (6,'인천'),
  (7,'강원'),
  (8,'여수'),
  (9,'전주'),
  (10,'춘천'),
  (11,'속초'),
  (12,'대구'),
  (13,'광주')
) AS t(id, name, "imageUrl")$Q$,
    description = 'KRIDE 지역 13곳 (경기 추가, V50 2026-05-19)'
WHERE sql_key = 'kride_region_list';
