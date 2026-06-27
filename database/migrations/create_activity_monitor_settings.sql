-- Create activity_monitor_settings table for configurable Activity Monitor behavior
-- Migration: create_activity_monitor_settings.sql

CREATE TABLE IF NOT EXISTS activity_monitor_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO activity_monitor_settings (setting_key, setting_value, description) VALUES
('retention_days', '90', 'Number of days to keep activity logs before cleanup'),
('max_records', '100000', 'Maximum number of activity records to keep'),
('auto_delete', 'true', 'Enable automatic deletion of old logs'),
('deduplication_enabled', 'true', 'Enable duplicate activity prevention'),
('deduplication_interval_seconds', '5', 'Time interval in seconds to consider activities as duplicates'),
('max_metadata_size_bytes', '4096', 'Maximum size of metadata JSON in bytes'),
('log_ip_address', 'true', 'Enable logging of IP addresses'),
('log_user_agent', 'true', 'Enable logging of user agent strings'),
('log_request_id', 'true', 'Enable logging of request IDs for correlation'),
('enabled_roles', 'customer,farmer,admin,super_admin', 'Comma-separated list of roles to log activities for')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index on setting_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_activity_monitor_settings_key ON activity_monitor_settings(setting_key);

-- Add comment
COMMENT ON TABLE activity_monitor_settings IS 'Configurable settings for Activity Monitor behavior and retention policies';
