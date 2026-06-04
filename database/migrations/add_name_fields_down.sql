-- Rollback: add_name_fields.sql
-- Removes first_name, middle_name, last_name columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS middle_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
