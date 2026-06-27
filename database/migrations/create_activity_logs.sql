-- Migration: Create activity_logs table
-- Description: Track user activities across the platform for monitoring and analytics

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL, -- 'customer', 'farmer', 'admin', 'super_admin'
    action VARCHAR(50) NOT NULL, -- login, logout, failed_login, search_product, view_product, add_wishlist, remove_wishlist, add_cart, remove_cart, checkout, place_order, cancel_order, add_product, edit_product, delete_product, approve_farmer, reject_farmer, security_event, admin_settings_change
    entity_type VARCHAR(50), -- 'product', 'order', 'user', 'category', 'settings', etc.
    entity_id INTEGER, -- ID of the entity being acted upon
    description TEXT,
    current_page VARCHAR(255),
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed', 'pending'
    metadata JSONB DEFAULT '{}', -- Additional context (key-value pairs)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient filtering and querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_session_id ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_role ON activity_logs(role);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_composite ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_session_composite ON activity_logs(session_id, created_at DESC);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_date_range ON activity_logs(created_at DESC);

-- Add comment to table
COMMENT ON TABLE activity_logs IS 'Logs user activities across the platform for monitoring and analytics';
