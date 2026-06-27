-- Add linked_product_id column to products table for Product Lifecycle implementation
-- This allows linking Available and Pre-order products of the same farmer and product catalog item

-- Add the column with a foreign key constraint to products.id
ALTER TABLE products ADD COLUMN IF NOT EXISTS linked_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;

-- Add an index for efficient lookups of linked products
CREATE INDEX IF NOT EXISTS idx_products_linked_product_id ON products(linked_product_id);

-- Add a comment to document the purpose
COMMENT ON COLUMN products.linked_product_id IS 'Links Available and Pre-order products. When a farmer creates both an Available and Pre-order product for the same product catalog item, they are automatically linked. This enables the Harvest lifecycle to transfer stock between linked products.';
