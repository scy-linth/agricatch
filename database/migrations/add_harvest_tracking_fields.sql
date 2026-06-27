-- Add harvest tracking fields to products table
-- This migration adds minimal fields needed for harvest reminder system
-- No new tables are created to keep the implementation lightweight

ALTER TABLE products
ADD COLUMN IF NOT EXISTS harvest_adjustment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_harvest_adjustment_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS harvest_overdue_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reservations_disabled BOOLEAN DEFAULT false;

-- Add index for efficient overdue checks
CREATE INDEX IF NOT EXISTS idx_products_harvest_date
ON products(harvest_date) WHERE harvest_date IS NOT NULL;

-- Add index for reservation disabled products
CREATE INDEX IF NOT EXISTS idx_products_reservations_disabled
ON products(reservations_disabled) WHERE reservations_disabled = true;
