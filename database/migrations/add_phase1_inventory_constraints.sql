-- Phase 1: Add inventory safety constraints
-- This migration adds minimal numeric constraints to prevent invalid inventory data

-- Products table constraints
ALTER TABLE products ADD CONSTRAINT stock_quantity_non_negative 
CHECK (stock_quantity >= 0);

ALTER TABLE products ADD CONSTRAINT reserved_quantity_non_negative 
CHECK (reserved_quantity >= 0);

ALTER TABLE products ADD CONSTRAINT reserved_within_max_preorder 
CHECK (max_preorder_quantity IS NULL OR reserved_quantity <= max_preorder_quantity);

-- Orders table constraints
ALTER TABLE orders ADD CONSTRAINT order_quantity_positive 
CHECK (quantity > 0);

ALTER TABLE orders ADD CONSTRAINT preorder_reserved_non_negative 
CHECK (preorder_reserved_quantity >= 0);

ALTER TABLE orders ADD CONSTRAINT preorder_fulfilled_non_negative 
CHECK (preorder_fulfilled_quantity >= 0);

ALTER TABLE orders ADD CONSTRAINT preorder_reserved_within_order 
CHECK (preorder_reserved_quantity <= quantity);

ALTER TABLE orders ADD CONSTRAINT preorder_fulfilled_within_order 
CHECK (preorder_fulfilled_quantity <= quantity);
