const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../utils/db');

const requiredTables = [
  'users',
  'categories',
  'products',
  'cart',
  'orders',
  'order_items',
  'reviews',
  'wishlist',
  'notifications',
  'user_addresses',
  'otps',
  'password_resets',
  'conversations',
  'messages'
];

const featureTables = [
  'admin_audit_logs',
  'product_name_catalog',
  'product_name_requests',
  'refunds'
];

const requiredColumns = {
  users: ['id', 'email', 'username', 'password', 'role', 'is_verified', 'created_at'],
  products: ['id', 'name', 'price', 'farmer_id', 'category_id', 'stock_quantity', 'is_available'],
  cart: ['id', 'product_id', 'quantity', 'added_at'],
  orders: ['id', 'user_id', 'product_id', 'quantity', 'price', 'total_amount', 'status', 'created_at'],
  order_items: ['id', 'order_id', 'product_id', 'quantity', 'price', 'status'],
  notifications: ['id', 'user_id', 'message', 'is_read', 'created_at'],
  user_addresses: ['id', 'user_id', 'address_line1', 'is_default', 'created_at'],
  otps: ['id', 'email', 'otp_code', 'purpose', 'expires_at', 'is_used'],
  password_resets: ['id', 'user_id', 'email', 'otp_hash', 'expires_at', 'used'],
  messages: ['id', 'conversation_id', 'sender_id', 'receiver_id', 'message', 'created_at'],
  conversations: ['id', 'conversation_id', 'farmer_id', 'customer_id', 'created_at']
};

async function getTableColumns(tableName) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [tableName]
  );
  return new Set((res.rows || []).map((r) => String(r.column_name || '').toLowerCase()));
}

(async () => {
  try {
    const tableRes = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    const existingTables = new Set((tableRes.rows || []).map((r) => String(r.table_name || '').toLowerCase()));

    const missingRequiredTables = requiredTables.filter((t) => !existingTables.has(t));
    const missingFeatureTables = featureTables.filter((t) => !existingTables.has(t));

    const missingColumns = {};
    for (const [tableName, cols] of Object.entries(requiredColumns)) {
      if (!existingTables.has(tableName)) continue;
      const existingCols = await getTableColumns(tableName);
      const missing = cols.filter((c) => !existingCols.has(c));
      if (missing.length) missingColumns[tableName] = missing;
    }

    console.log('=== DB SCHEMA AUDIT ===');
    console.log('Required tables missing:', missingRequiredTables.length ? missingRequiredTables.join(', ') : 'none');
    console.log('Feature tables missing:', missingFeatureTables.length ? missingFeatureTables.join(', ') : 'none');

    const tablesWithMissingCols = Object.keys(missingColumns);
    if (!tablesWithMissingCols.length) {
      console.log('Required columns missing: none');
    } else {
      console.log('Required columns missing:');
      for (const tableName of tablesWithMissingCols) {
        console.log(`- ${tableName}: ${missingColumns[tableName].join(', ')}`);
      }
    }

    if (!missingRequiredTables.length && !tablesWithMissingCols.length) {
      console.log('RESULT: Core schema looks ready for app routes.');
    } else {
      console.log('RESULT: Core schema has gaps that may break routes.');
    }
  } catch (error) {
    console.error('Schema audit failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
