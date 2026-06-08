-- Add delivery_fee to platform_settings if not exists
-- Default value: 35

INSERT INTO platform_settings (key, value, updated_at)
VALUES ('delivery_fee', '35', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
