-- Rollback: add_psgc_address_fields.sql
-- Removes province, city, barangay, street columns from user_addresses table
ALTER TABLE user_addresses DROP COLUMN IF EXISTS province;
ALTER TABLE user_addresses DROP COLUMN IF EXISTS city;
ALTER TABLE user_addresses DROP COLUMN IF EXISTS barangay;
ALTER TABLE user_addresses DROP COLUMN IF EXISTS street;
