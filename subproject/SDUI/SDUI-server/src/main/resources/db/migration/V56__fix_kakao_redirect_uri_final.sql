-- V56: 진짜 카카오 로그인 버튼 action_url의 redirect_uri를 yerin.duckdns.org 로 변경 및 KRIDE 아티스트 이미지 추가

-- 1. 카카오 로그인 redirect_uri 변경
UPDATE ui_metadata
SET action_url = REGEXP_REPLACE(
    action_url,
    'redirect_uri=[^&]+',
    'redirect_uri=https://yerin.duckdns.org/api/kakao/callback'
)
WHERE action_url LIKE '%kauth.kakao.com%'
  AND action_url LIKE '%redirect_uri=%';

DO $$ BEGIN RAISE NOTICE 'V56: 카카오 redirect_uri -> https://yerin.duckdns.org/api/kakao/callback 로 변경 완료'; END $$;

-- 2. KRIDE INTRO2 아티스트 목록에 이미지 URL 매핑 추가
UPDATE query_master
SET query_text = 'SELECT id, name, 
  CASE
    WHEN name = ''BTS'' THEN ''/artists/BTS.png''
    WHEN name = ''BLACKPINK'' THEN ''/artists/BLACKPINK.jpg''
    WHEN name = ''EXO'' THEN ''/artists/EXO.jpg''
    WHEN name = ''TWICE'' THEN ''/artists/TWICE.jpg''
    WHEN name = ''SEVENTEEN'' THEN ''/artists/SEVENTEEN.jpg''
    WHEN name = ''Stray Kids'' THEN ''/artists/Stray Kids.jpg''
    WHEN name = ''IVE'' THEN ''/artists/IVE.jpg''
    WHEN name = ''Red Velvet'' THEN ''/artists/Red Velvet.jpg''
    WHEN name = ''MAMAMOO'' THEN ''/artists/MAMAMOO.jpg''
    WHEN name = ''TXT'' THEN ''/artists/TXT.png''
    WHEN name = ''ITZY'' THEN ''/artists/ITZY.jpg''
    WHEN name = ''SHINee'' THEN ''/artists/SHINee.jpg''
    WHEN name = ''BTOB'' THEN ''/artists/BTOB.jpg''
    ELSE '''' 
  END AS "imageUrl"
FROM (VALUES 
  (1,''BTS''),(2,''BLACKPINK''),(3,''EXO''),(4,''TWICE''),(5,''SEVENTEEN''),
  (6,''aespa''),(7,''Stray Kids''),(8,''IVE''),(9,''NewJeans''),(10,''LE SSERAFIM''),
  (11,''NCT 127''),(12,''Red Velvet''),(13,''GOT7''),(14,''MAMAMOO''),(15,''ATEEZ''),
  (16,''TXT''),(17,''ENHYPEN''),(18,''ITZY''),(19,''(G)I-DLE''),(20,''MONSTA X''),
  (21,''SHINee''),(22,''WINNER''),(23,''iKON''),(24,''DAY6''),(25,''BTOB''),
  (26,''ASTRO''),(27,''THE BOYZ''),(28,''Kep1er''),(29,''NMIXX''),(30,''TREASURE'')
) AS t(id, name)'
WHERE sql_key = 'kride_artist_list';

DO $$ BEGIN RAISE NOTICE 'V56: kride_artist_list query updated with imageUrls'; END $$;
