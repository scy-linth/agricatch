-- Agricultural and Fishery Products Marketplace Database Schema
-- Note: Make sure you are connected to the 'agri_fishery_marketplace' database before running this script

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    role VARCHAR(20) DEFAULT 'customer', -- 'customer', 'farmer', 'admin', 'super_admin'
    is_verified BOOLEAN DEFAULT false,
    shop_description TEXT,
    shop_banner_url VARCHAR(255),
    shop_avatar_url VARCHAR(255),
    total_sales INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    response_rate DECIMAL(5,2) DEFAULT 0,
    average_response_time INTEGER DEFAULT 0,
    cancellation_rate DECIMAL(5,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    farmer_id INTEGER REFERENCES users(id),
    stock_quantity INTEGER DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'kg', -- kg, pieces, boxes, etc.
    image_url VARCHAR(255),
    sales_count INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    location VARCHAR(100), -- farm location
    harvest_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cart table (for guest users and persistent carts)
CREATE TABLE IF NOT EXISTS cart (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255), -- for guest users
    user_id INTEGER REFERENCES users(id), -- for logged in users
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, product_id),
    UNIQUE(user_id, product_id)
);

-- Orders table (per-item orders: each order represents one product/item)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL, -- price at time of order
    total_amount DECIMAL(10, 2) NOT NULL, -- quantity * price
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, preparing, out_for_delivery, delivered, cancelled
    payment_method VARCHAR(20) DEFAULT 'cash_on_delivery',
    delivery_address TEXT,
    delivery_date DATE,
    estimated_delivery_date DATE,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(20),
    refund_status VARCHAR(20),
    refund_amount DECIMAL(10,2),
    replacement_order_id INTEGER,
    special_instructions TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL, -- price at time of order
    status VARCHAR(20) DEFAULT 'pending',
    delivered_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    user_id INTEGER REFERENCES users(id),
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, user_id)
);

-- Wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, product_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    farmer_id INTEGER REFERENCES users(id),
    customer_id INTEGER REFERENCES users(id),
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (farmer_id, customer_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255),
    sender_id INTEGER REFERENCES users(id),
    receiver_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    product_id INTEGER REFERENCES products(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);

-- User addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    label VARCHAR(50),
    full_name VARCHAR(100),
    phone VARCHAR(20),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refunds table (optional tracking)
CREATE TABLE IF NOT EXISTS refunds (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    refund_amount DECIMAL(10,2),
    refund_reason TEXT,
    status VARCHAR(20),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTPs table for email verification
CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'login', -- 'login', 'register', 'reset_password'
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otps_email_purpose ON otps(email, purpose);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
('Agricultural Products', 'Fresh vegetables, fruits, grains, and other farm products'),
('Fishery Products', 'Fresh fish, seafood, and aquaculture products')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_farmer ON products(farmer_id);
CREATE INDEX IF NOT EXISTS idx_cart_session ON cart(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);