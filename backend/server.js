// AgriCatch Backend Server
// Auto-reload trigger
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { addSseClient, broadcastEvent } = require('./utils/realtime');
const { checkMaintenanceMode } = require('./middleware/featureFlags');
require('dotenv').config();
const { pool } = require('./utils/db');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render deployment (fixes express-rate-limit X-Forwarded-For warning)
app.set('trust proxy', true);

// Health route for uptime pings
const healthRouter = require('./routes/health');
const supportTicketsRouter = require('./routes/support-tickets');
app.use('/_health', healthRouter);
// Local ingest logger helper (disabled in production by default)
const _INGEST_URL = 'http://127.0.0.1:7242/ingest/edada99e-03b1-40b7-84f1-7a3e6b30377c';
const shouldSendIngest = process.env.NODE_ENV !== 'production' && process.env.ENABLE_INGEST !== 'false';
function sendIngest(payload) {
  if (!shouldSendIngest) return;
  try {
    fetch(_INGEST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
  } catch (e) {
    // swallow errors - this is best-effort local logging
  }
}


// Middleware - CORS Configuration
// Normalize origins to avoid false negatives from trailing slashes and casing.
const normalizeOrigin = (value) => {
  if (!value) return '';
  try {
    const parsed = new URL(String(value).trim());
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch (_) {
    return String(value).trim().replace(/\/+$/, '').toLowerCase();
  }
};

const defaultProductionOrigins = [
  'https://agricatch.store',
  'https://www.agricatch.store',
  'https://agricatch.onrender.com',
  'https://api.agricatch.store',
  'https://agricatch.page.dev'
];

const defaultDevelopmentOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:7242',
  'http://127.0.0.1:7242',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((url) => normalizeOrigin(url))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(process.env.NODE_ENV === 'production' ? defaultProductionOrigins : defaultDevelopmentOrigins).map(normalizeOrigin)
]);

const isTrustedAgricatchOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;
    return (
      hostname === 'agricatch.store' ||
      hostname.endsWith('.agricatch.store') ||
      hostname === 'agricatch.page.dev' ||
      hostname.endsWith('.agricatch.page.dev')
    );
  } catch (_) {
    return false;
  }
};

// CORS configuration
if (process.env.PERMISSIVE_CORS === 'true') {
  // Opt-in permissive mode: echo origin and allow credentials
  console.warn('âš ï¸ PERMISSIVE_CORS enabled - allowing any origin (use only for short-term debugging)');
  app.use(cors({ origin: true, credentials: true }));
} else {
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
      if (!origin) return callback(null, true);

      // In development allow any origin (useful for local testing)
      if (process.env.NODE_ENV !== 'production') return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);

      // In production allow explicit origins and trusted agricatch domains.
      if (allowedOrigins.has(normalizedOrigin) || isTrustedAgricatchOrigin(normalizedOrigin)) {
        return callback(null, true);
      }

      // Not allowed
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      return callback(err);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

const getTokenFromRequest = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return null;
};

// Block disabled accounts on any request with a valid token
app.use(async (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (!token) return next();
  let decoded = null;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return next();
  }

  if (!decoded) return next();

  try {
    const userResult = await pool.query('SELECT is_disabled FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length && userResult.rows[0].is_disabled) {
      return res.status(403).json({ message: 'Account disabled. Please contact support.' });
    }
  } catch (error) {
    console.error('Disabled-user check failed:', error.message || error);
  }

  return next();
});

// Check maintenance mode - block all non-super_admin users when enabled
app.use(checkMaintenanceMode);

// DB migrations (best-effort)
// Ensure OTP table exists
(async () => {
  try {
    // Best-effort: ensure core marketplace tables exist.
    // This keeps the API from crashing on fresh/partially initialized databases.
    {
      const tableColumnsCache = new Map();
      const getTableColumns = async (tableName) => {
        if (tableColumnsCache.has(tableName)) return tableColumnsCache.get(tableName);
        const res = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
          [tableName]
        );
        const cols = new Set((res.rows || []).map((row) => String(row.column_name || '').toLowerCase()));
        tableColumnsCache.set(tableName, cols);
        return cols;
      };

      const hasColumns = async (tableName, requiredColumns) => {
        const cols = await getTableColumns(tableName);
        return requiredColumns.every((name) => cols.has(String(name).toLowerCase()));
      };

      const safeQuery = async (label, sql) => {
        try {
          await pool.query(sql);
        } catch (e) {
          const code = String(e?.code || '');
          const isExpectedSchemaGap = code === '42703' || code === '42P01';
          if (isExpectedSchemaGap) {
            console.log(`â„¹ï¸ Core init note (${label}): ${e.message}`);
            return;
          }
          console.warn(`âš ï¸ Core init issue (${label}):`, e.message);
        }
      };

      await safeQuery(
        'users table',
        `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(130),
            first_name VARCHAR(40),
            middle_name VARCHAR(40),
            last_name VARCHAR(40),
            shop_name VARCHAR(40),
            phone VARCHAR(20),
            address TEXT,
            role VARCHAR(20) DEFAULT 'customer',
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
          )
        `
      );

      // Legacy users table compatibility (older schema used password_hash + user_type and had no username/password/role/address)
      await safeQuery('users.username column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50)');
      await safeQuery('users.password column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)');
      await safeQuery('users.role column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20)');
      await safeQuery('users.address column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT');
      await safeQuery('users.is_verified column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false');

      // Backfill new columns from legacy ones only when source columns exist.
      if (await hasColumns('users', ['password', 'password_hash'])) {
        await safeQuery('users.password backfill', "UPDATE users SET password = password_hash WHERE (password IS NULL OR password = '') AND password_hash IS NOT NULL");
      }
      if (await hasColumns('users', ['role', 'user_type'])) {
        await safeQuery('users.role backfill', "UPDATE users SET role = user_type WHERE (role IS NULL OR role = '') AND user_type IS NOT NULL");
      }
      await safeQuery('users.role default', "UPDATE users SET role = 'customer' WHERE role IS NULL OR role = ''");
      await safeQuery('users.role rename staff->admin', "UPDATE users SET role = 'admin' WHERE role = 'staff'");
      await safeQuery(
        'users.username backfill',
        "UPDATE users SET username = CONCAT(regexp_replace(split_part(email,'@',1),'[^a-zA-Z0-9_]', '_', 'g'), '_', id) WHERE username IS NULL OR username = ''"
      );

      await safeQuery('users.is_disabled column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false');
      await safeQuery('users.disabled_at column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP');
      await safeQuery('users.disabled_reason column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason TEXT');
      await safeQuery('users.customer_total_ratings column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_total_ratings INTEGER DEFAULT 0');
      await safeQuery('users.customer_average_rating column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_average_rating DECIMAL(3,2) DEFAULT 0');
      await safeQuery('users.is_debug_account column', 'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_debug_account BOOLEAN DEFAULT false');

      await safeQuery('users username unique index', 'CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)');

      await safeQuery(
        'categories table',
        `
          CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            type VARCHAR(50) DEFAULT 'agricultural',
            is_disabled BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );
      await safeQuery('categories unique index', 'CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories (name)');
      await safeQuery('categories name lower index', 'CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_unique ON categories (LOWER(name))');
      await safeQuery('categories.type column', "ALTER TABLE categories ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'agricultural'");
      await safeQuery('categories.is_disabled column', 'ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false');
      // NOTE: Auto-insert of default category disabled to prevent reappearing categories
      // after admin deletion. Categories should be managed manually through the admin panel.
      // await safeQuery(
      //   'default category',
      //   `
      //     INSERT INTO categories (name, description)
      //     VALUES ('Agricultural Products', 'Fresh vegetables, fruits, grains, and other farm products')
      //     ON CONFLICT (name) DO NOTHING
      //   `
      // );

      await safeQuery(
        'products table',
        `
          CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            category_id INTEGER REFERENCES categories(id),
            farmer_id INTEGER REFERENCES users(id),
            stock_quantity INTEGER DEFAULT 0,
            unit VARCHAR(20) DEFAULT 'kg',
            image_url VARCHAR(255),
            sales_count INTEGER DEFAULT 0,
            is_available BOOLEAN DEFAULT true,
            is_admin_disabled BOOLEAN DEFAULT false,
            admin_disabled_at TIMESTAMP,
            location VARCHAR(100),
            harvest_date DATE,
            expiry_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );

      await safeQuery('products.is_admin_disabled column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS is_admin_disabled BOOLEAN DEFAULT false');
      await safeQuery('products.admin_disabled_at column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS admin_disabled_at TIMESTAMP');

      await safeQuery('orders.is_disabled column', 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false');
      await safeQuery('orders.disabled_at column', 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP');

      await safeQuery(
        'customer_ratings table',
        `
          CREATE TABLE IF NOT EXISTS customer_ratings (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id),
            farmer_id INTEGER REFERENCES users(id),
            customer_id INTEGER REFERENCES users(id),
            rating INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (order_id, farmer_id)
          )
        `
      );

      // Legacy products table compatibility
      await safeQuery('products.image_url column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(255)');
      await safeQuery("products.unit column", "ALTER TABLE products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'kg'");
      await safeQuery('products.stock_quantity column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0');
      await safeQuery('products.sales_count column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0');
      await safeQuery('products.is_available column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true');
      await safeQuery('products.created_at column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      await safeQuery('products.updated_at column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      await safeQuery('products.location column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(100)');
      await safeQuery('products.harvest_date column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS harvest_date DATE');
      await safeQuery('products.expiry_date column', 'ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE');
      await safeQuery('products.status column', "ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'");

      await safeQuery(
        'cart table',
        `
          CREATE TABLE IF NOT EXISTS cart (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255),
            user_id INTEGER REFERENCES users(id),
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL DEFAULT 1,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );
      await safeQuery('cart.session_id column', 'ALTER TABLE cart ADD COLUMN IF NOT EXISTS session_id VARCHAR(255)');
      await safeQuery('cart.user_id column', 'ALTER TABLE cart ADD COLUMN IF NOT EXISTS user_id INTEGER');
      await safeQuery('cart.product_id column', 'ALTER TABLE cart ADD COLUMN IF NOT EXISTS product_id INTEGER');
      await safeQuery('cart.quantity column', 'ALTER TABLE cart ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1');
      await safeQuery('cart.added_at column', 'ALTER TABLE cart ADD COLUMN IF NOT EXISTS added_at TIMESTAMP');
      if (await hasColumns('cart', ['added_at'])) {
        const cartColumns = await getTableColumns('cart');
        const fallbackColumns = ['created_at', 'updated_at'].filter((name) => cartColumns.has(name));
        const coalesceArgs = ['added_at', ...fallbackColumns, 'CURRENT_TIMESTAMP'];
        await safeQuery('cart.added_at backfill', `UPDATE cart SET added_at = COALESCE(${coalesceArgs.join(', ')})`);
      }
      await safeQuery('cart.added_at default', 'ALTER TABLE cart ALTER COLUMN added_at SET DEFAULT CURRENT_TIMESTAMP');
      await safeQuery('cart unique (session_id, product_id)', 'CREATE UNIQUE INDEX IF NOT EXISTS cart_session_product_unique ON cart (session_id, product_id)');
      await safeQuery('cart unique (user_id, product_id)', 'CREATE UNIQUE INDEX IF NOT EXISTS cart_user_product_unique ON cart (user_id, product_id)');

      // Legacy DB compatibility: some older schemas use orders(customer_id, order_number, ...) + order_items.
      // The current backend expects per-item orders: orders(user_id, product_id, quantity, price, ...).
      // To avoid destructive changes, we rename the legacy table aside and create a fresh compatible `orders` table.
      try {
        const ordersCols = await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'"
        );
        const colSet = new Set((ordersCols.rows || []).map(r => String(r.column_name || '').toLowerCase()));
        const isLegacyOrders = colSet.has('customer_id') && colSet.has('order_number') && !colSet.has('user_id');

        if (isLegacyOrders) {
          const legacyTableName = `orders_legacy_${Date.now()}`;
          let legacySeqName = null;
          try {
            const seqRes = await pool.query("SELECT pg_get_serial_sequence('orders','id') as seq");
            legacySeqName = seqRes.rows?.[0]?.seq || null;
          } catch (_) {
            legacySeqName = null;
          }

          await safeQuery('rename legacy orders table', `ALTER TABLE orders RENAME TO ${legacyTableName}`);

          if (legacySeqName) {
            const legacySeqNewName = `${legacyTableName}_id_seq`;
            await safeQuery('rename legacy orders id sequence', `ALTER SEQUENCE ${legacySeqName} RENAME TO ${legacySeqNewName}`);
          }
        }
      } catch (_) {
        // ignore
      }

      await safeQuery(
        'orders table',
        `
          CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL DEFAULT 1,
            price DECIMAL(10, 2) NOT NULL,
            total_amount DECIMAL(10, 2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            is_disabled BOOLEAN DEFAULT false,
            disabled_at TIMESTAMP,
            payment_method VARCHAR(20) DEFAULT 'cash_on_delivery',
            delivery_address TEXT,
            delivery_date DATE,
            estimated_delivery_date DATE,
            cancelled_at TIMESTAMP,
            cancellation_reason TEXT,
            cancelled_by VARCHAR(20),
            replacement_order_id INTEGER,
            special_instructions TEXT,
            delivered_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );

      await safeQuery(
        'order_items table',
        `
          CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id),
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            delivered_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );

      await safeQuery(
        'reviews table',
        `
          CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id),
            user_id INTEGER REFERENCES users(id),
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );
      await safeQuery('reviews.product_id column', 'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS product_id INTEGER');
      await safeQuery('reviews.user_id column', 'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id INTEGER');
      await safeQuery('reviews.rating column', 'ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating INTEGER');
      await safeQuery('reviews unique (product_id, user_id)', 'CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_user_unique ON reviews (product_id, user_id)');

      await safeQuery(
        'wishlist table',
        `
          CREATE TABLE IF NOT EXISTS wishlist (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            product_id INTEGER REFERENCES products(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );
      await safeQuery('wishlist.user_id column', 'ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS user_id INTEGER');
      await safeQuery('wishlist.product_id column', 'ALTER TABLE wishlist ADD COLUMN IF NOT EXISTS product_id INTEGER');
      await safeQuery('wishlist unique (user_id, product_id)', 'CREATE UNIQUE INDEX IF NOT EXISTS wishlist_user_product_unique ON wishlist (user_id, product_id)');

      await safeQuery(
        'notifications table',
        `
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
          )
        `
      );
      await safeQuery('notifications.type column', 'ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50)');
      await safeQuery(
        'feature_flags table',
        `
          CREATE TABLE IF NOT EXISTS feature_flags (
            key         VARCHAR(100) PRIMARY KEY,
            name        VARCHAR(200) NOT NULL,
            description TEXT,
            enabled     BOOLEAN NOT NULL DEFAULT false,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      );
      await safeQuery(
        'feature_flags defaults',
        `
          INSERT INTO feature_flags (key, name, description, enabled)
          VALUES
            ('price_drop_alerts', 'Price Drop Alerts', 'Notify users when wishlist items drop in price', true),
            ('platform_announce', 'Platform Announcements', 'Show platform-wide announcements to all users', false),
            ('maintenance_mode', 'Maintenance Mode', 'When enabled, only super_admin can access the site', false),
            ('allow_registrations', 'Allow New Registrations', 'Allow customers and farmers to register new accounts', true)
          ON CONFLICT (key) DO NOTHING
        `
      );
      await safeQuery(
        'notifications.order_id foreign key repair',
        `
          DO $$
          DECLARE
            fk_name TEXT;
            ref_table TEXT;
          BEGIN
            SELECT c.conname, r.relname
            INTO fk_name, ref_table
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_class r ON r.oid = c.confrelid
            WHERE t.relname = 'notifications'
              AND c.contype = 'f'
              AND EXISTS (
                SELECT 1
                FROM unnest(c.conkey) AS colnum
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = colnum
                WHERE a.attname = 'order_id'
              )
            LIMIT 1;

            IF fk_name IS NOT NULL AND ref_table <> 'orders' THEN
              EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', fk_name);
            END IF;

            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint c
              JOIN pg_class t ON t.oid = c.conrelid
              JOIN pg_class r ON r.oid = c.confrelid
              WHERE t.relname = 'notifications'
                AND c.contype = 'f'
                AND r.relname = 'orders'
                AND EXISTS (
                  SELECT 1
                  FROM unnest(c.conkey) AS colnum
                  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = colnum
                  WHERE a.attname = 'order_id'
                )
            ) THEN
              ALTER TABLE notifications
                ADD CONSTRAINT notifications_order_id_fkey
                FOREIGN KEY (order_id) REFERENCES orders(id)
                ON DELETE SET NULL;
            END IF;
          END $$;
        `
      );

      await safeQuery(
        'user_addresses table',
        `
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
          )
        `
      );

      await safeQuery('idx_products_category', 'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
      await safeQuery('idx_products_farmer', 'CREATE INDEX IF NOT EXISTS idx_products_farmer ON products(farmer_id)');
      await safeQuery('idx_cart_session', 'CREATE INDEX IF NOT EXISTS idx_cart_session ON cart(session_id)');
      await safeQuery('idx_cart_user', 'CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)');
      await safeQuery('idx_orders_user', 'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)');
      await safeQuery('idx_orders_product', 'CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id)');
      await safeQuery('idx_orders_status', 'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
      await safeQuery('idx_orders_disabled', 'CREATE INDEX IF NOT EXISTS idx_orders_disabled ON orders(is_disabled)');
      await safeQuery('idx_order_items_order', 'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        purpose VARCHAR(50) NOT NULL DEFAULT 'login',
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_otps_email_purpose ON otps(email, purpose)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at)`);
    console.log('âœ… OTP table verified/created');

    // Ensure password reset OTP table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(100) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        attempts INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 1,
        last_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP,
        request_ip VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_user_created ON password_resets(user_id, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at)`);
    console.log('âœ… Password reset table verified/created');

    // Ensure chat tables exist (conversations/messages)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          conversation_id VARCHAR(255) UNIQUE NOT NULL,
          farmer_id INTEGER REFERENCES users(id),
          customer_id INTEGER REFERENCES users(id),
          last_message_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (farmer_id, customer_id)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          conversation_id VARCHAR(255),
          sender_id INTEGER REFERENCES users(id),
          receiver_id INTEGER REFERENCES users(id),
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT false,
          product_id INTEGER REFERENCES products(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id)`);
      console.log('âœ… Chat tables verified/created');
    } catch (e) {
      console.warn('âš ï¸ Chat tables check failed:', e.message);
    }
  } catch (error) {
    console.error('âš ï¸ OTP table creation check failed:', error.message);
  }
})();

// Test database connection
pool.connect((err, client, release) => {
  // #region agent log (only in development)
  sendIngest({location:'server.js:36',message:'Database connection test started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'});
  // #endregion

  if (err) {
    console.error('Error connecting to database:', err);
    // #region agent log (only in development)
    sendIngest({location:'server.js:37',message:'Database connection failed',data:{error:err.message,code:err.code},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'});
    // #endregion
  } else {
    console.log('Connected to PostgreSQL database');
    // #region agent log (only in development)
    sendIngest({location:'server.js:40',message:'Database connection successful',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'});
    // #endregion
    release();
  }
});

// Routes
// Rate limiters for sensitive endpoints
// Dynamic rate limiters that read from platform settings
// Settings are environment-aware (local vs production)
function createAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: async (req) => {
      const { getPlatformSetting } = require('./utils/db');
      const isDev = process.env.NODE_ENV === 'development';
      const key = isDev ? 'auth_rate_limit_local' : 'auth_rate_limit_production';
      const limit = await getPlatformSetting(key, isDev ? '100' : '20');
      const parsed = parseInt(limit, 10);
      return isNaN(parsed) || parsed === 0 ? (isDev ? 100 : 20) : parsed;
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    message: { error: 'Too many requests. Please try again later.' }
  });
}

function createOtpRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: async (req) => {
      const { getPlatformSetting } = require('./utils/db');
      const isDev = process.env.NODE_ENV === 'development';
      const key = isDev ? 'otp_rate_limit_local' : 'otp_rate_limit_production';
      const limit = await getPlatformSetting(key, isDev ? '50' : '10');
      const parsed = parseInt(limit, 10);
      return isNaN(parsed) || parsed === 0 ? (isDev ? 50 : 10) : parsed;
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    message: { error: 'Too many OTP requests. Please try again later.' }
  });
}

const authRateLimit = createAuthRateLimit();
const otpRateLimit = createOtpRateLimit();

// #region agent log
sendIngest({location:'server.js:47',message:'Loading routes',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
// #endregion

const mountRoute = ({ basePath, modulePath, label, middlewares = [], critical = false, afterMount = null }) => {
  try {
    const routeModule = require(modulePath);
    if (typeof routeModule.preload === 'function') {
      const diagnostics = routeModule.preload();
      console.log(`[startup] ${label} preload ok`, diagnostics);
    }
    app.use(basePath, ...middlewares, routeModule);
    console.log(`[startup] ${label} route mounted on ${basePath}`);
    if (typeof afterMount === 'function') {
      afterMount(routeModule);
    }
    return routeModule;
  } catch (error) {
    console.error(`[startup] ${label} route failed to mount on ${basePath}:`, error.message);
    if (error && error.stack) {
      console.error(error.stack);
    }
    if (critical) {
      throw error;
    }
    return null;
  }
};

try {
  app.use('/api/auth', authRateLimit, require('./routes/auth'));
  // #region agent log
  sendIngest({location:'server.js:49',message:'Auth route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:49',message:'Auth route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/otp', otpRateLimit, require('./routes/otp'));
  console.log('âœ… OTP route loaded successfully');
} catch (error) {
  console.error('âŒ OTP route failed to load:', error);
}

try {
  app.use('/api/products', require('./routes/products'));
  // #region agent log
  sendIngest({location:'server.js:51',message:'Products route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  console.error('❌ Products route failed to load:', error);
  // #region agent log
  sendIngest({location:'server.js:51',message:'Products route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/reviews', require('./routes/reviews'));
  // #region agent log
  sendIngest({location:'server.js:52',message:'Reviews route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:52',message:'Reviews route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/cart', require('./routes/cart'));
  // #region agent log
  sendIngest({location:'server.js:53',message:'Cart route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:53',message:'Cart route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/wishlist', require('./routes/wishlist'));
  // #region agent log
  sendIngest({location:'server.js:54',message:'Wishlist route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:54',message:'Wishlist route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/orders', require('./routes/orders'));
  // #region agent log
  sendIngest({location:'server.js:55',message:'Orders route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:55',message:'Orders route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/notifications', require('./routes/notifications'));
  // #region agent log
  sendIngest({location:'server.js:56',message:'Notifications route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:56',message:'Notifications route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/messages', require('./routes/messages'));
  // #region agent log
  sendIngest({location:'server.js:57',message:'Messages route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:57',message:'Messages route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/addresses', require('./routes/addresses'));
  // #region agent log
  sendIngest({location:'server.js:58',message:'Addresses route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:58',message:'Addresses route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/admin', require('./routes/admin'));
  require('./routes/admin').ensureCategoryAdminSchema().catch((e) => console.warn('âš ï¸ ensureCategoryAdminSchema failed:', e.message));
  // #region agent log
  sendIngest({location:'server.js:57',message:'Admin route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:57',message:'Admin route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/superadmin', require('./routes/superadmin'));
  console.log('âœ… Superadmin route loaded successfully');
} catch (error) {
  console.error('âŒ Superadmin route failed to load:', error.message);
}

try {
  app.use('/api/subscriptions', require('./routes/subscriptions'));
  console.log('âœ… Subscriptions route loaded successfully');
} catch (error) {
  console.error('âŒ Subscriptions route failed to load:', error.message);
}

try {
  app.use('/api/admin', require('./routes/payment-accounts'));
  console.log('âœ… Payment accounts route loaded successfully');
} catch (error) {
  console.error('âŒ Payment accounts route failed to load:', error.message);
}

try {
  app.use('/api/settings', require('./routes/settings'));
  console.log('âœ… Settings route loaded successfully');
} catch (error) {
  console.error('âŒ Settings route failed to load:', error.message);
}

mountRoute({
  basePath: '/api/psgc',
  modulePath: './routes/psgc',
  label: 'PSGC',
  critical: process.env.NODE_ENV === 'production'
});

try {
  app.use('/api/upload', require('./routes/upload'));
  // #region agent log
  sendIngest({location:'server.js:59',message:'Upload route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:59',message:'Upload route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/contact', require('./routes/contact'));
  // #region agent log
  sendIngest({location:'server.js:58',message:'Contact route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:58',message:'Contact route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/farmers', require('./routes/farmers'));
  // #region agent log
  sendIngest({location:'server.js:58',message:'Farmers route loaded successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
} catch (error) {
  // #region agent log
  sendIngest({location:'server.js:58',message:'Farmers route failed to load',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'B'});
  // #endregion
}

try {
  app.use('/api/support-tickets', supportTicketsRouter);
  console.log('✓ Support tickets route loaded successfully');
} catch (error) {
  console.error('❌ Support tickets route failed to load:', error);
}

// Test database connection route
app.get('/api/test-db', async (req, res) => {
  try {
    const now = await pool.query('SELECT NOW() as now');
    const usersTable = await pool.query("SELECT to_regclass('public.users') as users_table");

    let userCount = null;
    let sampleUsers = [];

    if (usersTable.rows?.[0]?.users_table) {
      const result = await pool.query('SELECT COUNT(*)::int as user_count FROM users');
      userCount = result.rows[0].user_count;
      const users = await pool.query('SELECT * FROM users LIMIT 3');
      sampleUsers = users.rows;
    }

    res.json({
      status: 'âœ… Database Connected Successfully!',
      now: now.rows[0].now,
      user_count: userCount,
      sample_users: sampleUsers,
      message: 'Backend can reach PostgreSQL.'
    });
  } catch (error) {
    res.status(500).json({
      status: 'âŒ Database Connection Failed',
      error: error.message,
      message: 'Check your PostgreSQL connection and .env file'
    });
  }
});

// Server-Sent Events (SSE) endpoint for real-time updates
// Note: EventSource cannot send Authorization headers reliably, so we accept token via query param.
// For public users (landing page), token is optional - they only receive product updates.
app.get('/api/events', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    let decoded = null;

    if (token) {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id !== -1) {
        const result = await pool.query('SELECT is_disabled FROM users WHERE id = $1', [decoded.id]);
        if (result.rows.length && result.rows[0].is_disabled) {
          return res.status(403).end();
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    res.write('retry: 3000\n\n');
    addSseClient(res, decoded);

    // Initial handshake event
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ user_id: decoded?.id || null, is_public: !decoded })}\n\n`);

    // Heartbeat (keeps proxies from closing the stream)
    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch (_) {
        clearInterval(heartbeat);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  } catch (err) {
    res.status(401).end();
  }
});

// Server time endpoint for accurate time display
app.get('/api/time', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Manila',
    unix: Date.now()
  });
});

// Serve specific HTML pages BEFORE static middleware
// This ensures these routes take precedence
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

app.get('/farmer.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'farmer.html'));
});

app.get('/orders.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'orders.html'));
});

app.get('/clear_cache.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'clear_cache.html'));
});

app.get('/clear_ui_orders.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'clear_ui_orders.html'));
});

// Serve static files
// #region agent log
sendIngest({location:'server.js:148',message:'Setting up static file serving',data:{path:'../public'},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'C'});
// #endregion
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  maxAge: 0,
  etag: false,
  fallthrough: true,
  setHeaders: (res, path) => {
    if (path.endsWith('admin.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    }
  }
}));

// Additional CORS headers (backup - main CORS is handled above)
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // If no origin (server-to-server or same-origin), allow by default
  if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (process.env.NODE_ENV !== 'production') {
    // Development: echo origin
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes(origin)) {
    // Production: only allow explicit origins
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Do not set CORS header for disallowed origins; client will see CORS error
    console.warn('Blocked CORS request from origin:', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Root route
app.get('/', (req, res) => {
  const fs = require('fs');
  const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>AgriCatch</title></head>
      <body>
        <h1>Welcome to AgriCatch! ðŸ›’</h1>
        <p>Your website is almost ready!</p>
        <p>Server is running on port 3000.</p>
        <p>Frontend file path: ${indexPath}</p>
        <h2>Available Features:</h2>
        <ul>
          <li>âœ… Browse Agricultural Products (Vegetables, Fruits, Grains)</li>
          <li>âœ… Guest shopping cart</li>
          <li>âœ… User registration and login</li>
          <li>âœ… Cash on delivery payment</li>
        </ul>
        <h2>Test Accounts:</h2>
        <ul>
          <li>Email: juan@farm.ph | Password: password123 (Farmer)</li>
        </ul>
        <p><strong>Note:</strong> If you see this page, the frontend file couldn't be found. Please check the file path.</p>
      </body>
      </html>
    `);
  }
});

// 404 error page handler for unmatched routes
app.use((req, res) => {
  const fs = require('fs');
  const errorPath = path.join(__dirname, '..', 'frontend', '404.html');

  if (fs.existsSync(errorPath)) {
    res.status(404).sendFile(errorPath);
  } else {
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head><title>404 - Page Not Found | AgriCatch</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="font-size: 80px; color: #4154f1; margin: 0;">404</h1>
        <h2 style="color: #012970;">The page you are looking for doesn't exist.</h2>
        <a href="/" style="display: inline-block; margin-top: 20px; padding: 12px 30px; background: #4154f1; color: white; text-decoration: none; border-radius: 50px;">Back to Home</a>
      </body>
      </html>
    `);
  }
});

// Start server
// #region agent log
sendIngest({location:'server.js:210',message:'Starting server',data:{port:PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D'});
// #endregion

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // #region agent log
  sendIngest({location:'server.js:212',message:'Server started successfully',data:{port:PORT},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'D'});
  // #endregion
});

// Self-ping to prevent Render free tier from sleeping (configurable interval)
if (process.env.RENDER === 'true' || process.env.RENDER_EXTERNAL_URL) {
  const https = require('https');
  const url = process.env.RENDER_EXTERNAL_URL || 'https://api.agricatch.store';

  // Allow configuring the ping interval via env vars (minutes)
  const minMinutes = Number.parseInt(process.env.SELF_PING_MIN_MINUTES || process.env.SELF_PING_MINUTES || '1', 10) || 1;
  const maxMinutes = Number.parseInt(process.env.SELF_PING_MAX_MINUTES || process.env.SELF_PING_MINUTES || '13', 10) || minMinutes;

  function schedulePing() {
    // Compute random interval between minMinutes and maxMinutes (in ms)
    const min = Math.max(0, minMinutes) * 60 * 1000;
    const max = Math.max(min, maxMinutes) * 60 * 1000;
    const interval = Math.floor(Math.random() * (max - min + 1)) + min;

    console.log(`[Self-ping] Scheduling next ping in ${(interval/1000/60).toFixed(2)} minutes to ${url}/api/test-db`);

    setTimeout(() => {
      https.get(url + '/api/test-db', (res) => {
        console.log(`[Self-ping] Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('[Self-ping] Error:', err.message);
      });
      schedulePing();
    }, interval);
  }

  schedulePing();
}

module.exports = app;