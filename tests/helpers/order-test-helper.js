/**
 * Order Test Helper — Shared utilities for order management Playwright tests
 *
 * Provides:
 * - API calls (createOrder, cancelOrder, updateStatus, setDeliveryDate, etc.)
 * - DB queries (getProductStock, getReservedQty, getOrderStatus, etc.)
 * - Auth helpers (reuse auth-helper.js, add loginAsCustomer)
 * - Test data factories (findAvailableProduct, findPreorderProduct, etc.)
 */

const path = require('path');
const fs = require('fs');

module.paths.unshift(path.join(__dirname, '..', '..', 'backend', 'node_modules'));

const { Pool } = require('pg');
const { getFarmerToken, getCustomerToken, getAdminToken } = require('../auth-helper');

const API_BASE = 'http://localhost:3000/api';

// ---------------------------------------------------------------------------
// DB Connection (singleton per test run)
// ---------------------------------------------------------------------------
let _pool = null;

function getPool() {
  if (_pool) return _pool;
  const envPath = path.join(__dirname, '..', '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found at ' + envPath);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
  _pool = new Pool({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432'),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  return _pool;
}

async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// ---------------------------------------------------------------------------
// Auth Helpers
// ---------------------------------------------------------------------------

async function loginAsCustomer(page) {
  const { token } = await getCustomerToken();
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.reload();
}

// Auth functions are exported in the final module.exports object below

// ---------------------------------------------------------------------------
// API Helpers — all return { status, body } objects
// ---------------------------------------------------------------------------

async function apiCreateOrder(token, payload) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiGetOrders(token) {
  const res = await fetch(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiGetFarmerOrders(token, farmerId) {
  const res = await fetch(`${API_BASE}/orders/farmer/${farmerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiUpdateOrderStatus(token, orderId, status) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/items/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiUpdateOrderStatusAlt(token, orderId, status) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiCancelOrderCustomer(token, orderId, reason) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason: reason || 'Test cancellation' }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiCancelOrderFarmer(token, orderId, reason) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/cancel-farmer`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reason: reason || 'Test cancellation by farmer' }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiSetDeliveryDate(token, orderId, deliveryDate, rescheduleReason) {
  const payload = { delivery_date: deliveryDate };
  if (rescheduleReason) payload.reschedule_reason = rescheduleReason;
  const res = await fetch(`${API_BASE}/orders/${orderId}/delivery-date`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiConvertPreorders(token, productId, harvestQuantity) {
  const res = await fetch(`${API_BASE}/products/${productId}/convert-preorders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ harvest_quantity: harvestQuantity }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiHarvestLifecycle(token, productId, harvestQuantity, makeAvailable) {
  const res = await fetch(`${API_BASE}/products/${productId}/harvest-lifecycle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      harvest_quantity: harvestQuantity,
      make_available: makeAvailable,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiAddToCart(token, productId, quantity) {
  const res = await fetch(`${API_BASE}/cart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productId, quantity: quantity || 1 }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiGetCart(token) {
  const res = await fetch(`${API_BASE}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiClearCart(token) {
  const res = await fetch(`${API_BASE}/cart`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// DB Query Helpers
// ---------------------------------------------------------------------------

async function dbGetOrder(orderId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT o.*, p.farmer_id, p.name as product_name, p.stock_quantity, p.reserved_quantity,
            p.is_preorder, p.max_preorder_quantity
     FROM orders o
     JOIN products p ON o.product_id = p.id
     WHERE o.id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

async function dbGetOrderStatus(orderId) {
  const pool = getPool();
  const result = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
  return result.rows[0]?.status || null;
}

async function dbGetProduct(productId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, stock_quantity, reserved_quantity, is_preorder, is_available,
            max_preorder_quantity, farmer_id, sales_count,
            COALESCE(is_admin_disabled, false) as is_admin_disabled
     FROM products WHERE id = $1`,
    [productId]
  );
  return result.rows[0] || null;
}

async function dbGetProductStock(productId) {
  const pool = getPool();
  const result = await pool.query('SELECT stock_quantity FROM products WHERE id = $1', [productId]);
  return result.rows[0]?.stock_quantity ?? null;
}

async function dbGetReservedQty(productId) {
  const pool = getPool();
  const result = await pool.query('SELECT reserved_quantity FROM products WHERE id = $1', [productId]);
  return result.rows[0]?.reserved_quantity ?? null;
}

async function dbGetOrderByStatusAndUser(status, userId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, product_id, quantity, status, is_preorder, total_amount
     FROM orders
     WHERE status = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [status, userId]
  );
  return result.rows[0] || null;
}

async function dbUpdateOrderStatus(orderId, status) {
  const pool = getPool();
  await pool.query(
    `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [status, orderId]
  );
}

async function dbRestoreOrder(orderId, status, productId, stockQty, reservedQty) {
  const pool = getPool();
  await pool.query('BEGIN');
  try {
    await pool.query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP,
              cancelled_at = NULL, cancelled_by = NULL, cancellation_reason = NULL
       WHERE id = $2`,
      [status, orderId]
    );
    if (stockQty !== null && stockQty !== undefined) {
      await pool.query('UPDATE products SET stock_quantity = $1 WHERE id = $2', [stockQty, productId]);
    }
    if (reservedQty !== null && reservedQty !== undefined) {
      await pool.query('UPDATE products SET reserved_quantity = $1 WHERE id = $2', [reservedQty, productId]);
    }
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

/**
 * Find an available (non-preorder) product with stock > 0 that belongs to the given farmer.
 */
async function findAvailableProduct(farmerId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, stock_quantity, price, farmer_id, unit
     FROM products
     WHERE is_preorder = false
       AND is_available = true
       AND COALESCE(is_admin_disabled, false) = false
       AND stock_quantity > 0
       AND farmer_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [farmerId]
  );
  return result.rows[0] || null;
}

/**
 * Find any available product with stock > 0 (any farmer).
 */
async function findAnyAvailableProduct() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, stock_quantity, price, farmer_id, unit
     FROM products
     WHERE is_preorder = false
       AND is_available = true
       AND COALESCE(is_admin_disabled, false) = false
       AND stock_quantity > 0
     ORDER BY id DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Find a pre-order product that belongs to the given farmer.
 */
async function findPreorderProduct(farmerId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, stock_quantity, reserved_quantity, price, farmer_id, unit,
            max_preorder_quantity, preorder_availability_date
     FROM products
     WHERE is_preorder = true
       AND is_available = true
       AND COALESCE(is_admin_disabled, false) = false
       AND farmer_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [farmerId]
  );
  return result.rows[0] || null;
}

/**
 * Find any pre-order product (any farmer).
 */
async function findAnyPreorderProduct() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, name, stock_quantity, reserved_quantity, price, farmer_id, unit,
            max_preorder_quantity
     FROM products
     WHERE is_preorder = true
       AND is_available = true
       AND COALESCE(is_admin_disabled, false) = false
     ORDER BY id DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Find a customer user.
 */
async function findCustomerUser() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, email, role FROM users WHERE role = 'customer' LIMIT 1`
  );
  return result.rows[0] || null;
}

/**
 * Find a pending order for a specific customer.
 */
async function findPendingOrderForCustomer(customerId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, product_id, quantity, status, is_preorder, total_amount
     FROM orders
     WHERE status = 'pending' AND user_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [customerId]
  );
  return result.rows[0] || null;
}

/**
 * Find a preorder_reserved order for a specific customer.
 */
async function findPreorderReservedOrderForCustomer(customerId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, product_id, quantity, status, is_preorder, total_amount
     FROM orders
     WHERE status = 'preorder_reserved' AND user_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [customerId]
  );
  return result.rows[0] || null;
}

/**
 * Find an order in a specific status for a specific farmer's products.
 */
async function findOrderByStatusForFarmer(status, farmerId) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT o.id, o.product_id, o.quantity, o.status, o.is_preorder, o.total_amount,
            o.preorder_converted_at, o.preorder_fulfilled_quantity, o.preorder_reserved_quantity
     FROM orders o
     JOIN products p ON o.product_id = p.id
     WHERE o.status = $1 AND p.farmer_id = $2
     ORDER BY o.created_at DESC LIMIT 1`,
    [status, farmerId]
  );
  return result.rows[0] || null;
}

/**
 * Find any order in a specific status (any farmer).
 */
async function findOrderByStatus(status) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT o.id, o.product_id, o.quantity, o.status, o.is_preorder, o.total_amount,
            o.user_id, p.farmer_id
     FROM orders o
     JOIN products p ON o.product_id = p.id
     WHERE o.status = $1
     ORDER BY o.created_at DESC LIMIT 1`,
    [status]
  );
  return result.rows[0] || null;
}

/**
 * Get tomorrow's date as YYYY-MM-DD string.
 */
function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Get yesterday's date as YYYY-MM-DD string.
 */
function getYesterdayDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Get date N days from now as YYYY-MM-DD string.
 */
function getFutureDate(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Checkout payload factory
// ---------------------------------------------------------------------------

function buildCheckoutPayload(opts = {}) {
  return {
    recipient_firstname: opts.firstname || 'Test',
    recipient_middlename: opts.middlename || null,
    recipient_lastname: opts.lastname || 'Customer',
    recipient_phone: opts.phone || '9123456789',
    delivery_address: opts.address || 'Trabajo Market, M. Dela Fuente St., Sampaloc, Manila, Metro Manila',
    special_instructions: opts.instructions || null,
    delivery_date: null,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Auth (re-exported from auth-helper + local)
  getFarmerToken,
  getCustomerToken,
  getAdminToken,
  loginAsCustomer,
  loginAsFarmer: require('../auth-helper').loginAsFarmer,
  loginAsAdmin: require('../auth-helper').loginAsAdmin,
  // DB
  getPool,
  closePool,
  dbGetOrder,
  dbGetOrderStatus,
  dbGetProduct,
  dbGetProductStock,
  dbGetReservedQty,
  dbGetOrderByStatusAndUser,
  dbUpdateOrderStatus,
  dbRestoreOrder,
  // API
  apiCreateOrder,
  apiGetOrders,
  apiGetFarmerOrders,
  apiUpdateOrderStatus,
  apiUpdateOrderStatusAlt,
  apiCancelOrderCustomer,
  apiCancelOrderFarmer,
  apiSetDeliveryDate,
  apiConvertPreorders,
  apiHarvestLifecycle,
  apiAddToCart,
  apiGetCart,
  apiClearCart,
  // Factories
  findAvailableProduct,
  findAnyAvailableProduct,
  findPreorderProduct,
  findAnyPreorderProduct,
  findCustomerUser,
  findPendingOrderForCustomer,
  findPreorderReservedOrderForCustomer,
  findOrderByStatusForFarmer,
  findOrderByStatus,
  // Date utils
  getTomorrowDate,
  getYesterdayDate,
  getFutureDate,
  // Payload factory
  buildCheckoutPayload,
  // Constants
  API_BASE,
};
