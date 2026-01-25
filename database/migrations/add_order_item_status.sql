-- Add per-item status and tracking fields
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(50) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS tracking_updates JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- Backfill item status and tracking from order status
UPDATE order_items oi
SET status = CASE
    WHEN o.status IN ('confirmed', 'preparing') THEN 'preparing'
    WHEN o.status = 'ready' THEN 'ready'
    WHEN o.status = 'delivered' THEN 'delivered'
    WHEN o.status = 'cancelled' THEN 'cancelled'
    ELSE 'pending'
END,
tracking_status = CASE
    WHEN o.status IN ('confirmed', 'preparing') THEN 'preparing'
    WHEN o.status = 'ready' THEN 'out_for_delivery'
    WHEN o.status = 'delivered' THEN 'delivered'
    WHEN o.status = 'cancelled' THEN 'cancelled'
    ELSE 'pending'
END,
tracking_updates = COALESCE(oi.tracking_updates, '[]'::jsonb),
updated_at = COALESCE(oi.updated_at, CURRENT_TIMESTAMP)
FROM orders o
WHERE oi.order_id = o.id;

-- Seed tracking_updates with an initial event if empty
UPDATE order_items
SET tracking_updates = jsonb_build_array(
    jsonb_build_object(
        'status', tracking_status,
        'note', 'Backfilled from order status',
        'timestamp', NOW()
    )
)
WHERE tracking_updates IS NULL OR tracking_updates = '[]'::jsonb;
