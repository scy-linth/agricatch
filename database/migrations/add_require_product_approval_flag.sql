-- Add require_product_approval feature flag
-- TOGGLE BEHAVIOR:
-- - OFF (enabled=false): Farmers can add products freely - auto-approved and immediately visible in marketplace
-- - ON (enabled=true): New farmer products require admin approval before appearing in marketplace

INSERT INTO feature_flags (key, name, description, enabled)
VALUES ('require_product_approval', 'Require Product Approval', 'OFF: Farmers add products freely (auto-approved). ON: New products require admin approval before appearing in marketplace.', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled;
