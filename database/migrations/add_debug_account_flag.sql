-- Add is_debug_account flag to users table
-- Allows superadmin to enable debug logging for specific accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_debug_account BOOLEAN DEFAULT false;
