-- Delete unused platform_fee setting from platform_settings table
-- This setting is not used anywhere in the codebase

DELETE FROM platform_settings WHERE key = 'platform_fee';
