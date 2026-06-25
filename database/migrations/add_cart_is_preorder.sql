-- Add is_preorder field to cart table to track pre-order vs regular items
ALTER TABLE cart ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_cart_is_preorder ON cart(is_preorder);
