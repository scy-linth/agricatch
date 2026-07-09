-- Add UNIQUE constraint on phone column in users table
-- This migration ensures phone numbers are unique across all user accounts
-- Migration: add_phone_unique_constraint
-- Date: 2026-07-09

-- First, check for existing duplicate phone numbers
-- This will help identify any data that needs to be cleaned up before adding the constraint

-- Create a report of duplicate phone numbers
SELECT 
  phone, 
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at) as user_ids,
  array_agg(username ORDER BY created_at) as usernames,
  array_agg(email ORDER BY created_at) as emails,
  array_agg(role ORDER BY created_at) as roles
FROM users
WHERE phone IS NOT NULL 
  AND phone != ''
  AND phone != '—'
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Add UNIQUE constraint on phone column
-- Note: This will fail if there are existing duplicate phone numbers
-- The query above should be run first to identify and resolve duplicates

-- Partial unique index that allows NULL values (PostgreSQL best practice)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique 
ON users(phone) 
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone != '—';

-- Alternative: Full UNIQUE constraint (less flexible with NULLs)
-- ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
