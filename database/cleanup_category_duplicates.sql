-- Cleanup duplicate categories by case-insensitive name
-- Review the preview query before running the delete/update steps.

BEGIN;

-- Preview duplicates
WITH dupes AS (
  SELECT LOWER(name) AS name_key,
         MIN(id) AS keep_id,
         ARRAY_AGG(id ORDER BY id) AS all_ids,
         COUNT(*) AS count
  FROM categories
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
)
SELECT * FROM dupes ORDER BY name_key;

-- Re-map products to the kept category id
WITH dupes AS (
  SELECT LOWER(name) AS name_key,
         MIN(id) AS keep_id,
         ARRAY_AGG(id ORDER BY id) AS all_ids
  FROM categories
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
),
flat AS (
  SELECT keep_id, UNNEST(all_ids) AS id
  FROM dupes
)
UPDATE products p
SET category_id = f.keep_id
FROM flat f
WHERE p.category_id = f.id
  AND f.id <> f.keep_id;

-- Delete duplicate category rows (keep the lowest id)
WITH dupes AS (
  SELECT LOWER(name) AS name_key,
         MIN(id) AS keep_id,
         ARRAY_AGG(id ORDER BY id) AS all_ids
  FROM categories
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
),
flat AS (
  SELECT keep_id, UNNEST(all_ids) AS id
  FROM dupes
)
DELETE FROM categories c
USING flat f
WHERE c.id = f.id
  AND f.id <> f.keep_id;

COMMIT;
