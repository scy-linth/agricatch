-- Add shop-related columns to users table if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS shop_description TEXT,
ADD COLUMN IF NOT EXISTS shop_banner_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS shop_avatar_url VARCHAR(255);
