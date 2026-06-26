-- Add enable_wake_up_ping feature flag
-- This allows superadmin to toggle the Render wake-up ping cron job
INSERT INTO feature_flags (key, name, description, enabled)
VALUES ('enable_wake_up_ping', 'Enable Wake-Up Ping', 'When enabled, the Render cron job will ping the health endpoint every 5 minutes to keep the free tier service awake. When disabled, the service may sleep after inactivity.', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled;
