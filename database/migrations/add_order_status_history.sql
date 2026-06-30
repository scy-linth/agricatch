-- Migration: Create order_status_history table
-- Description: Track per-status timestamps for order timeline display

CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    changed_by_role VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_status ON order_status_history(order_id, status);

-- Backfill existing orders: insert 'pending' for all orders using created_at
INSERT INTO order_status_history (order_id, status, created_at)
SELECT id, 'pending', created_at FROM orders
WHERE NOT EXISTS (
    SELECT 1 FROM order_status_history h WHERE h.order_id = orders.id AND h.status = 'pending'
);

-- Backfill 'delivered' for delivered orders using delivered_at
INSERT INTO order_status_history (order_id, status, created_at)
SELECT id, 'delivered', delivered_at FROM orders
WHERE status = 'delivered' AND delivered_at IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM order_status_history h WHERE h.order_id = orders.id AND h.status = 'delivered'
);

-- Backfill current status for non-pending/non-delivered orders using updated_at
INSERT INTO order_status_history (order_id, status, created_at)
SELECT id, status, updated_at FROM orders
WHERE status NOT IN ('pending', 'delivered')
AND NOT EXISTS (
    SELECT 1 FROM order_status_history h WHERE h.order_id = orders.id AND h.status = orders.status
);

COMMENT ON TABLE order_status_history IS 'Tracks per-status transition timestamps for order timeline';
