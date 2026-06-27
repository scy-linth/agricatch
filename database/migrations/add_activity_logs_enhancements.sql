-- Add enhanced fields to activity_logs table for production-grade improvements
-- Migration: add_activity_logs_enhancements.sql

-- Add IP Address field
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Add User Agent field
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add Request ID field for future correlation support
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

-- Add index on request_id for correlation queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_request_id ON activity_logs(request_id);

-- Add index on ip_address for security analysis
CREATE INDEX IF NOT EXISTS idx_activity_logs_ip_address ON activity_logs(ip_address);

-- Add comment for new fields
COMMENT ON COLUMN activity_logs.ip_address IS 'Client IP address for security analysis (not exposed in UI)';
COMMENT ON COLUMN activity_logs.user_agent IS 'Client user agent string for analytics (not exposed in UI)';
COMMENT ON COLUMN activity_logs.request_id IS 'Request ID for correlation and tracing (future use)';
