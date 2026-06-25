-- Add separate name fields to user_addresses table
-- This migration adds first_name, middle_name, and last_name columns
-- while keeping full_name for backward compatibility

ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS first_name VARCHAR(40);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS middle_name VARCHAR(40);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS last_name VARCHAR(40);

-- Update existing records: split full_name into separate fields if possible
-- This is a best-effort migration - if full_name has complex format, it may not split perfectly
-- We truncate to 40 chars to fit the column constraints
UPDATE user_addresses
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' THEN 
      TRIM(LEFT(SPLIT_PART(full_name, ' ', 1), 40))
    ELSE NULL 
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' THEN 
      CASE 
        WHEN array_length(regexp_split_to_array(full_name, '\s+'), 1) > 1 THEN
          TRIM(LEFT((regexp_split_to_array(full_name, '\s+'))[array_length(regexp_split_to_array(full_name, '\s+'), 1)], 40))
        ELSE NULL
      END
    ELSE NULL 
  END,
  middle_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' AND array_length(regexp_split_to_array(full_name, '\s+'), 1) > 2 THEN
      -- Extract middle parts (everything between first and last name), truncate to 40 chars
      TRIM(LEFT(SUBSTRING(
        full_name,
        LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2,
        LENGTH(full_name) - LENGTH(SPLIT_PART(full_name, ' ', 1)) - LENGTH(
          (regexp_split_to_array(full_name, '\s+'))[array_length(regexp_split_to_array(full_name, '\s+'), 1)]
        ) - 2
      ), 40))
    ELSE NULL 
  END
WHERE first_name IS NULL OR last_name IS NULL;
