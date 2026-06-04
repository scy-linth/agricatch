ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

UPDATE users
SET
  first_name = COALESCE(first_name, NULLIF(split_part(trim(full_name), ' ', 1), '')),
  middle_name = COALESCE(
    middle_name,
    NULLIF(
      trim(regexp_replace(trim(full_name), '^\S+\s*|\s+\S+$', '', 'g')),
      ''
    )
  ),
  last_name = COALESCE(
    last_name,
    NULLIF(
      CASE
        WHEN position(' ' IN trim(full_name)) > 0 THEN regexp_replace(trim(full_name), '^.*\s+', '')
        ELSE ''
      END,
      ''
    )
  )
WHERE COALESCE(trim(full_name), '') <> '';