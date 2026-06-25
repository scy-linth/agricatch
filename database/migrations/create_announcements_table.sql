-- Create announcements table for dismissible banners
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  audience VARCHAR(50) NOT NULL DEFAULT 'all', -- 'all', 'farmer', 'customer', 'admin'
  is_active BOOLEAN DEFAULT true,
  is_dismissible BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements(audience);
