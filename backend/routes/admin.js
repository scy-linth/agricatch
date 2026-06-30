const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { writeAdminAuditLog, ensureAuditTable } = require('../utils/auditLog');
const adminCache = require('../utils/adminCache');
const { broadcastEvent } = require('../utils/realtime');
const requireRole = require('../middleware/requireRole');
const { productUpload } = require('../middleware/upload');
const { deleteFileIfExists } = require('../utils/fileUtils');
const { pool } = require('../utils/db');
const cloudinary = require('../utils/cloudinary');
const { sendVerificationEmail, sendUnverificationEmail, sendPremiumUpgradeEmail, sendPremiumExpiredEmail } = require('../utils/emailService');
const activityLogger = require('../services/activityLogger');
const { restoreInventoryOnCancel, updateStatisticsOnDeliver, getOrderForBusinessLogic } = require('../utils/orderBusinessLogic');
const { getValidStatuses } = require('../utils/orderTransitions');

const router = express.Router();

const MAX_NUMERIC_VALUE = 99999;

function validateBoundedNumber(value, fieldName, { min = 0, max = MAX_NUMERIC_VALUE } = {}) {
  if (typeof value === 'undefined' || value === null || String(value).trim() === '') return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { error: `${fieldName} must be a valid number` };
  }
  if (num < min) {
    return { error: `${fieldName} must be ${min} or higher` };
  }
  if (num > max) {
    return { error: `${fieldName} must not exceed ${max}` };
  }
  return undefined;
}

const extractCloudinaryPublicId = (url) => {
  if (!url) return null;
  const value = String(url).trim();
  const match = value.match(
    /^https:\/\/res\.cloudinary\.com\/[^\/]+\/(?:image|video)\/upload\/(?:[^\/]+\/)*?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/
  );
  return match && match[1] ? match[1] : null;
};

const loadCategoryNameById = async (categoryId) => {
  const id = Number.parseInt(categoryId, 10);
  if (!Number.isFinite(id) || id <= 0) return 'uncategorized';
  const result = await pool.query('SELECT name FROM categories WHERE id = $1 LIMIT 1', [id]);
  return String(result.rows?.[0]?.name || 'uncategorized').trim() || 'uncategorized';
};

const rehomeProductImageToCategorizedId = async ({ categoryName, productName, productId, imagePublicId, imageUrl }) => {
  const sourcePublicId = imagePublicId || extractCloudinaryPublicId(imageUrl);
  if (!sourcePublicId) {
    return { imagePublicId, imageUrl, changed: false };
  }

  const targetPublicId = `agricatch/${cloudinary.slugify(categoryName || 'uncategorized')}/${cloudinary.slugify(productName || 'product')}/${productId}.jpeg`;
  if (sourcePublicId === targetPublicId) {
    return { imagePublicId: sourcePublicId, imageUrl, changed: false };
  }

  try {
    const renamed = await cloudinary.uploader.rename(sourcePublicId, targetPublicId, {
      resource_type: 'image',
      overwrite: true,
      invalidate: true
    });
    return {
      imagePublicId: renamed.public_id || targetPublicId,
      imageUrl: renamed.secure_url || cloudinary.url(targetPublicId, { secure: true }) || imageUrl,
      changed: true
    };
  } catch (err) {
    const message = String(err && (err.message || err));
    const isMissingSource = /not found|404/i.test(message);
    if (isMissingSource) {
      try {
        const existing = await cloudinary.api.resource(targetPublicId, { resource_type: 'image' });
        return {
          imagePublicId: targetPublicId,
          imageUrl: existing.secure_url || cloudinary.url(targetPublicId, { secure: true }) || imageUrl,
          changed: imagePublicId !== targetPublicId
        };
      } catch (_) {
        // Fall through and keep existing DB values if neither source nor target is available.
      }
    }
    console.warn('Failed to rehome admin-updated product image:', sourcePublicId, '->', targetPublicId, message);
    return { imagePublicId: sourcePublicId, imageUrl, changed: false };
  }
};

const normalizeCategoryName = (value) => String(value || '').trim();
const normalizeCategoryKey = (value) => normalizeCategoryName(value).toLowerCase();

const tableColumnsCache = new Map(); // { key -> { cols: Set, expiry: number } }

const getTableColumns = async (tableName) => {
  const key = String(tableName || '').trim().toLowerCase();
  if (!key) return new Set();
  const cached = tableColumnsCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.cols;
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [key]
  );
  const cols = new Set((res.rows || []).map((row) => String(row.column_name || '').toLowerCase()));
  tableColumnsCache.set(key, { cols, expiry: Date.now() + 5 * 60 * 1000 });
  return cols;
};

const insertNotification = async (client, { userId, type, title, message, orderId = null, productId = null }) => {
  try {
    const cols = await getTableColumns('notifications');
    if (!cols.has('user_id')) return;

    const fields = [];
    const values = [];
    const push = (name, value) => {
      if (!cols.has(name)) return;
      fields.push(name);
      values.push(value);
    };

    push('user_id', userId);
    push('type', type);
    push('title', title);
    push('message', message);
    push('order_id', orderId);
    push('product_id', productId);

    if (!fields.length) return;
    const placeholders = fields.map((_, idx) => `$${idx + 1}`).join(', ');
    await client.query(
      `INSERT INTO notifications (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
  } catch (err) {
    console.warn('Admin notification insert skipped:', err?.message || err);
  }
};

const updateUserDisabledFields = async (client, userId, reason, isDisabled, disableType = null) => {
  const cols = await getTableColumns('users');
  const sets = [];
  const values = [];

  if (cols.has('is_disabled')) {
    values.push(!!isDisabled);
    sets.push(`is_disabled = $${values.length}`);
  }
  if (cols.has('disabled_at')) {
    sets.push(isDisabled ? 'disabled_at = CURRENT_TIMESTAMP' : 'disabled_at = NULL');
  }
  if (cols.has('disabled_reason')) {
    if (isDisabled) {
      values.push(reason || null);
      sets.push(`disabled_reason = $${values.length}`);
    } else {
      sets.push('disabled_reason = NULL');
    }
  }
  if (cols.has('disable_type')) {
    if (isDisabled && disableType) {
      values.push(disableType);
      sets.push(`disable_type = $${values.length}`);
    } else if (!isDisabled) {
      sets.push('disable_type = NULL');
    }
  }

  if (!sets.length) {
    throw new Error('Users table missing disable/enable columns');
  }

  values.push(userId);
  await client.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`,
    values
  );
};

let _categorySchemaEnsured = false;
const ensureCategoryAdminSchema = async () => {
  if (_categorySchemaEnsured) return;
  await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS type VARCHAR(50)`);
  await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_name_catalog (
      id SERIAL PRIMARY KEY,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      name VARCHAR(120) UNIQUE NOT NULL,
      source VARCHAR(30) DEFAULT 'system',
      is_approved BOOLEAN DEFAULT true,
      requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE product_name_catalog ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_name_requests (
      id SERIAL PRIMARY KEY,
      category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
      requested_category_name VARCHAR(120),
      name VARCHAR(120) NOT NULL,
      notes TEXT,
      requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'pending',
      review_notes TEXT,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE product_name_requests ADD COLUMN IF NOT EXISTS requested_category_name VARCHAR(120)`);
  _categorySchemaEnsured = true;
};

const requireAdmin = requireRole('admin', 'super_admin');

const buildDisplayName = ({ firstName, middleName, lastName, fullName, fallback }) => {
  const parts = [firstName, middleName, lastName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' ');
  return String(fullName || '').trim() || String(fallback || '').trim();
};

const normalizeManagedUserPayload = (body = {}) => {
  const firstName = String(body.first_name || '').trim();
  const middleName = String(body.middle_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  const fullName = String(body.full_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const role = String(body.role || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();
  const shopName = String(body.shop_name || '').trim();
  
  // Validate phone number format
  if (phone) {
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
      throw new Error('Phone number must be 10 digits starting with 9');
    }
  }
  
  const displayName = buildDisplayName({
    firstName,
    middleName,
    lastName,
    fullName,
    fallback: username || email
  });

  return {
    firstName,
    middleName,
    lastName,
    fullName,
    displayName,
    email,
    username,
    password,
    role,
    phone,
    address,
    shopName
  };
};

const CANCELLED_STATUSES = ['delivered', 'cancelled'];

const cancelOrdersForProducts = async (client, productIds, reason) => {
  if (!productIds || productIds.length === 0) return [];

  const cancelled = await client.query(
    `
      UPDATE orders
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by = 'admin',
          cancellation_reason = $2
      WHERE product_id = ANY($1)
        AND status NOT IN ('delivered', 'cancelled')
      RETURNING id, product_id, quantity, user_id AS customer_id, is_preorder, preorder_converted_at, preorder_fulfilled_quantity, preorder_reserved_quantity
    `,
    [productIds, reason]
  );

  const rows = cancelled.rows || [];
  for (const row of rows) {
    // Use unified business logic for inventory restoration
    await restoreInventoryOnCancel(client, row);
    
    const message = `Order #${row.id} was cancelled because the product was disabled by admin. Reason: ${reason}`;
    await insertNotification(client, {
      userId: row.customer_id,
      type: 'order_update',
      title: 'Order cancelled',
      message,
      orderId: row.id,
      productId: row.product_id
    });
    broadcastEvent('notification.created', { user_id: row.customer_id });
  }

  return rows;
};

const cancelOrdersForFarmer = async (client, farmerId, reason) => {
  const cancelled = await client.query(
    `
      UPDATE orders o
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by = 'admin',
          cancellation_reason = $2
      FROM products p
      WHERE o.product_id = p.id
        AND p.farmer_id = $1
        AND o.status NOT IN ('delivered', 'cancelled')
      RETURNING o.id, o.product_id, o.quantity, o.user_id AS customer_id, o.is_preorder, o.preorder_converted_at, o.preorder_fulfilled_quantity, o.preorder_reserved_quantity
    `,
    [farmerId, reason]
  );

  const rows = cancelled.rows || [];
  for (const row of rows) {
    // Use unified business logic for inventory restoration
    await restoreInventoryOnCancel(client, row);
    
    const message = `Order #${row.id} was cancelled because the farmer account was disabled.`;
    await insertNotification(client, {
      userId: row.customer_id,
      type: 'order_update',
      title: 'Order cancelled',
      message,
      orderId: row.id,
      productId: row.product_id
    });
    broadcastEvent('notification.created', { user_id: row.customer_id });
  }

  return rows;
};

const cancelOrdersForCustomer = async (client, customerId, reason) => {
  const cancelled = await client.query(
    `
      UPDATE orders o
      SET status = 'cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by = 'admin',
          cancellation_reason = $2
      FROM products p
      WHERE o.product_id = p.id
        AND o.user_id = $1
        AND o.status NOT IN ('delivered', 'cancelled')
      RETURNING o.id, o.product_id, o.quantity, p.farmer_id, o.is_preorder, o.preorder_converted_at, o.preorder_fulfilled_quantity, o.preorder_reserved_quantity
    `,
    [customerId, reason]
  );

  const rows = cancelled.rows || [];
  for (const row of rows) {
    // Use unified business logic for inventory restoration
    await restoreInventoryOnCancel(client, row);
    
    const farmerMessage = `Order #${row.id} was cancelled because the customer account was disabled.`;
    await insertNotification(client, {
      userId: row.farmer_id,
      type: 'order_update',
      title: 'Order cancelled',
      message: farmerMessage,
      orderId: row.id,
      productId: row.product_id
    });
    broadcastEvent('notification.created', { user_id: row.farmer_id });
  }

  return rows;
};

const disableUserHandler = async (req, res, reasonOverride = null) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (!userId && userId !== 0) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot disable your own account' });
    }

    const userResult = await pool.query('SELECT id, role, is_disabled FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.rows[0];
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot disable super admin account' });
    }
    if (targetUser.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot disable another admin account' });
    }

    if (targetUser.is_disabled) {
      return res.json({ message: 'User already disabled' });
    }

    const reason = String(reasonOverride || req.body?.reason || 'Account disabled by admin').trim();
    const disableType = String(req.body?.disable_type || 'suspended').trim();

    const client = await pool.connect();
    let cancelledOrders = [];
    try {
      await client.query('BEGIN');

      await updateUserDisabledFields(client, userId, reason, true, disableType);

      await insertNotification(client, {
        userId,
        type: 'account_disabled',
        title: 'Account disabled',
        message: reason
      });
      broadcastEvent('notification.created', { user_id: userId });

      if (targetUser.role === 'farmer') {
        await client.query(
          'UPDATE products SET is_admin_disabled = true, admin_disabled_at = CURRENT_TIMESTAMP WHERE farmer_id = $1',
          [userId]
        );
        cancelledOrders = await cancelOrdersForFarmer(client, userId, reason);
        
        // Send notification about bulk product disable
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
          [userId, 'products_disabled', 'Products Disabled', 'All your products have been disabled by admin. Reason: ' + reason]
        );
      } else if (targetUser.role === 'customer') {
        cancelledOrders = await cancelOrdersForCustomer(client, userId, reason);
      }

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      throw error;
    } finally {
      client.release();
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.disable',
      entity: 'users',
      entity_id: userId,
      before: userResult.rows[0],
      after: { id: userId, is_disabled: true },
      req
    });
    // Log to activity logger (async, non-blocking)
    activityLogger.logSecurityEvent(
      req.user.id,
      req.user.role,
      req.sessionID,
      'user_disabled',
      'User account disabled by admin',
      { userId, email: userResult.rows[0]?.email },
      req.ip,
      req.headers['user-agent'],
      null,
      req.headers['referer'] || req.originalUrl
    );
    broadcastEvent('admin.audit', { action: 'user.disable', entity: 'users', entity_id: userId, actor_admin_id: req.user.id });

    for (const order of cancelledOrders) {
      broadcastEvent('order.updated', {
        order_id: Number(order.id),
        new_status: 'cancelled'
      });
    }

    return res.json({ message: 'User disabled', cancelled_orders: cancelledOrders.length });
  } catch (error) {
    console.error('Disable user error:', error);
    return res.status(500).json({ message: 'Server error disabling user' });
  }
};

const enableUserHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (!userId && userId !== 0) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const userResult = await pool.query('SELECT id, role, is_disabled FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.rows[0];
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot enable super admin account' });
    }
    if (targetUser.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot enable another admin account' });
    }

    await updateUserDisabledFields(pool, userId, null, false);

    if (targetUser.role === 'farmer') {
      await pool.query(
        'UPDATE products SET is_admin_disabled = false, admin_disabled_at = NULL WHERE farmer_id = $1',
        [userId]
      );
      
      // Send notification about bulk product enable
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [userId, 'products_enabled', 'Products Enabled', 'All your products have been re-enabled by admin.']
      );
    }

    await insertNotification(pool, {
      userId,
      type: 'account_enabled',
      title: 'Account enabled',
      message: 'Your account has been enabled.'
    });
    broadcastEvent('notification.created', { user_id: userId });

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.enable',
      entity: 'users',
      entity_id: userId,
      before: userResult.rows[0],
      after: { id: userId, is_disabled: false },
      req
    });
    // Log to activity logger (async, non-blocking)
    activityLogger.logSecurityEvent(
      req.user.id,
      req.user.role,
      req.sessionID,
      'user_enabled',
      'User account enabled by admin',
      { userId, email: userResult.rows[0]?.email },
      req.ip,
      req.headers['user-agent'],
      null,
      req.headers['referer'] || req.originalUrl
    );
    broadcastEvent('admin.audit', { action: 'user.enable', entity: 'users', entity_id: userId, actor_admin_id: req.user.id });

    return res.json({ message: 'User enabled' });
  } catch (error) {
    console.error('Enable user error:', error);
    return res.status(500).json({ message: 'Server error enabling user' });
  }
};

// Ensure audit log table exists (best effort)
ensureAuditTable(pool).catch(() => {});

// Get all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const userColumns = await getTableColumns('users');
    const hasUserColumn = (column) => userColumns.has(column);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const role = req.query.role ? String(req.query.role).trim() : null;
    const status = req.query.status ? String(req.query.status).trim() : null;
    const verification = req.query.verification ? String(req.query.verification).trim() : null;
    const allowedRoles = req.user.role === 'super_admin'
      ? ['customer', 'farmer', 'admin', 'super_admin']
      : ['customer', 'farmer'];

    const whereParts = [];
    const whereValues = [];
    let idx = 1;
    if (search) {
      const searchClauses = ['username', 'email', 'full_name']
        .filter(hasUserColumn)
        .map((column) => `${column} ILIKE $${idx}`);
      if (hasUserColumn('first_name')) searchClauses.push(`COALESCE(first_name, '') ILIKE $${idx}`);
      if (hasUserColumn('last_name')) searchClauses.push(`COALESCE(last_name, '') ILIKE $${idx}`);
      if (searchClauses.length) {
        whereParts.push(`(${searchClauses.join(' OR ')})`);
      }
      whereValues.push(`%${search}%`);
      idx++;
    }
    if (role) {
      if (!allowedRoles.includes(role)) {
        return res.status(req.user.role === 'super_admin' ? 400 : 403).json({ message: 'Invalid or unauthorized role filter' });
      }
      whereParts.push(`role = $${idx}`);
      whereValues.push(role);
      idx++;
    } else if (req.user.role !== 'super_admin') {
      whereParts.push(`role <> $${idx}`);
      whereValues.push('super_admin');
      idx++;
    }
    if (status === 'active') {
      whereParts.push(`COALESCE(is_disabled, false) = false`);
    } else if (status === 'disabled' || status === 'suspended') {
      whereParts.push(`COALESCE(is_disabled, false) = true`);
    }
    if (verification === 'verified') {
      whereParts.push(`COALESCE(is_verified, false) = true`);
    } else if (verification === 'unverified' || verification === 'pending') {
      whereParts.push(`COALESCE(is_verified, false) = false`);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM users ${whereSql}`, whereValues);
    const selectFields = [
      'id',
      'username',
      'email',
      'full_name',
      'role',
      'created_at',
      'first_name',
      'middle_name',
      'last_name',
      'phone',
      'address',
      'is_verified',
      'is_disabled',
      'disabled_at',
      'disabled_reason',
      'disable_type',
      'shop_name'
    ].filter(hasUserColumn);

    // Superadmin can request password field
    if (req.query.include_password === 'true' && req.user.role === 'super_admin' && hasUserColumn('password')) {
      selectFields.push('password');
    }
    const result = await pool.query(
      `SELECT ${selectFields.join(', ')} FROM users ${whereSql} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...whereValues, limit, offset]
    );

    const users = result.rows;
    res.json({ users, total: totalRes.rows[0]?.count || 0, page, limit });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/users', requireAdmin, async (req, res) => {
  try {
    const allowedRoles = req.user.role === 'super_admin'
      ? ['customer', 'farmer', 'admin']
      : ['customer', 'farmer'];
    const normalized = normalizeManagedUserPayload(req.body || {});

    if (!allowedRoles.includes(normalized.role)) {
      return res.status(400).json({ message: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
    }
    if (!normalized.email || !normalized.username || !normalized.password) {
      return res.status(400).json({ message: 'email, username, password, and role are required' });
    }
    if (normalized.password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!normalized.displayName) {
      return res.status(400).json({ message: 'At least full_name or first_name/last_name is required' });
    }
    if (normalized.firstName.length > 40) {
      return res.status(400).json({ message: 'First name must be 40 characters or less' });
    }
    if (normalized.middleName.length > 40) {
      return res.status(400).json({ message: 'Middle name must be 40 characters or less' });
    }
    if (normalized.lastName.length > 40) {
      return res.status(400).json({ message: 'Last name must be 40 characters or less' });
    }
    if (normalized.shopName.length > 40) {
      return res.status(400).json({ message: 'Shop name must be 40 characters or less' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized.email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [normalized.email, normalized.username]
    );
    if (existing.rows.length) {
      return res.status(409).json({ message: 'Email or username already exists' });
    }

    // Force plaintext password storage
    const passwordHash = normalized.password;
    const isVerified = normalized.role === 'farmer' ? false : true;
    const inserted = await pool.query(
      `INSERT INTO users (username, email, password, full_name, first_name, middle_name, last_name, phone, address, role, is_verified, shop_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
       RETURNING id, username, email, full_name, first_name, middle_name, last_name, phone, address, role, is_verified, is_disabled, disabled_at, disabled_reason, created_at`,
      [
        normalized.username,
        normalized.email,
        passwordHash,
        normalized.displayName,
        normalized.firstName || null,
        normalized.middleName || null,
        normalized.lastName || null,
        normalized.phone || null,
        normalized.address || null,
        normalized.role,
        isVerified,
        normalized.shopName || null
      ]
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.create',
      entity: 'users',
      entity_id: inserted.rows[0].id,
      before: null,
      after: inserted.rows[0],
      req
    });
    broadcastEvent('admin.audit', {
      action: 'user.create',
      entity: 'users',
      entity_id: inserted.rows[0].id,
      actor_admin_id: req.user.id
    });

    return res.status(201).json({ message: 'User created successfully', user: inserted.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email or username already exists' });
    }
    return res.status(500).json({ message: 'Server error creating user' });
  }
});

// Get audit logs (admin)
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 100);
    const offset = (page - 1) * limit;

    const { actor_admin_id, action, entity } = req.query;

    const where = [];
    const values = [];
    let idx = 1;

    // Admin visibility restriction: Regular admins can only see their own audit logs
    // Security rationale:
    // 1. Prevents collusion between admins - each admin can only audit their own actions
    // 2. Super admin has full visibility to oversee all admin activities
    // 3. Login/logout events are excluded from regular admin view as they are security-sensitive
    //    and should only be reviewed by super admin for security investigations
    // 4. This creates a separation of duties where regular admins cannot monitor other admins
    if (req.user.role === 'admin') {
      where.push(`actor_admin_id = $${idx++}`);
      values.push(req.user.id);
      // Exclude security-sensitive actions for admin role
      where.push(`action NOT IN ($${idx++}, $${idx++}, $${idx++})`);
      values.push('login.success', 'login.failed', 'logout.success');
    }

    if (actor_admin_id) {
      where.push(`actor_admin_id = $${idx++}`);
      values.push(parseInt(actor_admin_id, 10));
    }
    if (action) {
      where.push(`action = $${idx++}`);
      values.push(String(action));
    }
    if (entity) {
      where.push(`entity = $${idx++}`);
      values.push(String(entity));
    }

    const dateFrom = req.query.date_from ? String(req.query.date_from).trim() : null;
    const dateTo   = req.query.date_to   ? String(req.query.date_to).trim()   : null;

    if (dateFrom) {
      where.push(`created_at >= $${idx++}::date`);
      values.push(dateFrom);
    }
    if (dateTo) {
      where.push(`created_at < ($${idx++}::date + interval '1 day')`);
      values.push(dateTo);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM admin_audit_logs ${whereSql}`, values);
    const rowsRes = await pool.query(
      `
        SELECT id, actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id, before, after, ip_address, user_agent, session_id, created_at
        FROM admin_audit_logs
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `,
      [...values, limit, offset]
    );

    res.json({
      logs: rowsRes.rows,
      pagination: {
        page,
        limit,
        total: totalRes.rows[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single audit log by ID
router.get('/audit-logs/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id, before, after, ip_address, user_agent, session_id, created_at
       FROM admin_audit_logs
       WHERE id = $1`,
      [parseInt(id, 10)]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Audit log not found' });
    res.json({ log: result.rows[0] });
  } catch (error) {
    console.error('Get audit log detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get distinct audit actions for filter dropdown
router.get('/audit-logs/actions', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT action
       FROM admin_audit_logs
       ORDER BY action ASC`
    );
    res.json({ actions: result.rows.map(row => row.action) });
  } catch (error) {
    console.error('Get audit actions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get distinct audit entities for filter dropdown
router.get('/audit-logs/entities', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT entity
       FROM admin_audit_logs
       ORDER BY entity ASC`
    );
    res.json({ entities: result.rows.map(row => row.entity) });
  } catch (error) {
    console.error('Get audit entities error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user login/profile details (admin) - non-admin targets only
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);
    const { full_name, first_name, middle_name, last_name, shop_name, username, email, password, phone, address } = req.body || {};

    if (!targetUserId || targetUserId < 0) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    // Validate name/shop length limits before touching the database
    if (first_name !== undefined && String(first_name).trim().length > 40) {
      return res.status(400).json({ message: 'First name must be 40 characters or less' });
    }
    if (middle_name !== undefined && String(middle_name).trim().length > 40) {
      return res.status(400).json({ message: 'Middle name must be 40 characters or less' });
    }
    if (last_name !== undefined && String(last_name).trim().length > 40) {
      return res.status(400).json({ message: 'Last name must be 40 characters or less' });
    }
    if (shop_name !== undefined && String(shop_name).trim().length > 40) {
      return res.status(400).json({ message: 'Shop name must be 40 characters or less' });
    }

    const targetResult = await pool.query(
      'SELECT id, role, username, email, full_name FROM users WHERE id = $1',
      [targetUserId]
    );
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Regular admin users cannot edit admin users, but super admin can
    if (req.user.role !== 'super_admin' && targetResult.rows[0].role === 'admin') {
      return res.status(403).json({ message: 'Cannot edit admin users' });
    }
    if (req.user.role !== 'super_admin' && targetResult.rows[0].role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot edit super admin users' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex}`);
      values.push(full_name);
      paramIndex++;
    }

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(String(first_name).trim() || null);
      paramIndex++;
    }

    if (middle_name !== undefined) {
      updates.push(`middle_name = $${paramIndex}`);
      values.push(String(middle_name).trim() || null);
      paramIndex++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(String(last_name).trim() || null);
      paramIndex++;
    }

    if (shop_name !== undefined) {
      updates.push(`shop_name = $${paramIndex}`);
      values.push(String(shop_name).trim() || null);
      paramIndex++;
    }

    if (username !== undefined) {
      if (!String(username).trim()) {
        return res.status(400).json({ message: 'username is required' });
      }
      updates.push(`username = $${paramIndex}`);
      values.push(String(username).trim());
      paramIndex++;
    }

    if (email !== undefined) {
      if (!String(email).trim()) {
        return res.status(400).json({ message: 'email is required' });
      }
      const oldEmail = targetResult.rows[0].email;
      const newEmail = String(email).trim();
      if (oldEmail !== newEmail) {
        // Email is being changed - log this sensitive action
        await writeAdminAuditLog(pool, {
          actor_admin_id: req.user.id,
          action: 'user.email_changed',
          entity: 'users',
          entity_id: targetUserId,
          before: { old_email: oldEmail },
          after: { new_email: newEmail },
          req
        });
      }
      updates.push(`email = $${paramIndex}`);
      values.push(newEmail);
      paramIndex++;
    }

    if (password !== undefined) {
      if (!String(password).trim()) {
        return res.status(400).json({ message: 'password cannot be empty' });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      // Force plaintext password storage
      const pwHash = String(password);
      updates.push(`password = $${paramIndex}`);
      values.push(pwHash);
      paramIndex++;
      const userCols = await getTableColumns('users');
      if (userCols.has('password_hash')) {
        updates.push(`password_hash = $${paramIndex}`);
        values.push(pwHash);
        paramIndex++;
      }
    }

    if (phone !== undefined) {
      if (phone) {
        const phoneDigits = String(phone).replace(/\D/g, '');
        if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
          return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
        }
      }
      updates.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }

    if (address !== undefined) {
      updates.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields provided to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(targetUserId);

    const updated = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, email, full_name, first_name, middle_name, last_name, role, is_verified, created_at`,
      values
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.update',
      entity: 'users',
      entity_id: targetUserId,
      before: targetResult.rows[0],
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'user.update', entity: 'users', entity_id: targetUserId, actor_admin_id: req.user.id });

    res.json({ message: 'User updated successfully', user: updated.rows[0] });
  } catch (error) {
    console.error('Admin update user error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// Verify/unverify user (customers and farmers only, not admins)
router.put('/users/:id/verify', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_verified, reason } = req.body;

    if (typeof is_verified !== 'boolean') {
      return res.status(400).json({ message: 'is_verified must be a boolean' });
    }

    // Require reason when unverifying
    if (!is_verified && !reason) {
      return res.status(400).json({ message: 'Reason is required when unverifying a user' });
    }

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userRole = userResult.rows[0].role;

    // Only allow verify/unverify for customers and farmers, not admins
    if (userRole === 'admin' || userRole === 'super_admin') {
      return res.status(400).json({ message: 'Admin users cannot be verified/unverified through this endpoint' });
    }

    const beforeRes = await pool.query('SELECT id, role, is_verified, email, first_name FROM users WHERE id = $1', [id]);
    const beforeVerified = beforeRes.rows[0].is_verified;
    const userEmail = beforeRes.rows[0].email;
    const userFirstName = beforeRes.rows[0].first_name;
    await pool.query('UPDATE users SET is_verified = $1 WHERE id = $2', [is_verified, id]);
    const afterRes = await pool.query('SELECT id, role, is_verified FROM users WHERE id = $1', [id]);

    const action = is_verified ? 'user.verify' : 'user.unverify';
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action,
      entity: 'users',
      entity_id: parseInt(id, 10),
      before: beforeRes.rows[0],
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action, entity: 'users', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    // Send notification to user about verification status change
    let message;
    if (userRole === 'farmer') {
      message = is_verified
        ? 'Your farmer account has been verified! You can now sell products (up to 10 on the Free tier) and access basic analytics. Upgrade to Premium for unlimited products, priority search ranking, custom product names, and advanced analytics.'
        : `Your farmer account verification has been revoked. Reason: ${reason}. Product creation and sales features are now disabled.`;
    } else {
      message = is_verified
        ? 'Your account has been verified! You now have full access to all platform features.'
        : `Your account verification has been revoked. Reason: ${reason}. Some features may be restricted.`;
    }
    
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
      [id, is_verified ? 'account_verified' : 'account_unverified', 
       is_verified ? 'Account Verified' : 'Account Unverified',
       message]
    );
    broadcastEvent('notification.created', { user_id: parseInt(id, 10) });

    // If verifying, also send analytics upgrade notification
    if (is_verified && !beforeVerified) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [id, 'analytics_upgrade', 'Analytics Access Upgraded',
         'Your account is now verified! You have access to advanced analytics including charts, trends, and insights. Check your dashboard to view detailed performance metrics.']
      );
      broadcastEvent('notification.created', { user_id: parseInt(id, 10) });
    }

    // Log to verification history
    await pool.query(
      `INSERT INTO verification_history (farmer_id, action, actor_admin_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [id, is_verified ? 'verified' : 'unverified', req.user.id, reason || null]
    );

    // Send verification/unverification email (non-blocking)
    if (is_verified && !beforeVerified) {
      sendVerificationEmail(userEmail, userFirstName).catch(err => {
        console.error('Failed to send verification email:', err);
      });
    } else if (!is_verified) {
      sendUnverificationEmail(userEmail, userFirstName, reason).catch(err => {
        console.error('Failed to send unverification email:', err);
      });
    }

    res.json({ message: 'Farmer verification updated' });
  } catch (error) {
    console.error('Verify farmer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get verification requests
router.get('/verification-requests', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status ? String(req.query.status).trim() : null;
    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : null;

    let whereSql = '';
    const params = [];
    let paramIndex = 1;

    if (status && ['pending', 'approved', 'rejected', 'unverified'].includes(status)) {
      whereSql = `WHERE vr.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      const searchCondition = ` AND (
        LOWER(COALESCE(u.username, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(u.full_name, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(u.email, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(u.shop_name, '')) LIKE $${paramIndex}
      )`;
      whereSql += searchCondition;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM verification_requests vr
       JOIN users u ON vr.farmer_id = u.id ${whereSql}`,
      params
    );

    const result = await pool.query(
      `SELECT vr.*, 
              u.username, u.full_name, u.email, u.phone, u.address,
              u.role, u.shop_name, u.shop_description, u.shop_avatar_url,
              (SELECT COUNT(*) FROM products WHERE farmer_id = u.id) as product_count,
              (SELECT COUNT(*) FROM orders o LEFT JOIN products p ON o.product_id = p.id WHERE (p.farmer_id = u.id OR p.farmer_id IS NULL) AND o.status = 'delivered') as delivered_orders
       FROM verification_requests vr
       JOIN users u ON vr.farmer_id = u.id
       ${whereSql}
       ORDER BY vr.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({ 
      requests: result.rows, 
      total: totalRes.rows[0]?.count || 0, 
      page, 
      limit 
    });
  } catch (error) {
    console.error('Get verification requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Review verification request
router.put('/verification-requests/:id/review', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!['approved', 'rejected', 'unverified'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved, rejected, or unverified' });
    }

    if (status === 'rejected' && !rejection_reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    if (status === 'unverified' && !rejection_reason) {
      return res.status(400).json({ message: 'Reason is required for unverify' });
    }

    const requestRes = await pool.query(
      'SELECT * FROM verification_requests WHERE id = $1',
      [id]
    );

    if (requestRes.rows.length === 0) {
      return res.status(404).json({ message: 'Verification request not found' });
    }

    const request = requestRes.rows[0];
    const farmerId = request.farmer_id;

    // For unverify (unverified status), allow changing from approved
    // For approve/reject, only allow from pending
    if (status === 'unverified' && request.status !== 'approved') {
      return res.status(400).json({ message: 'Can only unverify approved requests' });
    }

    if (['approved', 'rejected'].includes(status) && request.status !== 'pending') {
      return res.status(400).json({ message: 'Request has already been reviewed' });
    }

    // Update request status
    await pool.query(
      `UPDATE verification_requests
       SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [status, rejection_reason || null, req.user.id, id]
    );

    // If approved, verify the farmer
    if (status === 'approved') {
      await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [farmerId]);

      // Send verification notification
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [farmerId, 'account_verified', 'Account Verified',
         'Your farmer account has been verified! You can now sell products (up to 10 on the Free tier) and access basic analytics. Upgrade to Premium for unlimited products, priority search ranking, custom product names, and advanced analytics.']
      );
      broadcastEvent('notification.created', { user_id: farmerId });
    }

    // If unverified (unverified status), unverify the farmer
    if (status === 'unverified' && request.status === 'approved') {
      await pool.query('UPDATE users SET is_verified = false WHERE id = $1', [farmerId]);

      // Send unverify notification
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [farmerId, 'account_unverified', 'Account Unverified',
         `Your farmer account has been unverified. Reason: ${rejection_reason}. Please contact support if you believe this is an error.`]
      );
      broadcastEvent('notification.created', { user_id: farmerId });
    } else if (status === 'rejected') {
      // Send rejection notification
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [farmerId, 'verification_rejected', 'Verification Request Rejected',
         `Your verification request has been rejected. Reason: ${rejection_reason}. You may submit a new request after addressing the feedback.`]
      );
      broadcastEvent('notification.created', { user_id: farmerId });
    }

    // Audit log
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'verification_request.review',
      entity: 'verification_requests',
      entity_id: parseInt(id, 10),
      before: requestRes.rows[0],
      after: { status, rejection_reason },
      req
    });
    broadcastEvent('admin.audit', { action: 'verification_request.review', entity: 'verification_requests', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    // Log to verification history
    await pool.query(
      `INSERT INTO verification_history (farmer_id, action, actor_admin_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [farmerId, status === 'approved' ? 'request_approved' : 'request_rejected', req.user.id, rejection_reason || null]
    );

    res.json({ message: `Verification request ${status}` });
  } catch (error) {
    console.error('Review verification request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update farmer shop profile (admin)
router.put('/users/:id/shop-profile', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);
    const { shop_description, shop_banner_url, shop_avatar_url, full_name, address } = req.body;

    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userResult.rows[0].role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can be updated with shop profile' });
    }

    // Get current shop banner and avatar URLs if columns exist
    let currentBannerUrl = null;
    let currentAvatarUrl = null;
    try {
      const currentResult = await pool.query(
        'SELECT shop_banner_url, shop_avatar_url FROM users WHERE id = $1',
        [targetUserId]
      );
      if (currentResult.rows.length > 0) {
        currentBannerUrl = currentResult.rows[0].shop_banner_url;
        currentAvatarUrl = currentResult.rows[0].shop_avatar_url;
      }
    } catch (error) {
      console.warn('Could not fetch current shop URLs (columns may not exist):', error.message);
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (full_name !== undefined && full_name !== null && full_name !== '') {
      updates.push(`full_name = $${paramIndex}`);
      values.push(full_name);
      paramIndex++;
    }

    if (address !== undefined && address !== null && address !== '') {
      updates.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;

      // Sync product locations with new shop address
      try {
        await pool.query(
          'UPDATE products SET location = $1, updated_at = CURRENT_TIMESTAMP WHERE farmer_id = $2',
          [address, targetUserId]
        );
      } catch (productUpdateError) {
        console.error('Error syncing product locations:', productUpdateError);
      }
    }

    if (shop_description !== undefined && shop_description !== null && shop_description !== '') {
      updates.push(`shop_description = $${paramIndex}`);
      values.push(shop_description);
      paramIndex++;
    }

    if (shop_banner_url !== undefined && shop_banner_url !== null && shop_banner_url !== '') {
      updates.push(`shop_banner_url = $${paramIndex}`);
      values.push(shop_banner_url);
      paramIndex++;
    }

    if (shop_avatar_url !== undefined && shop_avatar_url !== null && shop_avatar_url !== '') {
      updates.push(`shop_avatar_url = $${paramIndex}`);
      values.push(shop_avatar_url);
      paramIndex++;
    }

    const beforeRes = await pool.query('SELECT id, full_name, address, shop_description, shop_banner_url, shop_avatar_url FROM users WHERE id = $1', [targetUserId]);

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(targetUserId);

      await pool.query(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
      `, values);
    }

    const afterRes = await pool.query('SELECT id, full_name, address, shop_description, shop_banner_url, shop_avatar_url FROM users WHERE id = $1', [targetUserId]);
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.shop_profile.update',
      entity: 'users',
      entity_id: targetUserId,
      before: beforeRes.rows[0],
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'user.shop_profile.update', entity: 'users', entity_id: targetUserId, actor_admin_id: req.user.id });

    const { deleteFileIfExists, resolvePublicPath } = require('../utils/fileUtils');
    if (shop_banner_url && currentBannerUrl && shop_banner_url !== currentBannerUrl) {
      const oldBannerPath = resolvePublicPath(currentBannerUrl);
      if (oldBannerPath) deleteFileIfExists(oldBannerPath);
    }
    if (shop_avatar_url && currentAvatarUrl && shop_avatar_url !== currentAvatarUrl) {
      const oldAvatarPath = resolvePublicPath(currentAvatarUrl);
      if (oldAvatarPath) deleteFileIfExists(oldAvatarPath);
    }

    res.json({ message: 'Farmer shop profile updated successfully' });
  } catch (error) {
    console.error('Admin update shop profile error:', error);
    res.status(500).json({ message: 'Server error updating shop profile' });
  }
});

// Generate a one-time temporary password for a user (admin-only).
// This returns the plaintext password in the response but stores only the bcrypt hash in the database.
router.post('/users/:id/generate-temp-password', requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (!targetUserId) return res.status(400).json({ message: 'Invalid user id' });

    const userResult = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1', [targetUserId]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    // Generate a reasonably strong temporary password (12 chars, URL-safe)
    const tmp = crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
    const plaintextPasswordsEnabled =
      process.env.NODE_ENV !== 'production' &&
      (process.env.ALLOW_PLAINTEXT_PASSWORDS === 'true' || process.env.DEV_PLAINTEXT_PASSWORDS === 'true');
    const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const passwordValue = plaintextPasswordsEnabled ? tmp : await bcrypt.hash(tmp, BCRYPT_ROUNDS);

    // Determine which password columns exist and update accordingly
    const colsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    const cols = new Set(colsRes.rows.map(r => r.column_name));
    const sets = [];
    const values = [];
    let idx = 1;

    if (cols.has('password')) {
      sets.push(`password = $${idx}`);
      values.push(passwordValue);
      idx++;
    }
    if (cols.has('password_hash')) {
      sets.push(`password_hash = $${idx}`);
      values.push(passwordValue);
      idx++;
    }

    if (sets.length === 0) {
      return res.status(500).json({ message: 'No password columns found to update' });
    }

    values.push(targetUserId);
    const updateSql = `UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`;
    await pool.query(updateSql, values);

    // Audit log if available
    try {
      await ensureAuditTable(pool);
      await writeAdminAuditLog(pool, {
        actor_admin_id: req.user.id,
        action: 'user.generate_temp_password',
        entity: 'users',
        entity_id: targetUserId,
        before: null,
        after: { updated_password: true },
        req
      });
      broadcastEvent('admin.audit', { action: 'user.generate_temp_password', entity: 'users', entity_id: targetUserId, actor_admin_id: req.user.id });
    } catch (_) {}

    // Return plaintext temporary password to admin caller (do NOT store plaintext)
    res.json({ message: 'Temporary password generated', temp_password: tmp });
  } catch (error) {
    console.error('Generate temp password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all products for admin
router.get('/products', requireAdmin, async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
        const offset = (page - 1) * limit;
        const search = req.query.search ? String(req.query.search).trim() : null;
        const category = req.query.category ? String(req.query.category).trim() : null;
        const status = req.query.status ? String(req.query.status).trim() : null;

        const whereParts = [];
        const whereValues = [];
        let idx = 1;
        if (search) {
          whereParts.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
          whereValues.push(`%${search}%`);
          idx++;
        }
        if (category) {
          whereParts.push(`p.category_id = $${idx++}`);
          whereValues.push(parseInt(category, 10));
        }
        if (status === 'available') {
          whereParts.push(`p.status = 'approved' AND p.is_available = true AND COALESCE(p.is_admin_disabled, false) = false AND COALESCE(u.is_disabled, false) = false`);
        } else if (status === 'disabled') {
          whereParts.push(`COALESCE(p.is_admin_disabled, false) = true`);
        } else if (status === 'unavailable') {
          whereParts.push(`p.is_available = false`);
        } else if (status === 'no_stock') {
          whereParts.push(`p.stock_quantity <= 0`);
        } else if (status === 'pending') {
          whereParts.push(`p.status = 'pending'`);
        } else if (status === 'approved') {
          whereParts.push(`p.status = 'approved'`);
        } else if (status === 'rejected') {
          whereParts.push(`p.status = 'rejected'`);
        }
        const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

        const totalRes = await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM products p
          LEFT JOIN users u ON p.farmer_id = u.id
          ${whereSql}
        `, whereValues);
        const result = await pool.query(`
          SELECT p.*, u.full_name as farmer_name, u.username as farmer_username, u.email as farmer_email, u.shop_name as farmer_shop_name, u.address as farmer_address,
            cat.name AS category_name,
               COALESCE(u.is_disabled, false) as farmer_is_disabled,
               COALESCE(u.is_verified, false) as farmer_is_verified
          FROM products p
          LEFT JOIN users u ON p.farmer_id = u.id
          LEFT JOIN categories cat ON p.category_id = cat.id
          ${whereSql}
          ORDER BY COALESCE(u.is_verified, false) DESC, p.created_at ASC
          LIMIT $${idx} OFFSET $${idx + 1}
        `, [...whereValues, limit, offset]);
        res.json({ products: result.rows, total: totalRes.rows[0]?.count || 0, page, limit });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign product to farmer
router.put('/products/:id/assign', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { farmer_id } = req.body;

    if (!farmer_id) {
      return res.status(400).json({ message: 'farmer_id is required' });
    }

    const farmerResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [farmer_id]);
    if (farmerResult.rows.length === 0 || farmerResult.rows[0].role !== 'farmer') {
      return res.status(400).json({ message: 'Target farmer is invalid' });
    }

    const productResult = await pool.query('SELECT id, farmer_id FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const before = productResult.rows[0];
    await pool.query('UPDATE products SET farmer_id = $1 WHERE id = $2', [farmer_id, id]);
    const afterRes = await pool.query('SELECT id, farmer_id FROM products WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'product.assign',
      entity: 'products',
      entity_id: parseInt(id, 10),
      before,
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'product.assign', entity: 'products', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Product reassigned successfully' });
  } catch (error) {
    console.error('Assign product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve product (for product approvals)
router.post('/products/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    if (!productId) return res.status(400).json({ message: 'Invalid product id' });

    const productRes = await pool.query('SELECT id, is_available, is_admin_disabled, farmer_id, name FROM products WHERE id = $1', [productId]);
    if (!productRes.rows.length) return res.status(404).json({ message: 'Product not found' });

    const before = productRes.rows[0];
    await pool.query('UPDATE products SET is_available = true, is_admin_disabled = false, status = $2 WHERE id = $1', [productId, 'approved']);
    const afterRes = await pool.query('SELECT id, is_available, is_admin_disabled, status FROM products WHERE id = $1', [productId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'product.approve',
      entity: 'products',
      entity_id: productId,
      before,
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'product.approve', entity: 'products', entity_id: productId, actor_admin_id: req.user.id });

    // Send notification to farmer
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
      [before.farmer_id, 'product_approved', 'Product Approved', `Your product "${before.name}" has been approved and is now live on the marketplace.`, productId]
    );

    res.json({ message: 'Product approved successfully' });
  } catch (error) {
    console.error('Approve product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject product (for product approvals)
router.post('/products/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const productId = parseInt(id, 10);
    if (!productId) return res.status(400).json({ message: 'Invalid product id' });
    if (!rejection_reason || rejection_reason.trim().length === 0) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const productRes = await pool.query('SELECT id, is_available, is_admin_disabled, farmer_id, name FROM products WHERE id = $1', [productId]);
    if (!productRes.rows.length) return res.status(404).json({ message: 'Product not found' });

    const before = productRes.rows[0];
    
    // Try to update with rejection_reason, fall back if column doesn't exist
    try {
      await pool.query('UPDATE products SET is_available = false, is_admin_disabled = true, status = $2, rejection_reason = $3 WHERE id = $1', [productId, 'rejected', rejection_reason.trim()]);
    } catch (updateError) {
      // If column doesn't exist, update without it
      if (updateError.message && updateError.message.includes('column') && updateError.message.includes('rejection_reason')) {
        await pool.query('UPDATE products SET is_available = false, is_admin_disabled = true, status = $2 WHERE id = $1', [productId, 'rejected']);
      } else {
        throw updateError;
      }
    }
    
    const afterRes = await pool.query('SELECT id, is_available, is_admin_disabled, status FROM products WHERE id = $1', [productId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'product.reject',
      entity: 'products',
      entity_id: productId,
      before,
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'product.reject', entity: 'products', entity_id: productId, actor_admin_id: req.user.id });

    // Send notification to farmer
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
      [before.farmer_id, 'product_rejected', 'Product Rejected', `Your product "${before.name}" was rejected. Reason: ${rejection_reason.trim()}`, productId]
    );

    res.json({ message: 'Product rejected successfully' });
  } catch (error) {
    console.error('Reject product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update product details (admin)
router.put('/products/:id', requireAdmin, productUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    // Use req.body for text fields, req.file for image
    const {
      name,
      description,
      price,
      category_id,
      stock_quantity,
      unit,
      location,
      harvest_date,
      expiry_date,
      is_available
    } = req.body;

    // Ensure products table has cloudinary_public_id column
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255)");

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const current = productResult.rows[0];
    let image_url = req.body.image_url;
    let imagePublicId = null;

    const nextName = String(name || current.name || '').trim();
    const nextCategoryId = Number.parseInt(category_id, 10) || Number.parseInt(current.category_id, 10) || null;
    const resolvedCategoryName = await loadCategoryNameById(nextCategoryId);
    const targetPublicId = `agricatch/${cloudinary.slugify(resolvedCategoryName)}/${cloudinary.slugify(nextName)}/${id}.jpeg`;
    const oldPublicId = current.cloudinary_public_id || extractCloudinaryPublicId(current.image_url) || null;

    if (req.file && req.file.path) {
      try {
        const uploaded = await cloudinary.uploadFile(req.file.path, {
          public_id: targetPublicId,
          overwrite: true,
          invalidate: true,
          resource_type: 'image',
          tags: [
            'app:agricatch',
            'entity:product',
            `entity_id:${id}`,
            `category:${cloudinary.slugify(resolvedCategoryName)}`,
            'role:primary'
          ],
          transformation: [
            { width: 1200, crop: 'limit', quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        });
        image_url = uploaded.secure_url;
        imagePublicId = uploaded.public_id;

        if (oldPublicId && imagePublicId && oldPublicId !== imagePublicId) {
          try {
            await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
          } catch (destroyErr) {
            console.warn('Failed to destroy previous Cloudinary asset:', oldPublicId, destroyErr && (destroyErr.message || destroyErr));
          }
        }
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        return res.status(500).json({ message: 'Image upload failed' });
      } finally {
        deleteFileIfExists(req.file.path);
      }
    }

    if (!req.file && image_url && String(image_url).trim() !== '') {
      const explicitPublicId = req.body.cloudinary_public_id || extractCloudinaryPublicId(image_url);
      if (explicitPublicId) {
        const moved = await rehomeProductImageToCategorizedId({
          categoryName: resolvedCategoryName,
          productName: nextName,
          productId: id,
          imagePublicId: explicitPublicId,
          imageUrl: image_url
        });
        image_url = moved.imageUrl || image_url;
        imagePublicId = moved.imagePublicId || explicitPublicId;
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined && name !== null && name !== "") {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }
    if (description !== undefined && description !== null && description !== "") {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (price !== undefined && price !== null && price !== "") {
      const priceCheck = validateBoundedNumber(price, 'price', { min: 0 });
      if (priceCheck?.error) return res.status(400).json({ message: priceCheck.error });
      updates.push(`price = $${paramIndex}`);
      values.push(Number(price));
      paramIndex++;
    }
    if (category_id !== undefined && category_id !== null && category_id !== "") {
      updates.push(`category_id = $${paramIndex}`);
      values.push(Number(category_id));
      paramIndex++;
    }
    if (stock_quantity !== undefined && stock_quantity !== null && stock_quantity !== "") {
      const stockCheck = validateBoundedNumber(stock_quantity, 'stock_quantity', { min: 0 });
      if (stockCheck?.error) return res.status(400).json({ message: stockCheck.error });
      updates.push(`stock_quantity = $${paramIndex}`);
      values.push(Number(stock_quantity));
      paramIndex++;
    }
    if (unit !== undefined && unit !== null && unit !== "") {
      updates.push(`unit = $${paramIndex}`);
      values.push(unit);
      paramIndex++;
    }
    if (location !== undefined && location !== null && location !== "") {
      updates.push(`location = $${paramIndex}`);
      values.push(location);
      paramIndex++;
    }
    if (harvest_date !== undefined && harvest_date !== null && harvest_date !== "") {
      updates.push(`harvest_date = $${paramIndex}`);
      values.push(harvest_date);
      paramIndex++;
    }
    if (expiry_date !== undefined && expiry_date !== null && expiry_date !== "") {
      updates.push(`expiry_date = $${paramIndex}`);
      values.push(expiry_date);
      paramIndex++;
    }
    if (is_available !== undefined && is_available !== null && is_available !== "") {
      updates.push(`is_available = $${paramIndex}`);
      values.push(is_available === 'true' || is_available === true ? true : false);
      paramIndex++;
    }
    if (image_url !== undefined && image_url !== null && image_url !== "") {
      updates.push(`image_url = $${paramIndex}`);
      values.push(image_url);
      paramIndex++;
    }
    // If we uploaded to Cloudinary during this request, store the public_id too
    if (imagePublicId) {
      updates.push(`cloudinary_public_id = $${paramIndex}`);
      values.push(imagePublicId);
      paramIndex++;
    } else if (req.body.cloudinary_public_id) {
      // Or accept an explicit public_id from the client
      updates.push(`cloudinary_public_id = $${paramIndex}`);
      values.push(req.body.cloudinary_public_id);
      paramIndex++;
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No fields provided to update' });
    }

    const updateSql = `UPDATE products SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`;
    values.push(id);
    const updated = await pool.query(updateSql, values);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'product.update',
      entity: 'products',
      entity_id: id,
      before: current,
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'product.update', entity: 'products', entity_id: id, actor_admin_id: req.user.id });

    // Broadcast product update for realtime frontend refresh (especially landing page)
    if (name !== undefined && name !== null && name !== "" && name !== current.name) {
      broadcastEvent('product.updated', { product_id: id, name: name });
    }

    res.json({ message: 'Product updated', product: updated.rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders with user details
router.get('/orders', requireAdmin, async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
        const offset = (page - 1) * limit;
        const search = req.query.search ? String(req.query.search).trim() : null;
        const status = req.query.status ? String(req.query.status).trim() : null;
        const dateFrom = req.query.date_from ? String(req.query.date_from).trim() : null;
        const dateTo = req.query.date_to ? String(req.query.date_to).trim() : null;
        const minTotal = req.query.min_total !== undefined ? Number(req.query.min_total) : null;
        const maxTotal = req.query.max_total !== undefined ? Number(req.query.max_total) : null;

        const whereParts = [];
        const whereValues = [];
        let idx = 1;
        if (search) {
          whereParts.push(`(u.username ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR CAST(o.id AS TEXT) ILIKE $${idx})`);
          whereValues.push(`%${search}%`);
          idx++;
        }
        if (status) {
          whereParts.push(`o.status = $${idx++}`);
          whereValues.push(status);
        }
        if (dateFrom) {
          whereParts.push(`o.created_at >= $${idx++}::date`);
          whereValues.push(dateFrom);
        }
        if (dateTo) {
          whereParts.push(`o.created_at < ($${idx++}::date + interval '1 day')`);
          whereValues.push(dateTo);
        }
        if (Number.isFinite(minTotal)) {
          whereParts.push(`o.total_amount >= $${idx++}`);
          whereValues.push(minTotal);
        }
        if (Number.isFinite(maxTotal)) {
          whereParts.push(`o.total_amount <= $${idx++}`);
          whereValues.push(maxTotal);
        }
        const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

        const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereSql}`, whereValues);
        const result = await pool.query(`
            SELECT o.*, u.username, u.email, u.full_name, p.name AS product_name, p.image_url AS product_image,
                   p.is_preorder, p.preorder_availability_date, p.reserved_quantity, p.max_preorder_quantity,
                   p.harvest_date
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN products p ON o.product_id = p.id
            ${whereSql}
            ORDER BY o.created_at DESC
            LIMIT $${idx} OFFSET $${idx + 1}
        `, [...whereValues, limit, offset]);
        res.json({ orders: result.rows, total: totalRes.rows[0]?.count || 0, page, limit });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user role (super_admin only)
router.put('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    // Admin cannot change any user roles
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can change user roles' });
    }

    const { id } = req.params;
    const { role } = req.body;
    const targetUserId = parseInt(id, 10);

    if (!['customer', 'farmer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const targetResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (targetResult.rows[0].role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot change super admin role' });
    }

    // Prevent superadmin from demoting themselves (locks you out of superadmin panel)
    if (targetUserId === req.user.id && targetResult.rows[0].role === 'super_admin' && role !== 'super_admin') {
      return res.status(400).json({ message: 'You cannot change your own super admin role' });
    }

    const beforeRes = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);
    const beforeRole = beforeRes.rows[0].role;
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, targetUserId]);
    const afterRes = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.role.update',
      entity: 'users',
      entity_id: targetUserId,
      before: beforeRes.rows[0],
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'user.role.update', entity: 'users', entity_id: targetUserId, actor_admin_id: req.user.id });

    // Send notification to user about role change
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
      [targetUserId, 'role_changed', 'Role Changed', `Your account role has been changed from "${beforeRole}" to "${role}".`]
    );

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update order status
router.put('/orders/:id/status', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = getValidStatuses();
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const beforeRes = await client.query('SELECT id, status, user_id FROM orders WHERE id = $1', [id]);
    if (!beforeRes.rows.length) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentStatus = beforeRes.rows[0].status;

    // Use shared transition matrix for validation
    const validation = validateTransition(currentStatus, status, req.user.role);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }


    // Update order status and timestamps
    await client.query(`
      UPDATE orders
      SET status = $1,
          updated_at = CURRENT_TIMESTAMP,
          delivered_at = CASE WHEN $1::varchar = 'delivered'::varchar THEN CURRENT_TIMESTAMP ELSE delivered_at END,
          cancelled_at = CASE WHEN $1::varchar = 'cancelled'::varchar THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
          cancelled_by = CASE WHEN $1::varchar = 'cancelled'::varchar THEN 'admin'::varchar ELSE cancelled_by END
      WHERE id = $2
    `, [status, id]);

    // Log status history for timeline tracking
    try {
      await client.query(
        `INSERT INTO order_status_history (order_id, status, changed_by, changed_by_role)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [parseInt(id, 10), status, req.user.id, req.user.role]
      );
    } catch (e) {
      console.error('Failed to log order status history:', e.message);
    }

    // Apply business logic based on status change
    if (status === 'cancelled' && currentStatus !== 'cancelled') {
      // Restore inventory using shared business logic
      const order = await getOrderForBusinessLogic(client, id);
      if (order) {
        await restoreInventoryOnCancel(client, order);
      }
    }

    if (status === 'delivered' && currentStatus !== 'delivered') {
      // Update statistics using shared business logic
      const order = await getOrderForBusinessLogic(client, id);
      if (order) {
        await updateStatisticsOnDeliver(client, order);
      }
    }

    await client.query('COMMIT');

    const afterRes = await pool.query('SELECT id, status FROM orders WHERE id = $1', [id]);

    // Notify customer of status change
    const ordUserId = beforeRes.rows[0]?.user_id;
    if (ordUserId) {
      const statusLabels = {
        pending: 'Pending', preorder_reserved: 'Pre-order Reserved', confirmed: 'Confirmed', preparing: 'Preparing',
        scheduled: 'Scheduled', out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled'
      };
      await insertNotification(pool, {
        userId: ordUserId,
        type: 'order_status',
        title: `Order #${id} Status Updated`,
        message: `Your order status is now: ${statusLabels[status] || status}`,
        orderId: parseInt(id, 10)
      });
      broadcastEvent('notification.created', { user_id: ordUserId });
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'order.status.update',
      entity: 'orders',
      entity_id: parseInt(id, 10),
      before: beforeRes.rows[0],
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('order.updated', { order_id: parseInt(id, 10) });
    broadcastEvent('admin.audit', { action: 'order.status.update', entity: 'orders', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Disable order (admin)
router.delete('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10);

    if (!orderId) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await pool.query(
      'UPDATE orders SET is_disabled = true, disabled_at = CURRENT_TIMESTAMP WHERE id = $1',
      [orderId]
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'order.disable',
      entity: 'orders',
      entity_id: orderId,
      before: orderResult.rows[0],
      after: { id: orderId, is_disabled: true },
      req
    });
    broadcastEvent('order.updated', { order_id: orderId, disabled: true });
    broadcastEvent('admin.audit', { action: 'order.disable', entity: 'orders', entity_id: orderId, actor_admin_id: req.user.id });

    res.json({ message: 'Order disabled successfully' });
  } catch (error) {
    console.error('Disable order error:', error);
    res.status(500).json({ message: 'Server error disabling order' });
  }
});

router.put('/orders/:id/enable', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10);
    if (!orderId) return res.status(400).json({ message: 'Invalid order id' });

    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!orderResult.rows.length) return res.status(404).json({ message: 'Order not found' });

    await pool.query('UPDATE orders SET is_disabled = false, disabled_at = NULL WHERE id = $1', [orderId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'order.enable',
      entity: 'orders',
      entity_id: orderId,
      before: orderResult.rows[0],
      after: { id: orderId, is_disabled: false },
      req
    });
    broadcastEvent('admin.audit', { action: 'order.enable', entity: 'orders', entity_id: orderId, actor_admin_id: req.user.id });

    res.json({ message: 'Order enabled successfully' });
  } catch (error) {
    console.error('Enable order error:', error);
    res.status(500).json({ message: 'Server error enabling order' });
  }
});

// Get dashboard statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const cached = adminCache.get('admin_stats');
    if (cached) return res.json(cached);

    const [usersResult, productsResult, ordersResult, revenueResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query(`
        SELECT COUNT(*) as count
        FROM products p
        LEFT JOIN users u ON p.farmer_id = u.id
        WHERE p.is_available = true
          AND COALESCE(p.is_admin_disabled, false) = false
          AND COALESCE(u.is_disabled, false) = false
      `),
      pool.query('SELECT COUNT(*) as count FROM orders'),
      pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != \'cancelled\'')
    ]);

    const response = {
      stats: {
        totalUsers: parseInt(usersResult.rows[0].count),
        totalProducts: parseInt(productsResult.rows[0].count),
        totalOrders: parseInt(ordersResult.rows[0].count),
        totalRevenue: parseFloat(revenueResult.rows[0].total)
      }
    };
    adminCache.set('admin_stats', response);
    res.json(response);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Disable/enable users
router.put('/users/:id/disable', requireAdmin, disableUserHandler);
router.put('/users/:id/enable', requireAdmin, enableUserHandler);

// Legacy delete endpoint now disables the user
router.delete('/users/:id', requireAdmin, async (req, res) => disableUserHandler(req, res, 'Account disabled by admin'));

// Delete product (hard delete)
router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const productResult = await pool.query('SELECT id, farmer_id, image_url, cloudinary_public_id FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = productResult.rows[0];

    // Delete related records first to avoid foreign key constraint errors
    try {
      // Delete from cart
      await pool.query('DELETE FROM cart WHERE product_id = $1', [id]);
      // Delete from wishlist
      await pool.query('DELETE FROM wishlist WHERE product_id = $1', [id]);
      // Delete from reviews
      await pool.query('DELETE FROM reviews WHERE product_id = $1', [id]);
      // Delete from notifications
      await pool.query('DELETE FROM notifications WHERE product_id = $1', [id]);
      // Note: We keep orders and order_items as historical records
      // They can reference a deleted product (product_id will remain but product won't exist)

      // Delete the product
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
    } catch (deleteError) {
      console.error('Delete product error:', deleteError);
      // If foreign key constraint error, provide helpful message
      if (deleteError.code === '23503') {
        return res.status(400).json({
          message: 'Cannot delete product due to existing related records. Please contact support.'
        });
      }
      throw deleteError;
    }

    // Send notification to farmer after product is deleted
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
      [product.farmer_id, 'product_deleted', 'Product Deleted', `Your product has been deleted by admin.`]
    );

    // Delete image from Cloudinary if it exists
    const imageUrl = product.image_url;
    const cloudPublicId = product.cloudinary_public_id;
    if (cloudPublicId || (imageUrl && /^https:\/\/res\.cloudinary\.com\//.test(String(imageUrl)))) {
      try {
        const publicIdToDelete = cloudPublicId || extractCloudinaryPublicId(imageUrl);
        if (publicIdToDelete) {
          await cloudinary.uploader.destroy(publicIdToDelete, { resource_type: 'image' });
        }
      } catch (cloudErr) {
        console.warn('Cloudinary deletion failed for', cloudPublicId || imageUrl, cloudErr && (cloudErr.message || cloudErr));
      }
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'product.delete',
      entity: 'products',
      entity_id: parseInt(id, 10),
      before: product,
      after: null,
      req
    });
    broadcastEvent('admin.audit', { action: 'product.delete', entity: 'products', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

// Toggle product status
router.put('/products/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_admin_disabled } = req.body;

    if (typeof is_admin_disabled !== 'boolean') {
      return res.status(400).json({ message: 'is_admin_disabled must be a boolean' });
    }

    const productResult = await pool.query('SELECT id, is_admin_disabled FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const before = productResult.rows[0];
    await pool.query(
      `UPDATE products
       SET is_admin_disabled = $1,
           admin_disabled_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [is_admin_disabled, id]
    );
    const afterRes = await pool.query('SELECT id, is_admin_disabled FROM products WHERE id = $1', [id]);

    const action = is_admin_disabled ? 'product.disable' : 'product.enable';
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action,
      entity: 'products',
      entity_id: parseInt(id, 10),
      before,
      after: afterRes.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action, entity: 'products', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Product admin status updated successfully' });
  } catch (error) {
    console.error('Toggle product admin status error:', error);
    res.status(500).json({ message: 'Server error updating product status' });
  }
});

// Category management (admin/super_admin)
router.get('/categories', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const status = req.query.status ? String(req.query.status).trim() : null;

    const whereParts = [];
    const whereValues = [];
    let idx = 1;

    if (search) {
      whereParts.push(`name ILIKE $${idx}`);
      whereValues.push(`%${search}%`);
      idx++;
    }
    if (status === 'active') {
      whereParts.push(`COALESCE(is_disabled, false) = false`);
    } else if (status === 'disabled') {
      whereParts.push(`COALESCE(is_disabled, false) = true`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM categories ${whereSql}`, whereValues);
    const result = await pool.query(
      `SELECT c.id, c.name, c.description, COALESCE(c.type, 'agricultural') AS type, c.is_disabled, c.created_at,
              COALESCE(p.product_count, 0)::int AS product_count
       FROM categories c
       LEFT JOIN (
         SELECT category_id, COUNT(*)::int AS product_count FROM products GROUP BY category_id
       ) p ON p.category_id = c.id
       ${whereSql}
       ORDER BY c.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...whereValues, limit, offset]
    );

    return res.json({ categories: result.rows, total: totalRes.rows[0]?.count || 0, page, limit });
  } catch (error) {
    console.error('Admin get categories error:', error);
    return res.status(500).json({ message: 'Server error fetching categories' });
  }
});

router.get('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid category id' });

    const result = await pool.query(
      `SELECT id, name, description, COALESCE(type, 'agricultural') AS type, COALESCE(is_disabled, false) AS is_disabled, created_at
       FROM categories
       WHERE id = $1`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Category not found' });

    return res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('Admin get category error:', error);
    return res.status(500).json({ message: 'Server error fetching category' });
  }
});

router.get('/categories/:id/products', requireAdmin, async (req, res) => {
  try {
    const categoryId = Number(req.params.id || 0);
    if (!categoryId) return res.status(400).json({ message: 'Invalid category id' });

    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, p.stock_quantity, p.unit, p.status,
              p.is_available, COALESCE(p.is_admin_disabled, false) AS is_admin_disabled,
              p.farmer_id, u.full_name AS farmer_name, u.username AS farmer_username, u.email AS farmer_email, u.address AS farmer_address,
              COALESCE(u.is_disabled, false) AS farmer_is_disabled
       FROM products p
       LEFT JOIN users u ON u.id = p.farmer_id
       WHERE p.category_id = $1
       ORDER BY p.created_at DESC`,
      [categoryId]
    );

    const farmerIds = new Set(result.rows.map((product) => product.farmer_id).filter(Boolean));

    return res.json({
      products: result.rows,
      product_count: result.rows.length,
      farmer_count: farmerIds.size
    });
  } catch (error) {
    console.error('Admin get category products error:', error);
    return res.status(500).json({ message: 'Server error fetching category products' });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    const name = normalizeCategoryName(req.body?.name);
    const description = String(req.body?.description || '').trim();
    const type = String(req.body?.type || 'agricultural').trim().toLowerCase();

    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const existing = await pool.query('SELECT id, is_disabled FROM categories WHERE LOWER(name) = $1 LIMIT 1', [normalizeCategoryKey(name)]);
    if (existing.rows.length) {
      const isDisabled = !!existing.rows[0].is_disabled;
      return res.status(409).json({
        message: isDisabled
          ? 'Category already exists and is disabled. Enable it instead.'
          : 'Category already exists'
      });
    }

    const inserted = await pool.query(
      `INSERT INTO categories (name, description, type)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, COALESCE(type, 'agricultural') AS type, created_at`,
      [name, description || null, type || 'agricultural']
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.create',
      entity: 'categories',
      entity_id: inserted.rows[0].id,
      before: null,
      after: inserted.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'category.create', entity: 'categories', entity_id: inserted.rows[0].id, actor_admin_id: req.user.id });

    return res.status(201).json({ message: 'Category created', category: inserted.rows[0] });
  } catch (error) {
    console.error('Admin create category error:', error);
    if (error?.code === '23505') {
      return res.status(409).json({ message: 'Category already exists' });
    }
    return res.status(500).json({ message: 'Server error creating category' });
  }
});

router.put('/categories/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid category id' });

    const beforeRes = await pool.query(
      "SELECT id, name, description, COALESCE(type, 'agricultural') AS type, is_disabled FROM categories WHERE id = $1",
      [id]
    );
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Category not found' });

    const name = req.body?.name;
    const description = req.body?.description;
    const type = req.body?.type;

    const updates = [];
    const values = [];
    let idx = 1;

    if (typeof name !== 'undefined') {
      const trimmed = normalizeCategoryName(name);
      if (!trimmed) return res.status(400).json({ message: 'Category name cannot be empty' });
      // Only check for duplicates if the name is actually changing
      const currentName = beforeRes.rows[0].name;
      if (normalizeCategoryKey(trimmed) !== normalizeCategoryKey(currentName)) {
        const duplicate = await pool.query(
          'SELECT id FROM categories WHERE LOWER(name) = $1 AND id <> $2 LIMIT 1',
          [normalizeCategoryKey(trimmed), id]
        );
        if (duplicate.rows.length) {
          return res.status(409).json({ message: 'Category name already exists' });
        }
      }
      updates.push(`name = $${idx++}`);
      values.push(trimmed);
    }
    if (typeof description !== 'undefined') {
      updates.push(`description = $${idx++}`);
      values.push(String(description || '').trim() || null);
    }
    if (typeof type !== 'undefined') {
      updates.push(`type = $${idx++}`);
      values.push(String(type || 'agricultural').trim().toLowerCase());
    }

    if (!updates.length) return res.status(400).json({ message: 'No fields to update' });

    values.push(id);
    const updated = await pool.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, name, description, COALESCE(type, 'agricultural') AS type, created_at`,
      values
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.update',
      entity: 'categories',
      entity_id: id,
      before: beforeRes.rows[0],
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'category.update', entity: 'categories', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Category updated', category: updated.rows[0] });
  } catch (error) {
    console.error('Admin update category error:', error);
    if (error?.code === '23505') return res.status(409).json({ message: 'Category name already exists' });
    return res.status(500).json({ message: 'Server error updating category' });
  }
});

router.put('/categories/:id/disable', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid category id' });

    const beforeRes = await pool.query('SELECT id, name, is_disabled FROM categories WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Category not found' });

    await pool.query('UPDATE categories SET is_disabled = true WHERE id = $1', [id]);

    // Cascade disable: disable all products in this category
    const productsResult = await pool.query(
      'UPDATE products SET is_admin_disabled = true, admin_disabled_at = CURRENT_TIMESTAMP WHERE category_id = $1 RETURNING id, farmer_id, name',
      [id]
    );

    // Cancel orders for disabled products
    const productIds = productsResult.rows.map(p => p.id);
    const cancelledOrders = await cancelOrdersForProducts(pool, productIds, 'Category was disabled by admin');

    // Cascade disable: disable all product_name_catalog entries in this category
    await pool.query(
      'UPDATE product_name_catalog SET is_disabled = true WHERE category_id = $1',
      [id]
    );

    // Notify farmers whose products were disabled
    const affectedFarmers = new Map();
    productsResult.rows.forEach(p => {
      if (!affectedFarmers.has(p.farmer_id)) {
        affectedFarmers.set(p.farmer_id, []);
      }
      affectedFarmers.get(p.farmer_id).push(p.name);
    });

    for (const [farmerId, productNames] of affectedFarmers) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [farmerId, 'products_disabled', 'Products Disabled', `Your products have been disabled because their category was disabled by admin. Products: ${productNames.join(', ')}`]
      );
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.disable',
      entity: 'categories',
      entity_id: id,
      before: beforeRes.rows[0],
      after: { id, is_disabled: true },
      req
    });
    broadcastEvent('admin.audit', { action: 'category.disable', entity: 'categories', entity_id: id, actor_admin_id: req.user.id });

    // Broadcast product updates for realtime frontend refresh
    productsResult.rows.forEach(p => {
      broadcastEvent('product.updated', { product_id: p.id, is_admin_disabled: true });
    });

    return res.json({ message: 'Category disabled', products_disabled: productsResult.rows.length });
  } catch (error) {
    console.error('Admin disable category error:', error);
    return res.status(500).json({ message: 'Server error disabling category' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can delete categories' });
    }
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid category id' });

    const beforeRes = await pool.query('SELECT id, name, description, COALESCE(type, \'agricultural\') AS type, is_disabled FROM categories WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Category not found' });

    const usageResult = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE category_id = $1) AS product_count,
         (SELECT COUNT(*)::int FROM product_name_requests WHERE category_id = $1) AS request_count,
         (SELECT COUNT(*)::int FROM product_name_catalog WHERE category_id = $1) AS catalog_count`,
      [id]
    );
    const usage = usageResult.rows[0] || { product_count: 0, request_count: 0, catalog_count: 0 };

    // Get farmers who have products in this category
    const farmersResult = await pool.query(
      `SELECT DISTINCT u.id, u.username, u.full_name, u.email
       FROM products p
       JOIN users u ON p.farmer_id = u.id
       WHERE p.category_id = $1
       LIMIT 10`,
      [id]
    );

    const inUseCount = Number(usage.product_count || 0) + Number(usage.request_count || 0) + Number(usage.catalog_count || 0);

    // Cascade disable: disable all products in this category before deletion
    let productsDisabled = 0;
    if (usage.product_count > 0) {
      const productsResult = await pool.query(
        'UPDATE products SET is_admin_disabled = true, admin_disabled_at = CURRENT_TIMESTAMP WHERE category_id = $1 RETURNING id, farmer_id, name',
        [id]
      );
      productsDisabled = productsResult.rows.length;

      // Cancel orders for disabled products
      const productIds = productsResult.rows.map(p => p.id);
      const cancelledOrders = await cancelOrdersForProducts(pool, productIds, 'Category was deleted by admin');

      // Notify farmers whose products were disabled
      const affectedFarmers = new Map();
      productsResult.rows.forEach(p => {
        if (!affectedFarmers.has(p.farmer_id)) {
          affectedFarmers.set(p.farmer_id, []);
        }
        affectedFarmers.get(p.farmer_id).push(p.name);
      });

      for (const [farmerId, productNames] of affectedFarmers) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
          [farmerId, 'products_disabled', 'Products Disabled', `Your products have been disabled because their category was deleted by admin. Products: ${productNames.join(', ')}`]
        );
      }

      // Broadcast product updates for realtime frontend refresh
      productsResult.rows.forEach(p => {
        broadcastEvent('product.updated', { product_id: p.id, is_admin_disabled: true });
      });
    }

    // Cascade disable: disable all product_name_catalog entries in this category
    await pool.query(
      'UPDATE product_name_catalog SET is_disabled = true WHERE category_id = $1',
      [id]
    );

    // For requests and catalog, we still block deletion to avoid data loss
    const nonProductInUseCount = Number(usage.request_count || 0) + Number(usage.catalog_count || 0);
    if (nonProductInUseCount > 0) {
      const reasons = [];
      if (usage.request_count > 0) reasons.push(`${usage.request_count} request(s)`);
      if (usage.catalog_count > 0) reasons.push(`${usage.catalog_count} catalog name(s)`);
      return res.status(409).json({
        message: `Category cannot be deleted because it is still used by ${reasons.join(', ')}. Disable it instead.`
      });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.delete',
      entity: 'categories',
      entity_id: id,
      before: beforeRes.rows[0],
      after: null,
      req
    });
    broadcastEvent('admin.audit', { action: 'category.delete', entity: 'categories', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Category deleted', products_disabled: productsDisabled });
  } catch (error) {
    console.error('Admin delete category error:', error);
    return res.status(500).json({ message: 'Server error deleting category' });
  }
});

router.put('/categories/:id/enable', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid category id' });

    const beforeRes = await pool.query('SELECT id, name, is_disabled FROM categories WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Category not found' });

    await pool.query('UPDATE categories SET is_disabled = false WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.enable',
      entity: 'categories',
      entity_id: id,
      before: beforeRes.rows[0],
      after: { id, is_disabled: false },
      req
    });
    broadcastEvent('admin.audit', { action: 'category.enable', entity: 'categories', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Category enabled' });
  } catch (error) {
    console.error('Admin enable category error:', error);
    return res.status(500).json({ message: 'Server error enabling category' });
  }
});

router.get('/catalog-names', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const category = req.query.category ? Number(req.query.category) : null;
    const status = req.query.status ? String(req.query.status).trim() : null;

    const whereParts = [];
    const whereValues = [];
    let idx = 1;

    if (search) {
      whereParts.push(`c.name ILIKE $${idx}`);
      whereValues.push(`%${search}%`);
      idx++;
    }
    if (category) {
      whereParts.push(`c.category_id = $${idx}`);
      whereValues.push(category);
      idx++;
    }
    if (status === 'active') {
      whereParts.push(`COALESCE(c.is_disabled, false) = false`);
    } else if (status === 'disabled') {
      whereParts.push(`COALESCE(c.is_disabled, false) = true`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM product_name_catalog c ${whereSql}`, whereValues);
    const result = await pool.query(
      `SELECT c.id, c.name, c.category_id, cat.name AS category_name, c.is_approved, c.source, c.created_at, COALESCE(c.is_disabled, false) AS is_disabled,
              COALESCE(p.product_count, 0)::int AS product_count, c.admin_set_average_price, COALESCE(c.default_unit, 'kg') AS default_unit
       FROM product_name_catalog c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN (
         SELECT name, COUNT(*)::int AS product_count FROM products GROUP BY name
       ) p ON p.name = c.name
       ${whereSql}
       ORDER BY c.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...whereValues, limit, offset]
    );
    return res.json({ names: result.rows, total: totalRes.rows[0]?.count || 0, page, limit });
  } catch (error) {
    console.error('Admin get catalog names error:', error);
    return res.status(500).json({ message: 'Server error fetching catalog names' });
  }
});

router.post('/catalog-names', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const categoryId = Number(req.body?.category_id || 0);
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    // Get category name for notification
    const categoryResult = await pool.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
    const categoryName = categoryResult.rows[0]?.name || 'Unknown Category';

    const inserted = await pool.query(
      `INSERT INTO product_name_catalog (name, category_id, source, is_approved, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'admin', true, $3, CURRENT_TIMESTAMP)
       RETURNING id, name, category_id`,
      [name, categoryId, req.user.id || null]
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'catalog_name.create',
      entity: 'product_name_catalog',
      entity_id: inserted.rows[0].id,
      before: null,
      after: inserted.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'catalog_name.create', entity: 'product_name_catalog', entity_id: inserted.rows[0].id, actor_admin_id: req.user.id });

    // Notify all farmers about new catalog name
    const farmersResult = await pool.query(
      `SELECT id FROM users WHERE role = 'farmer' AND is_disabled = false`
    );
    for (const farmer of farmersResult.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [farmer.id, 'catalog_name_added', 'New Product Added to Catalog', `Admin added "${name}" to the ${categoryName} category. You can now use this product name for your products.`]
      );
      broadcastEvent('notification.created', { user_id: farmer.id });
    }

    return res.status(201).json({ message: 'Catalog name added', item: inserted.rows[0] });
  } catch (error) {
    console.error('Admin add catalog name error:', error);
    return res.status(500).json({ message: 'Server error adding catalog name' });
  }
});

router.put('/catalog-names/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const name = String(req.body?.name || '').trim();
    const categoryId = Number(req.body?.category_id || 0);
    const defaultUnit = String(req.body?.default_unit || 'kg').trim();
    const adminSetAveragePrice = req.body?.admin_set_average_price !== undefined ? req.body.admin_set_average_price : null;
    if (!id) return res.status(400).json({ message: 'Invalid catalog id' });
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    const beforeRes = await pool.query('SELECT * FROM product_name_catalog WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Catalog name not found' });

    const updated = await pool.query(
      `UPDATE product_name_catalog
       SET name = $1, category_id = $2, default_unit = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP, is_approved = true, admin_set_average_price = $5
       WHERE id = $6
       RETURNING id, name, category_id, default_unit, admin_set_average_price`,
      [name, categoryId, defaultUnit, req.user.id || null, adminSetAveragePrice, id]
    );

    if (!updated.rows.length) return res.status(404).json({ message: 'Catalog name not found' });

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'catalog_name.update',
      entity: 'product_name_catalog',
      entity_id: id,
      before: beforeRes.rows[0],
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'catalog_name.update', entity: 'product_name_catalog', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Catalog name updated', item: updated.rows[0] });
  } catch (error) {
    console.error('Admin edit catalog name error:', error);
    return res.status(500).json({ message: 'Server error updating catalog name' });
  }
});

router.patch('/catalog-names/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const isDisabled = req.body?.is_disabled;
    if (!id) return res.status(400).json({ message: 'Invalid catalog id' });
    if (isDisabled === undefined) return res.status(400).json({ message: 'is_disabled is required' });

    const beforeRes = await pool.query('SELECT * FROM product_name_catalog WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Catalog name not found' });

    const catalogName = beforeRes.rows[0].name;
    const updated = await pool.query(
      `UPDATE product_name_catalog
       SET is_disabled = $1
       WHERE id = $2
       RETURNING id, name, is_disabled`,
      [isDisabled, id]
    );

    if (!updated.rows.length) return res.status(404).json({ message: 'Catalog name not found' });

    // Cascade: disable/enable farmer products with this catalog name
    if (isDisabled) {
      const productsResult = await pool.query(
        `UPDATE products
         SET is_admin_disabled = true, admin_disabled_at = CURRENT_TIMESTAMP
         WHERE name = $1 AND is_admin_disabled = false
         RETURNING id, farmer_id, name`,
        [catalogName]
      );

      // Notify affected farmers
      const affectedFarmers = new Map();
      productsResult.rows.forEach(p => {
        if (!affectedFarmers.has(p.farmer_id)) {
          affectedFarmers.set(p.farmer_id, []);
        }
        affectedFarmers.get(p.farmer_id).push(p.name);
      });

      for (const [farmerId, productNames] of affectedFarmers) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
          [farmerId, 'products_disabled', 'Products Disabled', `Your products have been disabled because their catalog name was disabled by admin. Products: ${productNames.join(', ')}`]
        );
        broadcastEvent('notification.created', { user_id: farmerId });
      }

      // Broadcast updates for realtime frontend refresh
      productsResult.rows.forEach(p => {
        broadcastEvent('product.updated', { product_id: p.id, is_admin_disabled: true });
      });
    } else {
      // Enable: re-enable farmer products that were disabled due to this catalog name
      const productsResult = await pool.query(
        `UPDATE products
         SET is_admin_disabled = false, admin_disabled_at = NULL
         WHERE name = $1 AND is_admin_disabled = true
         RETURNING id, farmer_id, name`,
        [catalogName]
      );

      // Notify affected farmers
      const affectedFarmers = new Map();
      productsResult.rows.forEach(p => {
        if (!affectedFarmers.has(p.farmer_id)) {
          affectedFarmers.set(p.farmer_id, []);
        }
        affectedFarmers.get(p.farmer_id).push(p.name);
      });

      for (const [farmerId, productNames] of affectedFarmers) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
           VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
          [farmerId, 'products_enabled', 'Products Enabled', `Your products have been re-enabled because their catalog name was enabled by admin. Products: ${productNames.join(', ')}`]
        );
        broadcastEvent('notification.created', { user_id: farmerId });
      }

      // Broadcast updates for realtime frontend refresh
      productsResult.rows.forEach(p => {
        broadcastEvent('product.updated', { product_id: p.id, is_admin_disabled: false });
      });
    }

    const action = isDisabled ? 'catalog_name.disable' : 'catalog_name.enable';
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action,
      entity: 'product_name_catalog',
      entity_id: id,
      before: beforeRes.rows[0],
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action, entity: 'product_name_catalog', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Catalog name updated', item: updated.rows[0] });
  } catch (error) {
    console.error('Admin patch catalog name error:', error);
    return res.status(500).json({ message: 'Server error updating catalog name' });
  }
});

router.patch('/catalog-names/:id/average-price', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    const averagePrice = req.body?.average_price;
    if (!id) return res.status(400).json({ message: 'Invalid catalog id' });
    if (averagePrice === undefined || averagePrice === null || averagePrice === '') return res.status(400).json({ message: 'average_price is required' });
    const numPrice = Number(averagePrice);
    if (isNaN(numPrice) || numPrice < 0) return res.status(400).json({ message: 'average_price must be a valid number' });

    const beforeRes = await pool.query('SELECT * FROM product_name_catalog WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Catalog name not found' });

    const updated = await pool.query(
      `UPDATE product_name_catalog
       SET admin_set_average_price = $1
       WHERE id = $2
       RETURNING id, name, admin_set_average_price`,
      [numPrice, id]
    );

    if (!updated.rows.length) return res.status(404).json({ message: 'Catalog name not found' });

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'catalog_name.set_average_price',
      entity: 'product_name_catalog',
      entity_id: id,
      before: beforeRes.rows[0],
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'catalog_name.set_average_price', entity: 'product_name_catalog', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Average price updated', item: updated.rows[0] });
  } catch (error) {
    console.error('Admin set catalog average price error:', error);
    return res.status(500).json({ message: 'Server error setting average price' });
  }
});

router.delete('/catalog-names/:id', requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admins can delete catalog names' });
    }
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid catalog id' });

    const beforeRes = await pool.query('SELECT * FROM product_name_catalog WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Catalog name not found' });

    const catalogName = beforeRes.rows[0].name;

    // Disable all farmer products using this catalog name before deletion
    const productsResult = await pool.query(
      `UPDATE products
       SET is_admin_disabled = true, admin_disabled_at = CURRENT_TIMESTAMP
       WHERE name = $1 AND is_admin_disabled = false
       RETURNING id, farmer_id, name`,
      [catalogName]
    );

    // Notify affected farmers that their products are disabled (not deleted)
    const affectedFarmers = new Map();
    productsResult.rows.forEach(p => {
      if (!affectedFarmers.has(p.farmer_id)) {
        affectedFarmers.set(p.farmer_id, []);
      }
      affectedFarmers.get(p.farmer_id).push(p.name);
    });

    for (const [farmerId, productNames] of affectedFarmers) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [farmerId, 'products_disabled', 'Products Disabled', `Your products have been disabled because their catalog name was deleted by admin. Products: ${productNames.join(', ')}`]
      );
      broadcastEvent('notification.created', { user_id: farmerId });
    }

    // Broadcast updates for realtime frontend refresh
    productsResult.rows.forEach(p => {
      broadcastEvent('product.updated', { product_id: p.id, is_admin_disabled: true });
    });

    await pool.query('DELETE FROM product_name_catalog WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'catalog_name.delete',
      entity: 'product_name_catalog',
      entity_id: id,
      before: beforeRes.rows[0],
      after: null,
      req
    });
    broadcastEvent('admin.audit', { action: 'catalog_name.delete', entity: 'product_name_catalog', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Catalog name deleted' });
  } catch (error) {
    console.error('Admin delete catalog name error:', error);
    return res.status(500).json({ message: 'Server error deleting catalog name' });
  }
});

// Admin review queue for farmer custom product names
router.get('/category-requests', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = (page - 1) * limit;
    const status = String(req.query?.status || 'pending').trim().toLowerCase();
    const search = String(req.query?.search || '').trim().toLowerCase();
    const includeAll = status === 'all';

    const whereSql = `WHERE ($1::boolean OR r.status = $2)
         AND (
           $3 = ''
           OR LOWER(COALESCE(r.name, '')) LIKE $4
           OR LOWER(COALESCE(u.username, '')) LIKE $4
           OR LOWER(COALESCE(u.full_name, '')) LIKE $4
           OR LOWER(COALESCE(u.email, '')) LIKE $4
         )`;

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM product_name_requests r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN users u ON u.id = r.requested_by
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       ${whereSql}`,
      [includeAll, status, search, `%${search}%`]
    );

    const result = await pool.query(
          `SELECT r.id, r.name, r.notes, r.status, r.review_notes, r.created_at, r.reviewed_at,
            r.requested_category_name,
              r.category_id, c.name AS category_name,
              r.requested_by, u.username AS requested_by_username, u.full_name AS requested_by_full_name, u.email AS requested_by_email, u.shop_name AS requested_by_shop_name, u.address AS requested_by_address,
              r.reviewed_by, rv.username AS reviewed_by_username
       FROM product_name_requests r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN users u ON u.id = r.requested_by
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       ${whereSql}
       ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
       LIMIT $5 OFFSET $6`,
      [includeAll, status, search, `%${search}%`, limit, offset]
    );

    return res.json({ requests: result.rows, total: totalRes.rows[0]?.count || 0, page, limit });
  } catch (error) {
    console.error('Admin get category requests error:', error);
    return res.status(500).json({ message: 'Server error fetching requests' });
  }
});

router.put('/category-requests/:id/review', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid request id' });

    const status = String(req.body?.status || '').trim().toLowerCase();
    const nextStatus = ['pending', 'approved', 'rejected'].includes(status) ? status : null;
    if (!nextStatus) return res.status(400).json({ message: 'Status must be pending, approved, or rejected' });

    const rowRes = await pool.query('SELECT * FROM product_name_requests WHERE id = $1', [id]);
    if (!rowRes.rows.length) return res.status(404).json({ message: 'Request not found' });
    const requestRow = rowRes.rows[0];
    if (String(requestRow.status) !== 'pending') {
      return res.status(400).json({ message: 'Request already reviewed' });
    }

    const nextName = String(req.body?.name || requestRow.name).trim();
    let nextCategoryId = Number(req.body?.category_id || requestRow.category_id || 0);
    const requestedCategoryName = String(req.body?.requested_category_name || requestRow.requested_category_name || '').trim();
    const newCategoryName = String(req.body?.new_category_name || '').trim();
    const reviewNotes = String(req.body?.review_notes || '').trim();
    const reviewerId = Number(req.user?.id || 0) > 0 ? Number(req.user.id) : null;

    if (newCategoryName) {
      const normalizedName = normalizeCategoryName(newCategoryName);
      const existingCategory = await pool.query(
        'SELECT id, is_disabled FROM categories WHERE LOWER(name) = $1 LIMIT 1',
        [normalizeCategoryKey(normalizedName)]
      );
      if (existingCategory.rows.length) {
        nextCategoryId = Number(existingCategory.rows[0]?.id || 0);
        if (existingCategory.rows[0]?.is_disabled) {
          await pool.query('UPDATE categories SET is_disabled = false WHERE id = $1', [nextCategoryId]);
        }
      } else {
        const createdCategory = await pool.query(
          `INSERT INTO categories (name, description, type)
           VALUES ($1, $2, 'agricultural')
           RETURNING id`,
          [normalizedName, `${normalizedName} category`]
        );
        nextCategoryId = Number(createdCategory.rows[0]?.id || 0);
      }
    }

    if (nextStatus === 'approved') {
      if (!nextName) return res.status(400).json({ message: 'Approved name is required' });
      if (!nextCategoryId) return res.status(400).json({ message: 'Approved category is required' });

      await pool.query(
        `INSERT INTO product_name_catalog (category_id, name, source, is_approved, requested_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, 'request', true, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (name)
         DO UPDATE SET category_id = EXCLUDED.category_id, is_approved = true, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at`,
        [nextCategoryId, nextName, requestRow.requested_by || null, reviewerId]
      );
    }

    let updated;
    if (nextStatus === 'pending') {
      updated = await pool.query(
        `UPDATE product_name_requests
         SET name = $1,
             category_id = $2,
             requested_category_name = $3,
             review_notes = $4
         WHERE id = $5
         RETURNING *`,
        [nextName, nextCategoryId || null, requestedCategoryName || null, reviewNotes || null, id]
      );
    } else {
      updated = await pool.query(
        `UPDATE product_name_requests
         SET status = $1,
             name = $2,
             category_id = $3,
             requested_category_name = $4,
             review_notes = $5,
             reviewed_by = $6,
             reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [nextStatus, nextName, nextCategoryId || null, requestedCategoryName || null, reviewNotes || null, reviewerId, id]
      );
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.request.review',
      entity: 'category_requests',
      entity_id: id,
      before: requestRow,
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'category.request.review', entity: 'category_requests', entity_id: id, actor_admin_id: req.user.id });

    // Send notification to farmer about request approval/rejection
    if (nextStatus !== 'pending' && requestRow.requested_by) {
      const notificationType = nextStatus === 'approved' ? 'category_request_approved' : 'category_request_rejected';
      const notificationTitle = nextStatus === 'approved' ? 'Product Name Request Approved' : 'Product Name Request Rejected';
      const notificationMessage = nextStatus === 'approved' 
        ? `Your custom product name request "${nextName}" has been approved and added to the catalog.`
        : `Your custom product name request "${nextName}" has been rejected. ${reviewNotes ? `Reason: ${reviewNotes}` : ''}`;
      
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, CURRENT_TIMESTAMP)`,
        [requestRow.requested_by, notificationType, notificationTitle, notificationMessage]
      );
      broadcastEvent('notification.created', { user_id: requestRow.requested_by });
    }

    const actionLabel = nextStatus === 'pending' ? 'saved' : nextStatus;
    return res.json({ message: `Request ${actionLabel}`, request: updated.rows[0] });
  } catch (error) {
    console.error('Admin review category request error:', error);
    return res.status(500).json({ message: 'Server error reviewing request' });
  }
});

// Get order details
router.get('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Per-item orders: order directly contains product info
    const result = await pool.query(`
      SELECT o.*,
             u.username, u.email, u.full_name as customer_name, u.phone as customer_phone,
             p.name as product_name,
             p.unit,
             p.image_url,
             p.is_preorder,
             p.preorder_availability_date,
             p.reserved_quantity,
             p.max_preorder_quantity,
             p.harvest_date,
             f.full_name as farmer_name,
             f.username as farmer_username,
             f.email as farmer_email,
             f.shop_name as farmer_shop_name,
             f.address as farmer_address
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users f ON p.farmer_id = f.id
      WHERE o.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Format for per-item order
    const row = result.rows[0];
    const order = {
      ...row,
      items: [{
        id: row.id,
        order_item_id: row.id,
        product_id: row.product_id,
        product_name: row.product_name,
        quantity: row.quantity,
        price: row.price,
        unit: row.unit,
        image_url: row.image_url,
        farmer_id: row.farmer_id || null,
        farmer_name: row.farmer_name,
        farmer_email: row.farmer_email,
        status: row.status,
        delivered_at: row.delivered_at,
        harvest_date: row.harvest_date || null,
        is_preorder: row.is_preorder || false,
        reserved_quantity: row.reserved_quantity || 0,
        max_preorder_quantity: row.max_preorder_quantity || 0
      }]
    };

    res.json({ order });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ message: 'Server error fetching order details' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ANALYTICS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

const getPeriodFilter = (period, alias = 'o', useSimpleTimeRef = false) => {
  // Use same time reference as farmer metrics: delivered orders use updated_at (delivery date)
  // For tables without status field (like users), use simple created_at reference
  const timeRef = useSimpleTimeRef 
    ? (alias ? `${alias}.created_at` : 'created_at')
    : (alias ? `CASE WHEN ${alias}.status = 'delivered' THEN COALESCE(${alias}.updated_at, ${alias}.created_at) ELSE ${alias}.created_at END` : `CASE WHEN status = 'delivered' THEN COALESCE(updated_at, created_at) ELSE created_at END`);
  switch (period) {
    case 'today':    return `DATE(${timeRef}) = CURRENT_DATE`;
    case 'week':     return `${timeRef} >= DATE_TRUNC('week', CURRENT_DATE)`;
    case 'month':    return `${timeRef} >= DATE_TRUNC('month', CURRENT_DATE)`;
    case 'year':     return `${timeRef} >= DATE_TRUNC('year', CURRENT_DATE)`;
    default:         return '1=1'; // all time
  }
};

const getAuditLogPeriodFilter = (period, alias = 'al') => {
  // Simple period filter for audit logs (just uses created_at)
  const timeRef = alias ? `${alias}.created_at` : 'created_at';
  switch (period) {
    case 'today':    return `DATE(${timeRef}) = CURRENT_DATE`;
    case 'week':     return `${timeRef} >= DATE_TRUNC('week', CURRENT_DATE)`;
    case 'month':    return `${timeRef} >= DATE_TRUNC('month', CURRENT_DATE)`;
    case 'year':     return `${timeRef} >= DATE_TRUNC('year', CURRENT_DATE)`;
    default:         return '1=1'; // all time
  }
};

const getPrevPeriodFilter = (period, alias = 'o', useSimpleTimeRef = false) => {
  // Use same time reference as farmer metrics: delivered orders use updated_at (delivery date)
  // For tables without status field (like users), use simple created_at reference
  const timeRef = useSimpleTimeRef 
    ? (alias ? `${alias}.created_at` : 'created_at')
    : (alias ? `CASE WHEN ${alias}.status = 'delivered' THEN COALESCE(${alias}.updated_at, ${alias}.created_at) ELSE ${alias}.created_at END` : `CASE WHEN status = 'delivered' THEN COALESCE(updated_at, created_at) ELSE created_at END`);
  switch (period) {
    case 'today':  return `DATE(${timeRef}) = CURRENT_DATE - INTERVAL '1 day'`;
    case 'week':   return `${timeRef} >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND ${timeRef} < DATE_TRUNC('week', CURRENT_DATE)`;
    case 'month':  return `${timeRef} >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND ${timeRef} < DATE_TRUNC('month', CURRENT_DATE)`;
    case 'year':   return `${timeRef} >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' AND ${timeRef} < DATE_TRUNC('year', CURRENT_DATE)`;
    default:       return '1=0';
  }
};

// GET /api/admin/stats?period=today|week|month|year|all
// Extended with period support + % change
router.get('/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const metric = req.query.metric || 'all';
    const cacheBust = req.query._t || '';
    const cacheKey = `dashboard_stats_${period}_${metric}_${cacheBust}`;
    const cached = adminCache.get(cacheKey);
    if (cached) return res.json(cached);

    const periodFilter = getPeriodFilter(period, 'o');
    const prevFilter   = getPrevPeriodFilter(period, 'o');
    const userPeriodFilter = getPeriodFilter(period, 'u', true); // Use simple time ref for users table
    const userPrevFilter   = getPrevPeriodFilter(period, 'u', true); // Use simple time ref for users table

    const [salesRes, prevSalesRes, revenueRes, prevRevenueRes, custRes, prevCustRes, farmerRes, prevFarmerRes, harvestRes, prevHarvestRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count FROM orders o WHERE ${periodFilter} AND o.status != 'cancelled'`),
      pool.query(`SELECT COUNT(*) AS count FROM orders o WHERE ${prevFilter} AND o.status != 'cancelled'`),
      pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS total FROM orders o WHERE ${periodFilter} AND o.status NOT IN ('cancelled','disabled')`),
      pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS total FROM orders o WHERE ${prevFilter} AND o.status NOT IN ('cancelled','disabled')`),
      pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'customer' AND ${userPeriodFilter}`),
      pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'customer' AND ${userPrevFilter}`),
      pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'farmer' AND ${userPeriodFilter}`),
      pool.query(`SELECT COUNT(*) AS count FROM users u WHERE u.role = 'farmer' AND ${userPrevFilter}`),
      pool.query(`SELECT COUNT(*) AS count FROM products p WHERE p.is_available = true AND p.harvest_date IS NOT NULL AND p.harvest_date < CURRENT_DATE`),
      pool.query(`SELECT COUNT(*) AS count FROM products p WHERE p.is_available = true AND p.harvest_date IS NOT NULL AND p.harvest_date < CURRENT_DATE`),
    ]);

    const calcChange = (curr, prev) => {
      const c = parseFloat(curr) || 0;
      const p = parseFloat(prev) || 0;
      if (p === 0) return c > 0 ? 100 : 0;
      return Math.round(((c - p) / p) * 100);
    };

    const sales   = parseInt(salesRes.rows[0].count);
    const prevSales = parseInt(prevSalesRes.rows[0].count);
    const revenue = parseFloat(revenueRes.rows[0].total);
    const prevRevenue = parseFloat(prevRevenueRes.rows[0].total);
    const customers = parseInt(custRes.rows[0].count);
    const prevCustomers = parseInt(prevCustRes.rows[0].count);
    const farmers = parseInt(farmerRes.rows[0].count);
    const prevFarmers = parseInt(prevFarmerRes.rows[0].count);
    const harvestAttention = parseInt(harvestRes.rows[0].count);
    const prevHarvestAttention = parseInt(prevHarvestRes.rows[0].count);

    const result = {
      stats: {
        sales,   salesChange: calcChange(sales, prevSales),
        revenue, revenueChange: calcChange(revenue, prevRevenue),
        customers, customersChange: calcChange(customers, prevCustomers),
        farmers, farmersChange: calcChange(farmers, prevFarmers),
        harvest_attention: harvestAttention, harvest_attentionChange: calcChange(harvestAttention, prevHarvestAttention),
      }
    };
    adminCache.set(cacheKey, result, 2 * 60 * 1000); // 2 min cache
    res.json(result);
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/dashboard/report?period=today|week|month|year|all
// Returns time-series data for the Reports area chart
router.get('/dashboard/report', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const cacheBust = req.query._t || '';
    const cacheKey = `dashboard_report_${period}_${cacheBust}`;
    const cached = adminCache.get(cacheKey);
    if (cached) return res.json(cached);

    // Use same time reference as farmer metrics: delivered orders use updated_at (delivery date)
    const timeRef = `CASE WHEN o.status = 'delivered' THEN COALESCE(o.updated_at, o.created_at) ELSE o.created_at END`;

    let groupExpr, filterExpr;
    if (period === 'today') {
      groupExpr = `DATE_TRUNC('hour', ${timeRef})`;
      filterExpr = `DATE(${timeRef}) = CURRENT_DATE`;
    } else if (period === 'week') {
      groupExpr = `DATE(${timeRef})`;
      filterExpr = `${timeRef} >= DATE_TRUNC('week', CURRENT_DATE)`;
    } else if (period === 'month') {
      groupExpr = `DATE(${timeRef})`;
      filterExpr = `${timeRef} >= DATE_TRUNC('month', CURRENT_DATE)`;
    } else if (period === 'year') {
      groupExpr = `DATE_TRUNC('month', ${timeRef})`;
      filterExpr = `${timeRef} >= DATE_TRUNC('year', CURRENT_DATE)`;
    } else {
      // 'all' - show all data grouped by month
      groupExpr = `DATE_TRUNC('month', ${timeRef})`;
      filterExpr = '1=1';
    }

    const sql = `
      SELECT
        ${groupExpr} AS period_label,
        COUNT(*) FILTER (WHERE o.status != 'cancelled') AS sales,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status NOT IN ('cancelled','disabled')), 0) AS revenue
      FROM orders o
      WHERE ${filterExpr}
        AND COALESCE(o.is_disabled, false) = false
      GROUP BY ${groupExpr}
      HAVING COUNT(*) FILTER (WHERE o.status != 'cancelled') > 0
      ORDER BY ${groupExpr} ASC
    `;
    const [rowsRes, totalCustomersRes, totalFarmersRes] = await Promise.all([
      pool.query(sql),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND COALESCE(is_disabled, false) = false"),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'farmer' AND COALESCE(is_disabled, false) = false")
    ]);
    const rows = rowsRes.rows;
    const totalCustomers = parseInt(totalCustomersRes.rows[0]?.count || 0, 10);
    const totalFarmers = parseInt(totalFarmersRes.rows[0]?.count || 0, 10);

    const data = rows.map(r => ({
      label: r.period_label,
      sales: parseInt(r.sales) || 0,
      revenue: parseFloat(r.revenue) || 0,
      customers: totalCustomers,
      farmers: totalFarmers,
    }));

    const result = { data };
    adminCache.set(cacheKey, result, 60 * 1000); // 1 min
    res.json(result);
  } catch (err) {
    console.error('Dashboard report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/dashboard/top-products?period=today|week|month|year
router.get('/dashboard/top-products', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const offset = (page - 1) * limit;
    const cacheBust = req.query._t || '';
    const cacheKey = `top_products_${period}_${page}_${limit}_${cacheBust}`;
    const cached = adminCache.get(cacheKey);
    if (cached) return res.json(cached);

    const filterExpr = getPeriodFilter(period, 'o');
    const totalSql = `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT p.id
        FROM products p
        JOIN orders o ON o.product_id = p.id
        WHERE o.status NOT IN ('cancelled') AND ${filterExpr}
        GROUP BY p.id
      ) grouped_products
    `;
    const sql = `
      SELECT
        p.id, p.name, p.price, p.image_url,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.quantity), 0) AS sold_count,
        COALESCE(SUM(o.total_amount), 0) AS revenue
      FROM products p
      JOIN orders o ON o.product_id = p.id
      WHERE o.status NOT IN ('cancelled') AND ${filterExpr}
      GROUP BY p.id, p.name, p.price, p.image_url
      ORDER BY sold_count DESC
      LIMIT $1 OFFSET $2
    `;
    const [totalRes, rowsRes] = await Promise.all([
      pool.query(totalSql),
      pool.query(sql, [limit, offset])
    ]);
    const rows = rowsRes.rows;
    const result = {
      products: rows.map(r => ({ ...r, sold_count: parseInt(r.sold_count, 10), revenue: parseFloat(r.revenue) })),
      total: totalRes.rows[0]?.count || 0,
      page,
      limit,
    };
    adminCache.set(cacheKey, result, 2 * 60 * 1000);
    res.json(result);
  } catch (err) {
    console.error('Top products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/dashboard/top-farmers?period=today|week|month|year
router.get('/dashboard/top-farmers', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const offset = (page - 1) * limit;
    const cacheBust = req.query._t || '';
    const cacheKey = `top_farmers_${period}_${page}_${limit}_${cacheBust}`;
    const cached = adminCache.get(cacheKey);
    if (cached) return res.json(cached);

    const filterExpr = getPeriodFilter(period, 'o');
    const totalSql = `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT u.id
        FROM users u
        JOIN products p ON p.farmer_id = u.id
        JOIN orders o ON o.product_id = p.id
        WHERE u.role = 'farmer' AND ${filterExpr}
        GROUP BY u.id
      ) grouped_farmers
    `;
    const sql = `
      SELECT
        u.id, u.full_name, u.username, u.email,
        u.shop_name,
        u.shop_avatar_url,
        u.average_rating,
        COUNT(DISTINCT p.id) AS product_count,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0) AS revenue
      FROM users u
      JOIN products p ON p.farmer_id = u.id
      JOIN orders o ON o.product_id = p.id
      WHERE u.role = 'farmer' AND ${filterExpr}
      GROUP BY u.id, u.full_name, u.username, u.email, u.shop_name, u.shop_avatar_url, u.average_rating
      ORDER BY revenue DESC
      LIMIT $1 OFFSET $2
    `;
    const [totalRes, rowsRes] = await Promise.all([
      pool.query(totalSql),
      pool.query(sql, [limit, offset])
    ]);
    const rows = rowsRes.rows;
    const result = {
      farmers: rows.map(r => ({ ...r, product_count: parseInt(r.product_count, 10), order_count: parseInt(r.order_count, 10), revenue: parseFloat(r.revenue) })),
      total: totalRes.rows[0]?.count || 0,
      page,
      limit,
    };
    adminCache.set(cacheKey, result, 2 * 60 * 1000);
    res.json(result);
  } catch (err) {
    console.error('Top farmers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/dashboard/recent-activity?period=today|week|month|year
router.get('/dashboard/recent-activity', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || 'today';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const offset = (page - 1) * limit;
    const cacheBust = req.query._t || '';
    const cacheKey = `recent_activity_${req.user.role}_${req.user.id}_${period}_${page}_${limit}_${cacheBust}`;
    const cached = adminCache.get(cacheKey);
    if (cached) return res.json(cached);

    const filterExpr = getAuditLogPeriodFilter(period, 'al');
    
    // Admin role: only see own activity, exclude login/logout logs
    // Superadmin role: see all activity
    let roleFilter = '';
    if (req.user.role === 'admin') {
      roleFilter = `AND al.actor_admin_id = ${req.user.id} AND al.action NOT IN ('login.success', 'login.failed', 'logout.success')`;
    }
    
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM admin_audit_logs al
      WHERE ${filterExpr} ${roleFilter}
    `;
    const sql = `
      SELECT al.id, al.action, al.entity, al.entity_id, al.created_at,
             al.actor_admin_name, al.actor_admin_email
      FROM admin_audit_logs al
      WHERE ${filterExpr} ${roleFilter}
      ORDER BY al.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    let rows = [];
    let total = 0;
    try {
      const [countRes, rowsRes] = await Promise.all([
        pool.query(countSql),
        pool.query(sql, [limit, offset])
      ]);
      rows = rowsRes.rows;
      total = countRes.rows[0]?.count || 0;
    } catch (_) {
      rows = [];
      total = 0;
    }

    const humanize = (action) => {
      const map = {
        'user.create': 'Created user', 'user.update': 'Updated user',
        'user.disable': 'Disabled user', 'user.enable': 'Enabled user',
        'user.verify': 'Verified farmer', 'user.unverify': 'Unverified farmer',
        'user.shop_profile.update': 'Updated shop profile',
        'user.generate_temp_password': 'Generated temp password',
        'user.role.update': 'Updated user role',
        'user.login': 'Admin login',
        'product.create': 'Added product', 'product.update': 'Updated product',
        'product.disable': 'Disabled product', 'product.enable': 'Enabled product',
        'product.assign': 'Reassigned product',
        'order.status.update': 'Updated order status', 'order.disable': 'Disabled order',
        'order.enable': 'Enabled order',
        'category.create': 'Created category', 'category.update': 'Updated category',
        'category.disable': 'Disabled category', 'category.enable': 'Enabled category',
        'category.delete': 'Deleted category',
        'catalog_name.create': 'Added catalog name', 'catalog_name.update': 'Updated catalog name',
        'catalog_name.disable': 'Disabled catalog name', 'catalog_name.enable': 'Enabled catalog name',
        'category.request.review': 'Reviewed name request',
        'announcement.broadcast': 'Broadcast announcement',
        'announcement.delete': 'Deleted announcement',
        'settings.update': 'Updated settings',
        'feature_flag.update': 'Updated feature flag',
      };
      return map[action] || action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const getColor = (action) => {
      if (action.includes('unverify') || action.includes('disable') || action.includes('reject') || action.includes('delete')) return 'danger';
      if (action.includes('create') || action.includes('verify') || action.includes('approve') || action.includes('enable')) return 'success';
      if (action.includes('update') || action.includes('status')) return 'primary';
      if (action.includes('login')) return 'info';
      return 'secondary';
    };

    const activity = rows.map(r => ({
      id: r.id, action: r.action, entity: r.entity, entity_id: r.entity_id,
      description: r.entity_id
        ? `${humanize(r.action)} (${r.entity} #${r.entity_id})`
        : `${humanize(r.action)} (${r.entity})`,
      actor: r.actor_admin_name || r.actor_admin_email || 'Admin',
      created_at: r.created_at, color: getColor(r.action),
    }));

    const result = { activity, total, page, limit };
    adminCache.set(cacheKey, result, 60 * 1000);
    res.json(result);
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/customers/:id/summary
router.get('/customers/:id/summary', requireAdmin, async (req, res) => {
  try {
    const userColumns = await getTableColumns('users');
    const customerId = parseInt(req.params.id, 10);
    if (!customerId) return res.status(400).json({ message: 'Invalid customer id' });

    const customerFields = [
      'id',
      'username',
      'email',
      'full_name',
      'first_name',
      'middle_name',
      'last_name',
      'phone',
      'address',
      'role',
      'is_verified',
      'is_disabled',
      'disable_type',
      'disabled_reason',
      'customer_average_rating',
      'created_at'
    ].filter((field) => userColumns.has(field));

    const [userRes, ordersRes, addressesRes, ratingRes] = await Promise.all([
      pool.query(`SELECT ${customerFields.join(', ')} FROM users WHERE id = $1`, [customerId]),
      pool.query(`SELECT o.id, o.status, o.total_amount, o.created_at, o.is_disabled,
                         p.name AS product_name, p.image_url AS product_image,
                         u.full_name AS farmer_name, u.shop_name AS farmer_shop_name, u.username AS farmer_username, u.address AS farmer_address
                  FROM orders o
                  LEFT JOIN products p ON o.product_id = p.id
                  LEFT JOIN users u ON p.farmer_id = u.id
                  WHERE o.user_id = $1
                  ORDER BY o.created_at DESC LIMIT 50`, [customerId]),
      pool.query(`SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC`, [customerId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS total_spent, COUNT(*) AS total_orders
                  FROM orders o WHERE o.user_id = $1 AND o.status = 'delivered'`, [customerId]),
    ]);

    if (!userRes.rows.length) return res.status(404).json({ message: 'Customer not found' });

    res.json({
      user: userRes.rows[0],
      orders: ordersRes.rows,
      addresses: addressesRes.rows,
      total_spent: parseFloat(ratingRes.rows[0].total_spent) || 0,
      total_orders: parseInt(ratingRes.rows[0].total_orders) || 0,
    });
  } catch (err) {
    console.error('Customer summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/farmers/:id/summary
router.get('/farmers/:id/summary', requireAdmin, async (req, res) => {
  try {
    const userColumns = await getTableColumns('users');
    const farmerId = parseInt(req.params.id, 10);
    if (!farmerId) return res.status(400).json({ message: 'Invalid farmer id' });

    const farmerFields = [
      'id',
      'username',
      'email',
      'full_name',
      'first_name',
      'middle_name',
      'last_name',
      'phone',
      'address',
      'is_verified',
      'is_disabled',
      'disable_type',
      'disabled_reason',
      'average_rating',
      'total_reviews',
      'shop_name',
      'shop_description',
      'shop_avatar_url',
      'shop_banner_url',
      'created_at'
    ].filter((field) => userColumns.has(field));

    const [userRes, productsRes, reviewsRes, revenueRes] = await Promise.all([
      pool.query(`SELECT ${farmerFields.join(', ')} FROM users WHERE id = $1 AND role = 'farmer'`, [farmerId]),
      pool.query(`SELECT p.id, p.name, p.price, p.stock_quantity, p.image_url, p.is_available, p.is_admin_disabled,
                         p.sales_count, cat.name AS category_name
                  FROM products p
                  LEFT JOIN categories cat ON p.category_id = cat.id
                  WHERE p.farmer_id = $1
                  ORDER BY p.created_at DESC`, [farmerId]),
      pool.query(`SELECT r.id, r.rating, r.comment, r.created_at,
                         u.full_name AS customer_name, u.username AS customer_username,
                         p.name AS product_name
                  FROM reviews r
                  JOIN users u ON r.user_id = u.id
                  JOIN products p ON r.product_id = p.id
                  WHERE p.farmer_id = $1
                  ORDER BY r.created_at DESC LIMIT 20`, [farmerId]),
      pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS revenue, COUNT(o.id) AS order_count
                  FROM orders o
                  JOIN products p ON o.product_id = p.id
                  WHERE p.farmer_id = $1 AND o.status = 'delivered'`, [farmerId]),
    ]);

    if (!userRes.rows.length) return res.status(404).json({ message: 'Farmer not found' });

    res.json({
      farmer: userRes.rows[0],
      products: productsRes.rows,
      reviews: reviewsRes.rows,
      revenue: parseFloat(revenueRes.rows[0].revenue) || 0,
      order_count: parseInt(revenueRes.rows[0].order_count) || 0,
    });
  } catch (err) {
    console.error('Farmer summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Extended disable/suspend/ban user — supports disable_type
router.put('/users/:id/suspend', requireAdmin, async (req, res) => {
  req.body = { ...req.body, disable_type: 'suspended' };
  return disableUserHandler(req, res);
});

// GET /api/admin/suspicious-patterns - Detect suspicious behavioral patterns with pagination
router.get('/suspicious-patterns', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Pattern 1: Customers who only order from one farmer with 5-star ratings
    const [singleFarmerPattern, singleFarmerCount] = await Promise.all([
      pool.query(`
        SELECT 
          o.user_id,
          u.username,
          u.email,
          u.full_name,
          COUNT(*) as order_count,
          COUNT(DISTINCT p.farmer_id) as unique_farmers,
          AVG(r.rating) as avg_rating,
          COUNT(r.id) as review_count,
          p.farmer_id as primary_farmer_id,
          f.username as farmer_username,
          f.email as farmer_email
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN products p ON o.product_id = p.id
        LEFT JOIN reviews r ON r.product_id = p.id AND r.user_id = o.user_id
        LEFT JOIN users f ON p.farmer_id = f.id
        WHERE u.role = 'customer'
        GROUP BY o.user_id, u.username, u.email, u.full_name, p.farmer_id, f.username, f.email
        HAVING COUNT(*) >= 3 
          AND AVG(r.rating) >= 4.5
          AND COUNT(DISTINCT p.farmer_id) = 1
        ORDER BY order_count DESC, avg_rating DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      pool.query(`
        SELECT COUNT(*) as total
        FROM (
          SELECT o.user_id
          FROM orders o
          JOIN users u ON o.user_id = u.id
          JOIN products p ON o.product_id = p.id
          LEFT JOIN reviews r ON r.product_id = p.id AND r.user_id = o.user_id
          WHERE u.role = 'customer'
          GROUP BY o.user_id
          HAVING COUNT(*) >= 3 
            AND AVG(r.rating) >= 4.5
            AND COUNT(DISTINCT p.farmer_id) = 1
        ) as sub
      `)
    ]);

    // Pattern 2: Customers with same phone as farmers
    const [samePhonePattern, samePhoneCount] = await Promise.all([
      pool.query(`
        SELECT 
          c.id as customer_id,
          c.username as customer_username,
          c.email as customer_email,
          c.phone,
          f.id as farmer_id,
          f.username as farmer_username,
          f.email as farmer_email
        FROM users c
        JOIN users f ON c.phone = f.phone AND c.phone IS NOT NULL AND c.phone != ''
        WHERE c.role = 'customer' AND f.role = 'farmer' AND c.id != f.id
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      pool.query(`
        SELECT COUNT(*) as total
        FROM users c
        JOIN users f ON c.phone = f.phone AND c.phone IS NOT NULL AND c.phone != ''
        WHERE c.role = 'customer' AND f.role = 'farmer' AND c.id != f.id
      `)
    ]);

    // Pattern 3: Similar email patterns (farmer+dummy@gmail.com)
    const [similarEmailPattern, similarEmailCount] = await Promise.all([
      pool.query(`
        SELECT 
          c.id as customer_id,
          c.username as customer_username,
          c.email as customer_email,
          f.id as farmer_id,
          f.username as farmer_username,
          f.email as farmer_email
        FROM users c
        JOIN users f ON 
          (c.email LIKE f.email || '+%' OR 
           c.email LIKE '%' || SUBSTRING(f.email FROM POSITION('@' IN f.email)) OR
           f.email LIKE c.email || '+%' OR
           f.email LIKE '%' || SUBSTRING(c.email FROM POSITION('@' IN c.email)))
        WHERE c.role = 'customer' AND f.role = 'farmer' AND c.id != f.id
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      pool.query(`
        SELECT COUNT(*) as total
        FROM users c
        JOIN users f ON 
          (c.email LIKE f.email || '+%' OR 
           c.email LIKE '%' || SUBSTRING(f.email FROM POSITION('@' IN f.email)) OR
           f.email LIKE c.email || '+%' OR
           f.email LIKE '%' || SUBSTRING(c.email FROM POSITION('@' IN c.email)))
        WHERE c.role = 'customer' AND f.role = 'farmer' AND c.id != f.id
      `)
    ]);

    res.json({
      single_farmer_pattern: singleFarmerPattern.rows,
      same_phone_pattern: samePhonePattern.rows,
      similar_email_pattern: similarEmailPattern.rows,
      pagination: {
        page,
        limit,
        single_farmer_total: parseInt(singleFarmerCount.rows[0].total),
        same_phone_total: parseInt(samePhoneCount.rows[0].total),
        similar_email_total: parseInt(similarEmailCount.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Suspicious patterns detection error:', error);
    res.status(500).json({ message: 'Server error detecting suspicious patterns' });
  }
});

// POST /api/admin/users/:id/flag - Flag a user for review
router.post('/users/:id/flag', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ message: 'Invalid user id' });

    const { reason } = req.body;
    if (!reason || String(reason).trim() === '') {
      return res.status(400).json({ message: 'Flag reason is required' });
    }

    const userResult = await pool.query('SELECT id, username, is_flagged FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const before = userResult.rows[0];

    await pool.query(
      `UPDATE users 
       SET is_flagged = true, 
           flag_reason = $1, 
           flagged_at = CURRENT_TIMESTAMP, 
           flagged_by = $2 
       WHERE id = $3`,
      [String(reason).trim(), req.user.id, userId]
    );

    const afterResult = await pool.query('SELECT id, username, is_flagged, flag_reason, flagged_at FROM users WHERE id = $1', [userId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.flag',
      entity: 'users',
      entity_id: userId,
      before,
      after: afterResult.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'user.flag', entity: 'users', entity_id: userId, actor_admin_id: req.user.id });

    res.json({ message: 'User flagged successfully', user: afterResult.rows[0] });
  } catch (error) {
    console.error('Flag user error:', error);
    res.status(500).json({ message: 'Server error flagging user' });
  }
});

// POST /api/admin/users/:id/unflag - Remove flag from a user
router.post('/users/:id/unflag', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ message: 'Invalid user id' });

    const userResult = await pool.query('SELECT id, username, is_flagged, flag_reason FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const before = userResult.rows[0];

    await pool.query(
      `UPDATE users 
       SET is_flagged = false, 
           flag_reason = NULL, 
           flagged_at = NULL, 
           flagged_by = NULL 
       WHERE id = $1`,
      [userId]
    );

    const afterResult = await pool.query('SELECT id, username, is_flagged FROM users WHERE id = $1', [userId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.unflag',
      entity: 'users',
      entity_id: userId,
      before,
      after: afterResult.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'user.unflag', entity: 'users', entity_id: userId, actor_admin_id: req.user.id });

    res.json({ message: 'User unflagged successfully', user: afterResult.rows[0] });
  } catch (error) {
    console.error('Unflag user error:', error);
    res.status(500).json({ message: 'Server error unflagging user' });
  }
});

// GET /api/admin/flagged-users - Get all flagged users with pagination
router.get('/flagged-users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const [result, countResult] = await Promise.all([
      pool.query(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.role,
          u.phone,
          u.is_flagged,
          u.flag_reason,
          u.flagged_at,
          u.is_disabled,
          u.disabled_reason,
          a.username as flagged_by_username,
          u.created_at
        FROM users u
        LEFT JOIN users a ON u.flagged_by = a.id
        WHERE u.is_flagged = true
        ORDER BY u.flagged_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      pool.query(`
        SELECT COUNT(*) as total
        FROM users u
        WHERE u.is_flagged = true
      `)
    ]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      flagged_users: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get flagged users error:', error);
    res.status(500).json({ message: 'Server error fetching flagged users' });
  }
});

router.put('/users/:id/ban', requireAdmin, async (req, res) => {
  req.body = { ...req.body, disable_type: 'banned' };
  return disableUserHandler(req, res);
});

// Featured products management
router.get('/featured-products', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status ? String(req.query.status).trim() : null;

    let whereSql = 'WHERE fp.is_active = true';
    const params = [];
    let paramIndex = 1;

    if (status === 'expired') {
      whereSql = 'WHERE fp.expires_at < CURRENT_TIMESTAMP';
    } else if (status === 'inactive') {
      whereSql = 'WHERE fp.is_active = false';
    }

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM featured_products fp ${whereSql}`,
      params
    );

    const result = await pool.query(
      `SELECT fp.*, 
              p.name as product_name, p.image_url as product_image, p.price,
              u.username as farmer_username, u.full_name as farmer_name, u.shop_name,
              COALESCE(u.is_verified, false) as farmer_verified
       FROM featured_products fp
       JOIN products p ON fp.product_id = p.id
       JOIN users u ON fp.farmer_id = u.id
       ${whereSql}
       ORDER BY fp.position ASC, fp.featured_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({ 
      featured_products: result.rows, 
      total: totalRes.rows[0]?.count || 0, 
      page, 
      limit 
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add product to featured
router.post('/featured-products', requireAdmin, async (req, res) => {
  try {
    const { product_id, farmer_id, expires_at, position } = req.body;

    if (!product_id || !farmer_id) {
      return res.status(400).json({ message: 'product_id and farmer_id are required' });
    }

    // Verify farmer is verified
    const farmerResult = await pool.query(
      'SELECT role, is_verified FROM users WHERE id = $1',
      [farmer_id]
    );
    if (farmerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Farmer not found' });
    }
    if (farmerResult.rows[0].role !== 'farmer') {
      return res.status(400).json({ message: 'User is not a farmer' });
    }
    if (!farmerResult.rows[0].is_verified) {
      return res.status(400).json({ message: 'Only verified farmers can have featured products' });
    }

    // Verify product exists and belongs to farmer
    const productResult = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND farmer_id = $2',
      [product_id, farmer_id]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found or does not belong to farmer' });
    }

    // Check if already featured
    const existing = await pool.query(
      'SELECT id FROM featured_products WHERE product_id = $1 AND is_active = true',
      [product_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Product is already featured' });
    }

    const result = await pool.query(
      `INSERT INTO featured_products (product_id, farmer_id, expires_at, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [product_id, farmer_id, expires_at || null, position || 0]
    );

    // Audit log
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'featured_product.add',
      entity: 'featured_products',
      entity_id: result.rows[0].id,
      before: null,
      after: result.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'featured_product.add', entity: 'featured_products', entity_id: result.rows[0].id, actor_admin_id: req.user.id });

    res.json({ message: 'Product featured successfully', featured_product: result.rows[0] });
  } catch (error) {
    console.error('Add featured product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove product from featured
router.delete('/featured-products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const beforeRes = await pool.query('SELECT * FROM featured_products WHERE id = $1', [id]);
    if (beforeRes.rows.length === 0) {
      return res.status(404).json({ message: 'Featured product not found' });
    }

    await pool.query('DELETE FROM featured_products WHERE id = $1', [id]);

    // Audit log
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'featured_product.remove',
      entity: 'featured_products',
      entity_id: parseInt(id, 10),
      before: beforeRes.rows[0],
      after: null,
      req
    });
    broadcastEvent('admin.audit', { action: 'featured_product.remove', entity: 'featured_products', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Featured product removed successfully' });
  } catch (error) {
    console.error('Remove featured product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update featured product
router.put('/featured-products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { expires_at, position, is_active } = req.body;

    const beforeRes = await pool.query('SELECT * FROM featured_products WHERE id = $1', [id]);
    if (beforeRes.rows.length === 0) {
      return res.status(404).json({ message: 'Featured product not found' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (expires_at !== undefined) {
      updates.push(`expires_at = $${paramIndex}`);
      values.push(expires_at);
      paramIndex++;
    }
    if (position !== undefined) {
      updates.push(`position = $${paramIndex}`);
      values.push(position);
      paramIndex++;
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE featured_products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    // Audit log
    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'featured_product.update',
      entity: 'featured_products',
      entity_id: parseInt(id, 10),
      before: beforeRes.rows[0],
      after: result.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'featured_product.update', entity: 'featured_products', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Featured product updated successfully', featured_product: result.rows[0] });
  } catch (error) {
    console.error('Update featured product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/admin/subscriptions ───────────────────────────────────────────
router.get('/subscriptions', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    console.log('GET /api/admin/subscriptions - User role:', req.user?.role, 'Query status:', req.query.status);
    const { status } = req.query;
    let query = `
      SELECT s.*, u.full_name, u.email, u.shop_name,
             pa.name as payment_account_name, pa.account_number as payment_account_number, pa.type as payment_account_type
      FROM farmer_subscriptions s
      JOIN users u ON s.farmer_id = u.id
      LEFT JOIN payment_accounts pa ON pa.id = s.payment_account_id
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' WHERE s.status = $1';
      params.push(status);
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ subscriptions: result.rows });
  } catch (err) {
    console.error('Admin subscriptions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/admin/subscriptions/:id/approve ─────────────────────────────
router.put('/subscriptions/:id/approve', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const subRes = await pool.query(
      'SELECT * FROM farmer_subscriptions WHERE id = $1 AND status = $2',
      [id, 'pending']
    );
    if (subRes.rows.length === 0) {
      return res.status(404).json({ message: 'Pending subscription not found' });
    }
    const sub = subRes.rows[0];
    const before = { status: sub.status, farmer_id: sub.farmer_id, tier: sub.tier };
    const months = sub.plan_duration_months;

    // Get farmer's email and first_name for email notification
    const farmerRes = await pool.query('SELECT email, first_name FROM users WHERE id = $1', [sub.farmer_id]);
    const farmerEmail = farmerRes.rows[0]?.email;
    const farmerFirstName = farmerRes.rows[0]?.first_name;
    await pool.query(
      `UPDATE farmer_subscriptions
       SET status = 'active',
           starts_at = COALESCE(starts_at, CURRENT_TIMESTAMP),
           expires_at = GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + ($1 || ' months')::interval,
           approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [months, adminId, id]
    );
    const after = { status: 'active', farmer_id: sub.farmer_id, tier: sub.tier, approved_by: adminId };
    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: adminId,
        action: 'approved',
        entity: 'subscription',
        entity_id: id, // Keep as string (UUID) since subscription IDs are UUIDs
        before,
        after,
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, 'subscription_approved',
          'Premium Subscription Approved', $2, false, CURRENT_TIMESTAMP)`,
        [sub.farmer_id, `Your Premium subscription is active! You now have unlimited products, priority approval, custom product names, and advanced analytics.`]
      );
      broadcastEvent('notification.created', { farmer_id: sub.farmer_id });
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr);
    }

    // Send premium upgrade email (non-blocking)
    if (farmerEmail) {
      sendPremiumUpgradeEmail(farmerEmail, farmerFirstName).catch(err => {
        console.error('Failed to send premium upgrade email:', err);
      });
    }

    res.json({ message: 'Subscription approved' });
  } catch (err) {
    console.error('Subscription approve error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/admin/subscriptions/:id/reject ──────────────────────────────────
router.put('/subscriptions/:id/reject', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    const subRes = await pool.query(
      'SELECT * FROM farmer_subscriptions WHERE id = $1 AND status = $2', [id, 'pending']
    );
    if (subRes.rows.length === 0) {
      return res.status(404).json({ message: 'Pending subscription not found' });
    }
    const sub = subRes.rows[0];
    const before = { status: sub.status, farmer_id: sub.farmer_id, tier: sub.tier };
    await pool.query(
      `UPDATE farmer_subscriptions SET status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [reason || null, id]
    );
    const after = { status: 'rejected', farmer_id: sub.farmer_id, tier: sub.tier, rejection_reason: reason };
    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: adminId,
        action: 'rejected',
        entity: 'subscription',
        entity_id: id, // Keep as string (UUID) since subscription IDs are UUIDs
        before,
        after,
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, 'subscription_rejected',
          'Premium Subscription Rejected', $2, false, CURRENT_TIMESTAMP)`,
        [sub.farmer_id, `Your Premium subscription request was rejected.${reason ? ` Reason: ${reason}` : ''}`]
      );
      broadcastEvent('notification.created', { farmer_id: sub.farmer_id });
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr);
    }
    res.json({ message: 'Subscription rejected' });
  } catch (err) {
    console.error('Subscription reject error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/admin/subscriptions/:id/expire ──────────────────────────────────
router.put('/subscriptions/:id/expire', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    const subRes = await pool.query(
      'SELECT * FROM farmer_subscriptions WHERE id = $1 AND status = $2', [id, 'active']
    );
    if (subRes.rows.length === 0) {
      return res.status(404).json({ message: 'Active subscription not found' });
    }
    const sub = subRes.rows[0];
    const before = { status: sub.status, farmer_id: sub.farmer_id, tier: sub.tier, expires_at: sub.expires_at };

    // Get farmer's email and first_name for email notification
    const farmerRes = await pool.query('SELECT email, first_name FROM users WHERE id = $1', [sub.farmer_id]);
    const farmerEmail = farmerRes.rows[0]?.email;
    const farmerFirstName = farmerRes.rows[0]?.first_name;
    await pool.query(
      `UPDATE farmer_subscriptions SET status = 'admin_expire', expires_at = CURRENT_TIMESTAMP, expiry_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [reason || null, id]
    );
    const after = { status: 'admin_expire', farmer_id: sub.farmer_id, tier: sub.tier, expires_at: new Date().toISOString(), expiry_reason: reason };
    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: adminId,
        action: 'expired',
        entity: 'subscription',
        entity_id: id, // Keep as string (UUID) since subscription IDs are UUIDs
        before,
        after,
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, 'subscription_expired',
          'Premium Subscription Expired', $2, false, CURRENT_TIMESTAMP)`,
        [sub.farmer_id, `Your Premium subscription has been expired.${reason ? ` Reason: ${reason}` : ''}`]
      );
      broadcastEvent('notification.created', { farmer_id: sub.farmer_id });
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr);
    }

    // Send premium expired email (non-blocking)
    if (farmerEmail) {
      sendPremiumExpiredEmail(farmerEmail, farmerFirstName, reason).catch(err => {
        console.error('Failed to send premium expired email:', err);
      });
    }

    res.json({ message: 'Subscription expired' });
  } catch (err) {
    console.error('Subscription expire error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/admin/subscriptions/:id/resume ─────────────────────────────────
router.put('/subscriptions/:id/resume', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const subRes = await pool.query(
      'SELECT * FROM farmer_subscriptions WHERE id = $1 AND status = $2', [id, 'admin_expire']
    );
    if (subRes.rows.length === 0) {
      return res.status(404).json({ message: 'Admin-expired subscription not found' });
    }
    const sub = subRes.rows[0];
    const before = { status: sub.status, farmer_id: sub.farmer_id, tier: sub.tier, expires_at: sub.expires_at };

    // Calculate remaining time from original expiry
    const originalExpiresAt = new Date(sub.expires_at);
    const now = new Date();
    const remainingMs = originalExpiresAt - now;
    
    // Set new expiry date to now + remaining time (minimum 1 day if remaining time is negative or very small)
    const newExpiresAt = remainingMs > 86400000 ? new Date(now.getTime() + remainingMs) : new Date(now.getTime() + 86400000);

    await pool.query(
      `UPDATE farmer_subscriptions SET status = 'active', expires_at = $1, expiry_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newExpiresAt.toISOString(), id]
    );
    const after = { status: 'active', farmer_id: sub.farmer_id, tier: sub.tier, expires_at: newExpiresAt.toISOString() };
    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: adminId,
        action: 'restored',
        entity: 'subscription',
        entity_id: id,
        before,
        after,
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, 'subscription_restored',
          'Premium Subscription Restored', $2, false, CURRENT_TIMESTAMP)`,
        [sub.farmer_id, 'Your Premium subscription has been restored by an admin.']
      );
      broadcastEvent('notification.created', { farmer_id: sub.farmer_id });
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr);
    }

    res.json({ message: 'Subscription resumed' });
  } catch (err) {
    console.error('Subscription resume error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.ensureCategoryAdminSchema = ensureCategoryAdminSchema;
