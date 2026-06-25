-- Rollback migration: remove name fields from user_addresses table
ALTER TABLE user_addresses DROP COLUMN IF EXISTS first_name;
ALTER TABLE user_addresses DROP COLUMN IF EXISTS middle_name;
ALTER TABLE user_addresses DROP COLUMN IF EXISTS last_name;
