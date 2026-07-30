-- Merge duplicate/variant artist rows that were introduced by later catalog
-- seeds using case-different or alias slugs (e.g. bts vs BTS).

WITH mapping(canonical_slug, duplicate_slug) AS (
    VALUES
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('seventeen', 'SEVENTEEN'),
        ('ive', 'IVE'),
        ('aespa', '에스파(aespa)')
),
ids AS (
    SELECT
        canonical.artist_id AS canonical_id,
        duplicate.artist_id AS duplicate_id
    FROM mapping
    JOIN artist canonical ON canonical.slug = mapping.canonical_slug
    JOIN artist duplicate ON duplicate.slug = mapping.duplicate_slug
)
UPDATE artist canonical
SET name_ko = COALESCE(NULLIF(canonical.name_ko, ''), duplicate.name_ko),
    name_en = COALESCE(NULLIF(canonical.name_en, ''), duplicate.name_en),
    profile = COALESCE(NULLIF(canonical.profile, ''), duplicate.profile),
    image_url = COALESCE(NULLIF(canonical.image_url, ''), duplicate.image_url),
    official_url = COALESCE(NULLIF(canonical.official_url, ''), duplicate.official_url),
    instagram_url = COALESCE(NULLIF(canonical.instagram_url, ''), duplicate.instagram_url),
    youtube_url = COALESCE(NULLIF(canonical.youtube_url, ''), duplicate.youtube_url),
    x_url = COALESCE(NULLIF(canonical.x_url, ''), duplicate.x_url),
    sort_order = LEAST(canonical.sort_order, duplicate.sort_order),
    updated_at = NOW()
FROM ids
JOIN artist duplicate ON duplicate.artist_id = ids.duplicate_id
WHERE canonical.artist_id = ids.canonical_id;

WITH mapping(canonical_slug, duplicate_slug) AS (
    VALUES
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('seventeen', 'SEVENTEEN'),
        ('ive', 'IVE'),
        ('aespa', '에스파(aespa)')
),
ids AS (
    SELECT
        canonical.artist_id AS canonical_id,
        duplicate.artist_id AS duplicate_id
    FROM mapping
    JOIN artist canonical ON canonical.slug = mapping.canonical_slug
    JOIN artist duplicate ON duplicate.slug = mapping.duplicate_slug
)
UPDATE event e
SET artist_id = ids.canonical_id,
    updated_at = NOW()
FROM ids
WHERE e.artist_id = ids.duplicate_id;

WITH mapping(canonical_slug, duplicate_slug) AS (
    VALUES
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('seventeen', 'SEVENTEEN'),
        ('ive', 'IVE'),
        ('aespa', '에스파(aespa)')
),
ids AS (
    SELECT
        canonical.artist_id AS canonical_id,
        duplicate.artist_id AS duplicate_id
    FROM mapping
    JOIN artist canonical ON canonical.slug = mapping.canonical_slug
    JOIN artist duplicate ON duplicate.slug = mapping.duplicate_slug
)
UPDATE product_candidate pc
SET artist_id = ids.canonical_id,
    updated_at = NOW()
FROM ids
WHERE pc.artist_id = ids.duplicate_id;

WITH mapping(canonical_slug, duplicate_slug) AS (
    VALUES
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('seventeen', 'SEVENTEEN'),
        ('ive', 'IVE'),
        ('aespa', '에스파(aespa)')
),
ids AS (
    SELECT
        canonical.artist_id AS canonical_id,
        duplicate.artist_id AS duplicate_id
    FROM mapping
    JOIN artist canonical ON canonical.slug = mapping.canonical_slug
    JOIN artist duplicate ON duplicate.slug = mapping.duplicate_slug
)
UPDATE saved_item si
SET item_ref = ids.canonical_id,
    updated_at = NOW()
FROM ids
WHERE si.item_type = 'ARTIST'
  AND si.item_ref = ids.duplicate_id
  AND NOT EXISTS (
      SELECT 1
      FROM saved_item existing
      WHERE existing.user_sqno = si.user_sqno
        AND existing.item_type = 'ARTIST'
        AND existing.item_ref = ids.canonical_id
  );

WITH mapping(canonical_slug, duplicate_slug) AS (
    VALUES
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('seventeen', 'SEVENTEEN'),
        ('ive', 'IVE'),
        ('aespa', '에스파(aespa)')
),
ids AS (
    SELECT
        canonical.artist_id AS canonical_id,
        duplicate.artist_id AS duplicate_id
    FROM mapping
    JOIN artist canonical ON canonical.slug = mapping.canonical_slug
    JOIN artist duplicate ON duplicate.slug = mapping.duplicate_slug
)
DELETE FROM saved_item si
USING ids
WHERE si.item_type = 'ARTIST'
  AND si.item_ref = ids.duplicate_id;

WITH mapping(canonical_slug, duplicate_slug) AS (
    VALUES
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('seventeen', 'SEVENTEEN'),
        ('ive', 'IVE'),
        ('aespa', '에스파(aespa)')
),
ids AS (
    SELECT
        canonical.artist_id AS canonical_id,
        duplicate.artist_id AS duplicate_id
    FROM mapping
    JOIN artist canonical ON canonical.slug = mapping.canonical_slug
    JOIN artist duplicate ON duplicate.slug = mapping.duplicate_slug
)
UPDATE artist_follow af
SET artist_id = ids.canonical_id
FROM ids
WHERE af.artist_id = ids.duplicate_id
  AND NOT EXISTS (
      SELECT 1
      FROM artist_follow existing
      WHERE existing.user_sqno = af.user_sqno
        AND existing.artist_id = ids.canonical_id
  );

WITH mapping(canonical_slug, duplicate_slug) AS (
    VALUES
        ('bts', 'BTS'),
        ('blackpink', 'BLACKPINK'),
        ('seventeen', 'SEVENTEEN'),
        ('ive', 'IVE'),
        ('aespa', '에스파(aespa)')
),
ids AS (
    SELECT
        canonical.artist_id AS canonical_id,
        duplicate.artist_id AS duplicate_id
    FROM mapping
    JOIN artist canonical ON canonical.slug = mapping.canonical_slug
    JOIN artist duplicate ON duplicate.slug = mapping.duplicate_slug
)
DELETE FROM artist_follow af
USING ids
WHERE af.artist_id = ids.duplicate_id;

DELETE FROM artist
WHERE slug IN ('BTS', 'BLACKPINK', 'SEVENTEEN', 'IVE', '에스파(aespa)');