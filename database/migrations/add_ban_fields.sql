-- Migration: add disable_type column to users table
-- disable_type values: NULL (not disabled), 'suspended' (temporary), 'banned' (permanent)

ALTER TABLE users ADD COLUMN IF NOT EXISTS disable_type VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- Backfill: existing disabled users get 'suspended' as default
UPDATE users SET disable_type = 'suspended' WHERE is_disabled = true AND disable_type IS NULL;

-- Comment
COMMENT ON COLUMN users.disable_type IS 'suspended = temporary (can re-enable), banned = permanent block';
COMMENT ON COLUMN users.is_banned IS 'Legacy/alias field. Use disable_type=banned for permanent bans.';
