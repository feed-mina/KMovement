-- Backfill TourAPI area/sigungu codes for the original approved holy-site seeds.
UPDATE tour_poi
SET area_code = '1',
    sigungu_code = CASE content_id
        WHEN 'holy-ttukseom' THEN '6'
        WHEN 'holy-bukchon' THEN '23'
        WHEN 'holy-seoulforest' THEN '16'
        WHEN 'holy-namsan' THEN '21'
        WHEN 'holy-banpo' THEN '15'
        WHEN 'holy-seongsu' THEN '16'
        WHEN 'holy-ddp' THEN '24'
        WHEN 'holy-lotte' THEN '18'
        ELSE sigungu_code
    END
WHERE content_id IN (
    'holy-ttukseom', 'holy-bukchon', 'holy-seoulforest', 'holy-namsan',
    'holy-banpo', 'holy-seongsu', 'holy-ddp', 'holy-lotte'
);

CREATE INDEX IF NOT EXISTS idx_tour_poi_holy_region
    ON tour_poi(area_code, sigungu_code, poi_sqno)
    WHERE source <> 'TOURAPI' AND review_status = 'APPROVED';
