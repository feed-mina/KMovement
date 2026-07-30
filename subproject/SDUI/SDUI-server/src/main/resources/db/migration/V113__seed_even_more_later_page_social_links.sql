-- Extend later-page social coverage for creators/performers where a public
-- channel handle can be identified with reasonable confidence.

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@ChimChakMan_Official',
    updated_at = NOW()
WHERE lower(slug) = '침착맨';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@JBKWAK',
    updated_at = NOW()
WHERE lower(slug) = '곽튜브';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@im1G',
    updated_at = NOW()
WHERE lower(slug) = '원지의하루';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@EatwithBoki',
    updated_at = NOW()
WHERE lower(slug) = '문복희';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@short_mouth_sun',
    updated_at = NOW()
WHERE lower(slug) = '입짧은햇님';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@LEEMUJINofficial',
    updated_at = NOW()
WHERE lower(slug) = '이무진';