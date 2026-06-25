-- Add use_default_delivery_address setting to platform_settings table
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('use_default_delivery_address', 'true', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP;
