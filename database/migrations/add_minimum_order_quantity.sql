ALTER TABLE products
ADD COLUMN IF NOT EXISTS minimum_order_quantity INTEGER;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_minimum_order_quantity_positive;

ALTER TABLE products
ADD CONSTRAINT products_minimum_order_quantity_positive
CHECK (minimum_order_quantity IS NULL OR minimum_order_quantity > 0);
