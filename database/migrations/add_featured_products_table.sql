-- Add featured_products table for verified farmer placement
-- This allows admins to manually feature products from verified farmers

CREATE TABLE IF NOT EXISTS featured_products (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  farmer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  featured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  position INTEGER DEFAULT 0, -- Display order (1 = top priority)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_farmer_verified CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = farmer_id AND role = 'farmer' AND is_verified = true
    )
  )
);

-- Index for active featured products
CREATE INDEX IF NOT EXISTS idx_featured_products_active ON featured_products(product_id, is_active) WHERE is_active = true;

-- Index for farmer featured products
CREATE INDEX IF NOT EXISTS idx_featured_products_farmer ON featured_products(farmer_id, is_active) WHERE is_active = true;

-- Index for expiration
CREATE INDEX IF NOT EXISTS idx_featured_products_expires ON featured_products(expires_at) WHERE expires_at IS NOT NULL;
