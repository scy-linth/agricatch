-- Add pre-order fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_availability_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_preorder_quantity INTEGER CHECK (max_preorder_quantity IS NULL OR max_preorder_quantity > 0);

-- Add is_preorder field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_converted_at TIMESTAMP;

-- Add per-order preorder allocation tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_reserved_quantity INTEGER DEFAULT 0 CHECK (preorder_reserved_quantity >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_fulfilled_quantity INTEGER DEFAULT 0 CHECK (preorder_fulfilled_quantity >= 0);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_is_preorder ON products(is_preorder);
CREATE INDEX IF NOT EXISTS idx_products_preorder_availability_date ON products(preorder_availability_date);
CREATE INDEX IF NOT EXISTS idx_orders_is_preorder ON orders(is_preorder);
CREATE INDEX IF NOT EXISTS idx_orders_preorder_converted_at ON orders(preorder_converted_at);

-- Add NOT NULL constraints for pre-order fields
DO $$
BEGIN
  ALTER TABLE products ALTER COLUMN is_preorder SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23502' THEN NULL; ELSE RAISE; END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE products ALTER COLUMN reserved_quantity SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23502' THEN NULL; ELSE RAISE; END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE orders ALTER COLUMN is_preorder SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23502' THEN NULL; ELSE RAISE; END IF;
END $$;

-- Add check constraint for date validation (idempotent)
DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT preorder_expiry_check CHECK (
    preorder_availability_date IS NULL OR
    expiry_date IS NULL OR
    expiry_date >= preorder_availability_date
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add check constraint for preorder availability date requirement (idempotent)
DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT preorder_availability_required CHECK (
    is_preorder = false OR preorder_availability_date IS NOT NULL
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add check constraint for reserved quantity <= max preorder quantity (idempotent)
DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT preorder_reserved_within_max CHECK (
    max_preorder_quantity IS NULL OR reserved_quantity <= max_preorder_quantity
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Add check constraint for stock_quantity >= 0 (idempotent)
DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT stock_quantity_non_negative CHECK (
    stock_quantity >= 0
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
