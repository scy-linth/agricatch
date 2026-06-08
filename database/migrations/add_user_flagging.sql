-- Add user flagging system for fraud detection
-- This allows admin to flag suspicious accounts for review

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS flagged_by INTEGER REFERENCES users(id);

-- Add index for faster queries on flagged users
CREATE INDEX IF NOT EXISTS idx_users_is_flagged ON users(is_flagged) WHERE is_flagged = true;
