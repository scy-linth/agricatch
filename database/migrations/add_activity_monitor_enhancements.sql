-- Add Activity Monitor enhancements for risk detection, IP geolocation, and browser info
-- Migration: add_activity_monitor_enhancements.sql

-- Add risk detection fields
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'low';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

-- Add IP geolocation fields (backend-only, not exposed in UI)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add browser information fields (backend-only, not exposed in UI)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS browser_name VARCHAR(50);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS browser_version VARCHAR(50);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS os_name VARCHAR(50);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS os_version VARCHAR(50);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_activity_logs_risk_level ON activity_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_activity_logs_risk_score ON activity_logs(risk_score);
CREATE INDEX IF NOT EXISTS idx_activity_logs_country ON activity_logs(country);
CREATE INDEX IF NOT EXISTS idx_activity_logs_device_type ON activity_logs(device_type);

-- Add comments for new fields
COMMENT ON COLUMN activity_logs.risk_level IS 'Risk level: low, medium, high, critical (for Activity Monitor)';
COMMENT ON COLUMN activity_logs.risk_score IS 'Numeric risk score (0-100) calculated by risk detection logic';
COMMENT ON COLUMN activity_logs.country IS 'Country from IP geolocation (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.city IS 'City from IP geolocation (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.latitude IS 'Latitude from IP geolocation (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.longitude IS 'Longitude from IP geolocation (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.browser_name IS 'Browser name parsed from user agent (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.browser_version IS 'Browser version parsed from user agent (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.os_name IS 'Operating system name parsed from user agent (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.os_version IS 'Operating system version parsed from user agent (backend-only, not exposed in UI)';
COMMENT ON COLUMN activity_logs.device_type IS 'Device type: desktop, mobile, tablet (backend-only, not exposed in UI)';
