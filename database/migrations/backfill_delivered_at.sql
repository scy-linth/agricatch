-- Backfill delivered_at for existing delivered orders
-- This migration fixes the timeline issue where delivered orders show "Pending" instead of actual delivery date

-- Update orders table: backfill delivered_at using updated_at for delivered orders with null delivered_at
UPDATE orders
SET delivered_at = COALESCE(
    -- First try to get the actual delivered timestamp from status history
    (SELECT created_at FROM order_status_history 
     WHERE order_id = orders.id AND status = 'delivered' 
     ORDER BY created_at DESC LIMIT 1),
    -- Fallback to updated_at (when the status was last changed to delivered)
    updated_at,
    -- Final fallback to created_at (order creation date)
    created_at
)
WHERE status = 'delivered' 
  AND delivered_at IS NULL;

-- Update order_items table: backfill delivered_at using the parent order's delivered_at
UPDATE order_items oi
SET delivered_at = (
    SELECT delivered_at FROM orders o 
    WHERE o.id = oi.order_id 
    LIMIT 1
)
WHERE oi.delivered_at IS NULL
  AND EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = oi.order_id AND o.status = 'delivered'
  );

-- Verify the backfill
SELECT 
    COUNT(*) as total_delivered_orders,
    COUNT(delivered_at) as orders_with_delivered_at,
    COUNT(*) - COUNT(delivered_at) as orders_still_missing_delivered_at
FROM orders 
WHERE status = 'delivered';
