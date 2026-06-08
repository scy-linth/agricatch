-- Add maintenance_mode and allow_registrations to feature_flags
INSERT INTO feature_flags (key, name, description, enabled)
VALUES
  ('maintenance_mode', 'Maintenance Mode', 'When enabled, only super_admin can access the site', false),
  ('allow_registrations', 'Allow New Registrations', 'Allow customers and farmers to register new accounts', true)
ON CONFLICT (key) DO NOTHING;
