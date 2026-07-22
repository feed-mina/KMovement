ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS image_source_url TEXT;
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS image_credit VARCHAR(255);

COMMENT ON COLUMN tour_poi.image_source_url IS '대표 이미지의 권리와 출처를 확인할 수 있는 페이지 URL';
COMMENT ON COLUMN tour_poi.image_credit IS '대표 이미지 저작자와 라이선스 표시';

UPDATE tour_poi
SET first_image = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bukchon_Hanok_Village_01.jpg?width=960',
    image_source_url = 'https://commons.wikimedia.org/wiki/File:Bukchon_Hanok_Village_01.jpg',
    image_credit = 'Bgag · CC0 1.0'
WHERE content_id = 'holy-bukchon' AND (first_image IS NULL OR BTRIM(first_image) = '');

UPDATE tour_poi
SET first_image = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/SeoulForest.jpg?width=800',
    image_source_url = 'https://commons.wikimedia.org/wiki/File:SeoulForest.jpg',
    image_credit = 'JeongAhn · Public Domain'
WHERE content_id = 'holy-seoulforest' AND (first_image IS NULL OR BTRIM(first_image) = '');

UPDATE tour_poi
SET first_image = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Dongdaemun_Design_Plaza_%26_Park.jpg?width=960',
    image_source_url = 'https://commons.wikimedia.org/wiki/File:Dongdaemun_Design_Plaza_%26_Park.jpg',
    image_credit = 'Nestor Lacle · CC BY 2.0'
WHERE content_id = 'holy-ddp' AND (first_image IS NULL OR BTRIM(first_image) = '');

UPDATE tour_poi
SET first_image = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Lotte_World_Tower_and_Namsan_Tower_in_Seoul.jpg?width=960',
    image_source_url = 'https://commons.wikimedia.org/wiki/File:Lotte_World_Tower_and_Namsan_Tower_in_Seoul.jpg',
    image_credit = 'Arturbraun · CC BY-SA 4.0'
WHERE content_id = 'holy-lotte' AND (first_image IS NULL OR BTRIM(first_image) = '');
