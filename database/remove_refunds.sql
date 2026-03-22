-- Migration: remove refunds table and refund columns from orders
-- BACKUP your database before running this script.
BEGIN;

-- Drop refund columns from orders (if present)
ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS refund_status;
ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS refund_amount;

-- Drop refunds table (if present)
DROP TABLE IF EXISTS refunds;

COMMIT;

-- End of migration
