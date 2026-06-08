-- Migration: add status column to products table for approval workflow

ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Backfill: derive status from existing booleans
UPDATE products
SET status = CASE
    WHEN is_available = true  AND COALESCE(is_admin_disabled, false) = false THEN 'approved'
    WHEN is_available = false AND COALESCE(is_admin_disabled, false) = true  THEN 'rejected'
    WHEN is_available = true  AND COALESCE(is_admin_disabled, false) = true  THEN 'disabled'
    WHEN is_available = false AND COALESCE(is_admin_disabled, false) = false THEN 'unavailable'
    ELSE 'approved'
END
WHERE status IS NULL
   OR (status = 'pending' AND is_available = true AND COALESCE(is_admin_disabled, false) = false);
