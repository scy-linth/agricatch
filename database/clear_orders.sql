-- Clear all orders and related data from the database
-- This script deletes all orders regardless of status (pending, confirmed, preparing, out_for_delivery, delivered, cancelled)
-- Run this script to refresh/clear the orders table

-- Start transaction for safety
BEGIN;

-- Step 1: Delete from tables that reference orders (must be done first due to foreign key constraints)

-- Delete all order items
DELETE FROM order_items;

-- Delete all notifications related to orders
DELETE FROM notifications WHERE order_id IS NOT NULL;

-- Delete all refunds related to orders
DELETE FROM refunds;

-- Step 2: Handle self-referencing replacement_order_id in orders table
-- Set replacement_order_id to NULL for all orders that have it
UPDATE orders SET replacement_order_id = NULL WHERE replacement_order_id IS NOT NULL;

-- Step 3: Delete all orders (all statuses: pending, confirmed, preparing, out_for_delivery, delivered, cancelled)
DELETE FROM orders;

-- Step 4: Reset the sequence for orders table (so new orders start from 1)
ALTER SEQUENCE orders_id_seq RESTART WITH 1;

-- Optionally reset other sequences
ALTER SEQUENCE order_items_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE refunds_id_seq RESTART WITH 1;

-- Commit the transaction
COMMIT;

-- Display confirmation
SELECT 'All orders have been deleted successfully!' AS message;
SELECT COUNT(*) AS remaining_orders FROM orders;
