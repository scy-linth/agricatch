-- Add max_products_per_farmer setting to platform_settings
-- This controls the maximum number of products a free-tier farmer can list
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('max_products_per_farmer', '10', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
