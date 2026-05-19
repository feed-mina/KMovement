-- V50: INTRO2 아티스트 목록 20명 + 썸네일 이미지 경로 연결
-- Apink 제거, GDragon 추가 (사용자 요청 2026-05-19)
-- 이미지 파일: public/artists/ 에 저장됨 → Next.js 정적 서빙 /artists/

UPDATE query_master
SET query_text = $Q$SELECT id, name, "imageUrl" FROM (VALUES
  (1,  'BTS',               '/artists/BTS.png'),
  (2,  'BLACKPINK',         '/artists/BLACKPINK.jpg'),
  (3,  'SEVENTEEN',         '/artists/SEVENTEEN.jpg'),
  (4,  'SUPER JUNIOR',      '/artists/SUPER JUNIOR.jpg'),
  (5,  'TWICE',             '/artists/TWICE.jpg'),
  (6,  'TVXQ',              '/artists/TVXQ.jpg'),
  (7,  'BTOB',              '/artists/BTOB.jpg'),
  (8,  'Girls'' Generation', '/artists/Girls'' Generation.jpg'),
  (9,  'EXO',               '/artists/EXO.jpg'),
  (10, 'Red Velvet',        '/artists/Red Velvet.jpg'),
  (11, 'NCT',               '/artists/NCT.jpg'),
  (12, 'GDragon',           '/artists/GDragon.jpg'),
  (13, 'OH MY GIRL',        '/artists/OH MY GIRL.jpg'),
  (14, 'SHINee',            '/artists/SHINee.jpg'),
  (15, 'MAMAMOO',           '/artists/MAMAMOO.jpg'),
  (16, 'IU',                '/artists/IU.jpg'),
  (17, 'TXT',               '/artists/TXT.png'),
  (18, 'Stray Kids',        '/artists/Stray Kids.jpg'),
  (19, 'ITZY',              '/artists/ITZY.jpg'),
  (20, 'IVE',               '/artists/IVE.jpg')
) AS t(id, name, "imageUrl")$Q$,
    description = 'KRIDE 아티스트 20명 + 썸네일 (V50 2026-05-19)'
WHERE sql_key = 'kride_artist_list';
