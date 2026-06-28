# AgriCatch Database Documentation
Version: 2.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document documents the actual database schema in AgriCatch based on the
repository implementation.

Repository implementation is the source of truth.

==============================================================================
DATABASE PLATFORM
==============================================================================

Database Engine
- PostgreSQL

Provider
- Supabase

Connection
- SSL enabled for Render/Supabase
- Timezone: UTC
- Pool-based connection management

==============================================================================
CORE TABLES
==============================================================================

users
- Purpose: User accounts and profiles
- Columns:
  - id (SERIAL PRIMARY KEY)
  - username (VARCHAR(50) UNIQUE NOT NULL)
  - email (VARCHAR(100) UNIQUE NOT NULL)
  - password (VARCHAR(255) NOT NULL)
  - full_name (VARCHAR(130))
  - first_name (VARCHAR(40))
  - middle_name (VARCHAR(40))
  - last_name (VARCHAR(40))
  - shop_name (VARCHAR(40))
  - phone (VARCHAR(20))
  - address (TEXT)
  - role (VARCHAR(20) DEFAULT 'customer')
  - is_verified (BOOLEAN DEFAULT false)
  - shop_description (TEXT)
  - shop_banner_url (VARCHAR(255))
  - shop_avatar_url (VARCHAR(255))
  - total_sales (INTEGER DEFAULT 0)
  - total_revenue (DECIMAL(10,2) DEFAULT 0)
  - response_rate (DECIMAL(5,2) DEFAULT 0)
  - average_response_time (INTEGER DEFAULT 0)
  - cancellation_rate (DECIMAL(5,2) DEFAULT 0)
  - total_reviews (INTEGER DEFAULT 0)
  - average_rating (DECIMAL(3,2) DEFAULT 0)
  - customer_total_ratings (INTEGER DEFAULT 0)
  - customer_average_rating (DECIMAL(3,2) DEFAULT 0)
  - is_disabled (BOOLEAN DEFAULT false)
  - disabled_at (TIMESTAMP)
  - disabled_reason (TEXT)
  - is_debug_account (BOOLEAN DEFAULT false)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: users_username_unique


categories
- Purpose: Product categories
- Columns:
  - id (SERIAL PRIMARY KEY)
  - name (VARCHAR(50) UNIQUE NOT NULL)
  - description (TEXT)
  - type (VARCHAR(50) DEFAULT 'agricultural')
  - is_disabled (BOOLEAN DEFAULT false)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: categories_name_unique, categories_name_lower_unique


products
- Purpose: Product listings
- Columns:
  - id (SERIAL PRIMARY KEY)
  - name (VARCHAR(100) NOT NULL)
  - description (TEXT)
  - price (DECIMAL(10,2) NOT NULL)
  - category_id (INTEGER REFERENCES categories(id))
  - farmer_id (INTEGER REFERENCES users(id))
  - stock_quantity (INTEGER DEFAULT 0)
  - unit (VARCHAR(20) DEFAULT 'kg')
  - image_url (VARCHAR(255))
  - sales_count (INTEGER DEFAULT 0)
  - is_available (BOOLEAN DEFAULT true)
  - is_admin_disabled (BOOLEAN DEFAULT false)
  - admin_disabled_at (TIMESTAMP)
  - location (VARCHAR(100))
  - harvest_date (DATE)
  - expiry_date (DATE)
  - linked_product_id (INTEGER REFERENCES products(id) ON DELETE SET NULL)
  - status (VARCHAR(20) DEFAULT 'pending')
  - is_preorder (BOOLEAN DEFAULT false)
  - preorder_availability_date (DATE)
  - reserved_quantity (INTEGER DEFAULT 0)
  - max_preorder_quantity (INTEGER DEFAULT 0)
  - preorder_converted_at (TIMESTAMP)
  - preorder_fulfilled_quantity (INTEGER DEFAULT 0)
  - preorder_reserved_quantity (INTEGER DEFAULT 0)
  - city (VARCHAR(100))
  - province (VARCHAR(100))
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: idx_products_category, idx_products_farmer


cart
- Purpose: Shopping cart
- Columns:
  - id (SERIAL PRIMARY KEY)
  - session_id (VARCHAR(255))
  - user_id (INTEGER REFERENCES users(id))
  - product_id (INTEGER REFERENCES products(id))
  - quantity (INTEGER NOT NULL DEFAULT 1)
  - added_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - is_preorder (BOOLEAN DEFAULT false)
- Indexes: cart_session_product_unique, cart_user_product_unique, idx_cart_session, idx_cart_user, idx_cart_is_preorder


orders
- Purpose: Per-item orders
- Columns:
  - id (SERIAL PRIMARY KEY)
  - user_id (INTEGER REFERENCES users(id))
  - product_id (INTEGER REFERENCES products(id))
  - quantity (INTEGER NOT NULL DEFAULT 1)
  - price (DECIMAL(10,2) NOT NULL)
  - total_amount (DECIMAL(10,2) NOT NULL)
  - status (VARCHAR(20) DEFAULT 'pending')
  - is_disabled (BOOLEAN DEFAULT false)
  - disabled_at (TIMESTAMP)
  - payment_method (VARCHAR(20) DEFAULT 'cash_on_delivery')
  - delivery_address (TEXT)
  - delivery_date (DATE)
  - estimated_delivery_date (DATE)
  - cancelled_at (TIMESTAMP)
  - cancellation_reason (TEXT)
  - cancelled_by (VARCHAR(20))
  - reschedule_reason (TEXT)
  - replacement_order_id (INTEGER)
  - special_instructions (TEXT)
  - delivered_at (TIMESTAMP)
  - is_preorder (BOOLEAN DEFAULT false)
  - preorder_converted_at (TIMESTAMP)
  - preorder_fulfilled_quantity (INTEGER DEFAULT 0)
  - preorder_reserved_quantity (INTEGER DEFAULT 0)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: idx_orders_user, idx_orders_product, idx_orders_status, idx_orders_disabled


order_items
- Purpose: Order line items
- Columns:
  - id (SERIAL PRIMARY KEY)
  - order_id (INTEGER REFERENCES orders(id))
  - product_id (INTEGER REFERENCES products(id))
  - quantity (INTEGER NOT NULL)
  - price (DECIMAL(10,2) NOT NULL)
  - status (VARCHAR(20) DEFAULT 'pending')
  - delivered_at (TIMESTAMP)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: idx_order_items_order


reviews
- Purpose: Product reviews
- Columns:
  - id (SERIAL PRIMARY KEY)
  - product_id (INTEGER REFERENCES products(id))
  - user_id (INTEGER REFERENCES users(id))
  - rating (INTEGER NOT NULL)
  - comment (TEXT)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: reviews_product_user_unique


customer_ratings
- Purpose: Farmer ratings of customers
- Columns:
  - id (SERIAL PRIMARY KEY)
  - order_id (INTEGER REFERENCES orders(id))
  - farmer_id (INTEGER REFERENCES users(id))
  - customer_id (INTEGER REFERENCES users(id))
  - rating (INTEGER NOT NULL)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Unique: (order_id, farmer_id)


wishlist
- Purpose: Customer wishlist
- Columns:
  - id (SERIAL PRIMARY KEY)
  - user_id (INTEGER REFERENCES users(id))
  - product_id (INTEGER REFERENCES products(id))
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: wishlist_user_product_unique


notifications
- Purpose: User notifications
- Columns:
  - id (SERIAL PRIMARY KEY)
  - user_id (INTEGER REFERENCES users(id))
  - type (VARCHAR(50))
  - title (VARCHAR(255))
  - message (TEXT)
  - is_read (BOOLEAN DEFAULT false)
  - order_id (INTEGER REFERENCES orders(id) ON DELETE SET NULL)
  - product_id (INTEGER REFERENCES products(id))
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


conversations
- Purpose: Chat conversations
- Columns:
  - id (SERIAL PRIMARY KEY)
  - conversation_id (VARCHAR(255) UNIQUE NOT NULL)
  - farmer_id (INTEGER REFERENCES users(id))
  - customer_id (INTEGER REFERENCES users(id))
  - last_message_at (TIMESTAMP)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Unique: (farmer_id, customer_id)


messages
- Purpose: Chat messages
- Columns:
  - id (SERIAL PRIMARY KEY)
  - conversation_id (VARCHAR(255))
  - sender_id (INTEGER REFERENCES users(id))
  - receiver_id (INTEGER REFERENCES users(id))
  - message (TEXT NOT NULL)
  - is_read (BOOLEAN DEFAULT false)
  - product_id (INTEGER REFERENCES products(id))
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


product_name_catalog
- Purpose: Approved product-name catalog for farmer product forms
- Columns:
  - id (SERIAL PRIMARY KEY)
  - name VARCHAR(100) NOT NULL
  - category_id INTEGER REFERENCES categories(id)
  - average_price DECIMAL(10, 2)
  - default_unit VARCHAR(20)
  - is_disabled BOOLEAN DEFAULT false
  - created_by INTEGER REFERENCES users(id)
  - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- Runtime schema: backend/routes/products.js:187-200
- Roles: Farmer product forms, admin catalog


product_name_requests
- Purpose: Farmer requests for custom product names/categories
- Columns:
  - id SERIAL PRIMARY KEY
  - name VARCHAR(100) NOT NULL
  - category_id INTEGER REFERENCES categories(id)
  - requested_by INTEGER REFERENCES users(id)
  - reviewed_by INTEGER REFERENCES users(id)
  - status VARCHAR(20) DEFAULT 'pending'
  - rejection_reason TEXT
  - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - reviewed_at TIMESTAMP
- Runtime schema: backend/routes/products.js:202-218
- Roles: Farmer, admin


verification_requests
- Purpose: Farmer verification workflow
- Columns:
  - id SERIAL PRIMARY KEY
  - farmer_id INTEGER REFERENCES users(id)
  - verification_document_url VARCHAR(255)
  - reviewed_by INTEGER REFERENCES users(id)
  - status VARCHAR(20) DEFAULT 'pending'
  - rejection_reason TEXT
  - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - reviewed_at TIMESTAMP
- Creation script: backend/run_verification_requests_migration.js:14-20
- Roles: Farmer, admin


support_tickets
- Purpose: Customer/farmer support cases
- Columns:
  - id SERIAL PRIMARY KEY
  - user_id INTEGER REFERENCES users(id)
  - subject VARCHAR(255) NOT NULL
  - status VARCHAR(20) DEFAULT 'open'
  - priority VARCHAR(20) DEFAULT 'normal'
  - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- Creation script: backend/create_support_tables.js:24-29
- Roles: Customer, farmer, admin


support_messages
- Purpose: Support ticket chat messages
- Columns:
  - id SERIAL PRIMARY KEY
  - ticket_id INTEGER REFERENCES support_tickets(id)
  - sender_id INTEGER REFERENCES users(id)
  - message TEXT NOT NULL
  - is_admin BOOLEAN DEFAULT false
  - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- Creation script: backend/create_support_tables.js:39-44
- Roles: Customer, farmer, admin
- Indexes: idx_messages_conversation, idx_messages_sender_receiver


user_addresses
- Purpose: User delivery addresses
- Columns:
  - id (SERIAL PRIMARY KEY)
  - user_id (INTEGER REFERENCES users(id))
  - label (VARCHAR(50))
  - full_name (VARCHAR(100))
  - first_name (VARCHAR(40))
  - middle_name (VARCHAR(40))
  - last_name (VARCHAR(40))
  - phone (VARCHAR(20))
  - address_line1 (TEXT NOT NULL)
  - address_line2 (TEXT)
  - city (VARCHAR(100))
  - province (VARCHAR(100))
  - postal_code (VARCHAR(20))
  - is_default (BOOLEAN DEFAULT false)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

==============================================================================
AUTHENTICATION TABLES
==============================================================================

otps
- Purpose: OTP verification
- Columns:
  - id (SERIAL PRIMARY KEY)
  - email (VARCHAR(100) NOT NULL)
  - otp_code (VARCHAR(10) NOT NULL)
  - purpose (VARCHAR(50) NOT NULL DEFAULT 'login')
  - expires_at (TIMESTAMP NOT NULL)
  - is_used (BOOLEAN DEFAULT false)
  - attempts (INTEGER DEFAULT 0)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: idx_otps_email_purpose, idx_otps_expires_at


password_resets
- Purpose: Password reset tokens
- Columns:
  - id (SERIAL PRIMARY KEY)
  - user_id (INTEGER REFERENCES users(id) ON DELETE CASCADE)
  - email (VARCHAR(100) NOT NULL)
  - otp_hash (VARCHAR(255) NOT NULL)
  - expires_at (TIMESTAMP NOT NULL)
  - used (BOOLEAN DEFAULT false)
  - attempts (INTEGER DEFAULT 0)
  - sent_count (INTEGER DEFAULT 1)
  - last_sent_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - used_at (TIMESTAMP)
  - request_ip (VARCHAR(64))
  - user_agent (TEXT)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: idx_password_resets_user_created, idx_password_resets_expires

==============================================================================
ADMIN TABLES
==============================================================================

admin_audit_logs
- Purpose: Admin action audit trail
- Columns:
  - id (SERIAL PRIMARY KEY)
  - actor_admin_id (INTEGER NOT NULL)
  - actor_admin_email (VARCHAR(255))
  - actor_admin_name (VARCHAR(255))
  - action (VARCHAR(100) NOT NULL)
  - entity (VARCHAR(50) NOT NULL)
  - entity_id (INTEGER)
  - before (JSONB)
  - after (JSONB)
  - ip_address (VARCHAR(45))
  - user_agent (TEXT)
  - session_id (VARCHAR(100))
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- Indexes: idx_admin_audit_logs_created_at, idx_admin_audit_logs_actor, idx_admin_audit_logs_entity, idx_admin_audit_logs_action


activity_logs
- Purpose: User activity logs
- Columns:
  - id (SERIAL PRIMARY KEY)
  - user_id (INTEGER REFERENCES users(id))
  - action (VARCHAR(100) NOT NULL)
  - entity_type (VARCHAR(50))
  - entity_id (INTEGER)
  - details (JSONB)
  - ip_address (VARCHAR(45))
  - user_agent (TEXT)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


activity_monitor_settings
- Purpose: Activity monitoring configuration
- Columns:
  - id (SERIAL PRIMARY KEY)
  - key (VARCHAR(100) UNIQUE NOT NULL)
  - value (TEXT)
  - description (TEXT)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


announcements
- Purpose: Platform announcements
- Columns:
  - id (SERIAL PRIMARY KEY)
  - title (VARCHAR(255) NOT NULL)
  - message (TEXT NOT NULL)
  - is_active (BOOLEAN DEFAULT true)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


feature_flags
- Purpose: Feature flag management
- Columns:
  - key (VARCHAR(100) PRIMARY KEY)
  - name (VARCHAR(200) NOT NULL)
  - description (TEXT)
  - enabled (BOOLEAN NOT NULL DEFAULT false)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


platform_settings
- Purpose: Platform configuration
- Columns:
  - id (SERIAL PRIMARY KEY)
  - key (VARCHAR(100) UNIQUE NOT NULL)
  - value (TEXT)
  - description (TEXT)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


settings
- Purpose: Legacy settings table
- Columns:
  - id (SERIAL PRIMARY KEY)
  - key (VARCHAR(100) UNIQUE NOT NULL)
  - value (TEXT)
  - description (TEXT)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

==============================================================================
BUSINESS TABLES
==============================================================================

farmer_subscriptions
- Purpose: Farmer subscription tiers
- Columns:
  - id (SERIAL PRIMARY KEY)
  - farmer_id (INTEGER REFERENCES users(id))
  - tier (VARCHAR(50) NOT NULL)
  - status (VARCHAR(20) DEFAULT 'pending')
  - expires_at (TIMESTAMP)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


payment_accounts
- Purpose: Payment account management
- Columns:
  - id (SERIAL PRIMARY KEY)
  - user_id (INTEGER REFERENCES users(id))
  - account_type (VARCHAR(50) NOT NULL)
  - account_number (VARCHAR(100) NOT NULL)
  - account_name (VARCHAR(100) NOT NULL)
  - is_default (BOOLEAN DEFAULT false)
  - created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)


featured_products
- Purpose: Featured product management
- Columns:
  - id (SERIAL PRIMARY KEY)
  - product_id (INTEGER REFERENCES products(id))
  - featured_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
  - expires_at (TIMESTAMP)

==============================================================================
MIGRATIONS
==============================================================================

Migration Location: database/migrations/

Key Migrations:
- add_product_status.sql - Added products.status column
- add_farmer_subscriptions.sql - Subscription system
- add_featured_products_table.sql - Featured products
- create_activity_logs.sql - Activity logging
- create_admin_audit_logs.sql - Admin audit trail
- create_announcements_table.sql - Platform announcements
- create_otp_table.js - OTP verification
- create_password_resets_table.sql - Password reset
- add_address_name_fields.sql - Address name fields
- add_name_fields.sql - User name fields
- set_name_fields_40_chars.sql - Name field length limits
- add_psgc_address_fields.sql - PSGC location fields
- add_harvest_tracking_fields.sql - Harvest date tracking
- add_preorder_fields.sql - Pre-order fields
- add_linked_product_id.sql - Product linking
- add_verification_document_url.sql - Verification documents
- add_max_products_per_farmer_setting.sql - Product limits
- add_cart_is_preorder.sql - Cart pre-order tracking
- add_phase1_inventory_constraints.sql - Inventory constraints

==============================================================================
SCHEMA PRINCIPLES
==============================================================================

Prefer:

- Additive changes
- Backward compatibility
- Non-destructive migrations
- Proper foreign keys
- Appropriate indexes

Avoid:

- Dropping columns without approval
- Renaming tables without approval
- Destructive migrations
- Removing foreign keys

==============================================================================
DATA INTEGRITY
==============================================================================

Maintain:

- Referential integrity via foreign keys
- Unique constraints for uniqueness
- Check constraints for validation
- Transaction consistency

Soft delete pattern:
- is_disabled columns for soft deletion
- disabled_at timestamps
- disabled_reason for audit trail

==============================================================================
END
==============================================================================