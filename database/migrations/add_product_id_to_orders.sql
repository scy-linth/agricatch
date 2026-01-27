-- Migration: Add product_id column to orders table for per-item order system
-- This migration adds the product_id column if it doesn't exist

-- Check if column exists, if not, add it
DO $$
BEGIN
    -- Check if product_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'product_id'
    ) THEN
        -- Add product_id column
        ALTER TABLE orders ADD COLUMN product_id INTEGER REFERENCES products(id);
        
        -- Add quantity column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'quantity'
        ) THEN
            ALTER TABLE orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
        END IF;
        
        -- Add price column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'price'
        ) THEN
            ALTER TABLE orders ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0;
        END IF;
        
        -- Add total_amount column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'total_amount'
        ) THEN
            ALTER TABLE orders ADD COLUMN total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;
        END IF;
        
        -- Create index on product_id for performance
        CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
        
        RAISE NOTICE 'Successfully added product_id, quantity, price, and total_amount columns to orders table';
    ELSE
        RAISE NOTICE 'product_id column already exists in orders table';
    END IF;
END $$;

-- Verify the columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('product_id', 'quantity', 'price', 'total_amount')
ORDER BY column_name;
