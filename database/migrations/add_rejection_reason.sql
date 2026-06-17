-- Add rejection_reason column to products table
-- This allows admins to specify why a product was rejected

ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add comment
COMMENT ON COLUMN products.rejection_reason IS 'Reason provided by admin when rejecting a product';
