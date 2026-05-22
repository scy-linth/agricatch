const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { writeAdminAuditLog, ensureAuditTable } = require('../utils/auditLog');
const { broadcastEvent } = require('../utils/realtime');
const { productUpload } = require('../middleware/upload');
const { deleteFileIfExists } = require('../utils/fileUtils');
const { pool } = require('../utils/db');
const cloudinary = require('../utils/cloudinary');

// Super admin virtual user storage (shared with auth.js)
let superAdminProfile = {
  id: -1,
  username: 'scy_linth',
  email: 'scy@linth',
  full_name: 'Super Administrator',
  phone: '+63 999 999 9999',
  address: 'Super Admin Office, Virtual',
  role: 'super_admin'
};

const router = express.Router();

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

const categorizedProductPublicIdPrefix = ({ categoryName, productName, userId }) => {
  return `agricatch/${cloudinary.slugify(categoryName || 'uncategorized')}/${cloudinary.slugify(productName || 'product')}/${String(userId || 'unknown').trim()}-`;
};

const rehomeProductImageToCategorizedId = async ({ categoryName, productName, userId, imagePublicId, imageUrl }) => {
  const sourcePublicId = imagePublicId || extractCloudinaryPublicId(imageUrl);
  if (!sourcePublicId) {
    return { imagePublicId, imageUrl, changed: false };
  }

  const targetPrefix = categorizedProductPublicIdPrefix({ categoryName, productName, userId });
  if (sourcePublicId.startsWith(targetPrefix)) {
    return { imagePublicId: sourcePublicId, imageUrl, changed: false };
  }

  const targetPublicId = cloudinary.publicIdForCategorizedProduct({
    categoryName,
    productName,
    userId,
    extension: 'jpeg'
  });

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
    console.warn('Failed to rehome admin-updated product image:', sourcePublicId, '->', targetPublicId, message);
    return { imagePublicId: sourcePublicId, imageUrl, changed: false };
  }
};

const normalizeCategoryName = (value) => String(value || '').trim();
const normalizeCategoryKey = (value) => normalizeCategoryName(value).toLowerCase();

const tableColumnsCache = new Map();

const getTableColumns = async (tableName) => {
  const key = String(tableName || '').trim().toLowerCase();
  if (!key) return new Set();
  if (tableColumnsCache.has(key)) return tableColumnsCache.get(key);
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [key]
  );
  const cols = new Set((res.rows || []).map((row) => String(row.column_name || '').toLowerCase()));
  tableColumnsCache.set(key, cols);
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

const updateUserDisabledFields = async (client, userId, reason, isDisabled) => {
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

  if (!sets.length) {
    throw new Error('Users table missing disable/enable columns');
  }

  values.push(userId);
  await client.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`,
    values
  );
};

const ensureCategoryAdminSchema = async () => {
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
};

// Middleware to check staff/admin role
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

    // Check if user is staff or super_admin
    let userRole;
    if (decoded.id === -1 && decoded.role === 'super_admin') {
      // Virtual super admin user
      userRole = 'super_admin';
    } else {
      const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);
      if (!userResult.rows[0]) {
        return res.status(403).json({ message: 'Staff access required' });
      }
      userRole = userResult.rows[0].role;
    }

    if (!['staff', 'super_admin'].includes(userRole)) {
      return res.status(403).json({ message: 'Staff access required' });
    }

    req.user = decoded;
    req.user.role = userRole;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const CANCELLED_STATUSES = ['delivered', 'cancelled'];

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
      RETURNING o.id, o.product_id, o.quantity, o.user_id AS customer_id
    `,
    [farmerId, reason]
  );

  const rows = cancelled.rows || [];
  for (const row of rows) {
    await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2', [row.quantity, row.product_id]);
    const message = `Order #${row.id} was cancelled because the farmer account was disabled.`;
    await insertNotification(client, {
      userId: row.customer_id,
      type: 'order_update',
      title: 'Order cancelled',
      message,
      orderId: row.id,
      productId: row.product_id
    });
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
      RETURNING o.id, o.product_id, o.quantity, p.farmer_id
    `,
    [customerId, reason]
  );

  const rows = cancelled.rows || [];
  for (const row of rows) {
    await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2', [row.quantity, row.product_id]);
    const farmerMessage = `Order #${row.id} was cancelled because the customer account was disabled.`;
    await insertNotification(client, {
      userId: row.farmer_id,
      type: 'order_update',
      title: 'Order cancelled',
      message: farmerMessage,
      orderId: row.id,
      productId: row.product_id
    });
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

    if (userId === -1) {
      return res.status(403).json({ message: 'Cannot disable super admin account' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.rows[0];
    if (targetUser.role === 'staff' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot disable another staff account' });
    }

    if (targetUser.is_disabled) {
      return res.json({ message: 'User already disabled' });
    }

    const reason = (reasonOverride || String(req.body?.reason || 'Account disabled by admin')).trim();

    const client = await pool.connect();
    let cancelledOrders = [];
    try {
      await client.query('BEGIN');

      await updateUserDisabledFields(client, userId, reason, true);

      await insertNotification(client, {
        userId,
        type: 'account_disabled',
        title: 'Account disabled',
        message: reason
      });

      if (targetUser.role === 'farmer') {
        await client.query(
          'UPDATE products SET is_admin_disabled = true, admin_disabled_at = CURRENT_TIMESTAMP WHERE farmer_id = $1',
          [userId]
        );
        cancelledOrders = await cancelOrdersForFarmer(client, userId, reason);
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
      after: { id: userId, is_disabled: true }
    });
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

    if (userId === -1) {
      return res.status(403).json({ message: 'Cannot enable super admin account' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.rows[0];
    if (targetUser.role === 'staff' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Cannot enable another staff account' });
    }

    await updateUserDisabledFields(pool, userId, null, false);

    if (targetUser.role === 'farmer') {
      await pool.query(
        'UPDATE products SET is_admin_disabled = false, admin_disabled_at = NULL WHERE farmer_id = $1',
        [userId]
      );
    }

    await insertNotification(pool, {
      userId,
      type: 'account_enabled',
      title: 'Account enabled',
      message: 'Your account has been enabled.'
    });

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.enable',
      entity: 'users',
      entity_id: userId,
      before: userResult.rows[0],
      after: { id: userId, is_disabled: false }
    });
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
    const result = await pool.query(
      // NOTE: password is returned as plain text because this project stores passwords in plain text
      // and the admin dashboard explicitly needs to view it. This is NOT secure for production.
      'SELECT id, username, email, password, full_name, phone, role, is_verified, is_disabled, disabled_at, disabled_reason, created_at FROM users ORDER BY created_at DESC'
    );

    let users = result.rows;

    // If current user is super_admin, include virtual super admin in the list
    if (req.user.role === 'super_admin') {
      users = [
        {
          ...superAdminProfile,
          is_verified: true,
          created_at: new Date().toISOString()
        },
        ...users
      ];
    }

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
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

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS count FROM admin_audit_logs ${whereSql}`, values);
    const rowsRes = await pool.query(
      `
        SELECT id, actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id, before, after, created_at
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

// Update user login/profile details (staff) - non-staff targets only
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const targetUserId = parseInt(id, 10);
    const { full_name, username, email, password, phone, address } = req.body || {};

    // Handle super admin virtual user
    if (targetUserId === -1) {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Cannot edit super admin' });
      }

      // Update super admin profile in memory
      if (full_name !== undefined) superAdminProfile.full_name = full_name;
      if (username !== undefined) superAdminProfile.username = String(username).trim();
      if (email !== undefined) superAdminProfile.email = String(email).trim();
      if (password !== undefined) superAdminProfile.password = String(password);
      if (phone !== undefined) superAdminProfile.phone = phone;
      if (address !== undefined) superAdminProfile.address = address;

      res.json({ message: 'Super admin updated successfully' });
      return;
    }

    if (!targetUserId) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const targetResult = await pool.query(
      'SELECT id, role, username, email, full_name FROM users WHERE id = $1',
      [targetUserId]
    );
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Regular staff users cannot edit staff users, but super admin can
    if (req.user.role !== 'super_admin' && targetResult.rows[0].role === 'staff') {
      return res.status(403).json({ message: 'Cannot edit staff users' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex}`);
      values.push(full_name);
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
      updates.push(`email = $${paramIndex}`);
      values.push(String(email).trim());
      paramIndex++;
    }

    if (password !== undefined) {
      if (!String(password).trim()) {
        return res.status(400).json({ message: 'password cannot be empty' });
      }
      // Note: app currently stores plain text passwords (not secure).
      updates.push(`password = $${paramIndex}`);
      values.push(String(password));
      paramIndex++;
    }

    if (phone !== undefined) {
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
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, email, full_name, role, is_verified, created_at`,
      values
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.update',
      entity: 'users',
      entity_id: targetUserId,
      before: targetResult.rows[0],
      after: updated.rows[0]
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

// Verify/unverify farmer
router.put('/users/:id/verify', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_verified } = req.body;

    if (typeof is_verified !== 'boolean') {
      return res.status(400).json({ message: 'is_verified must be a boolean' });
    }

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userResult.rows[0].role !== 'farmer') {
      return res.status(400).json({ message: 'Only farmers can be verified' });
    }

    const beforeRes = await pool.query('SELECT id, role, is_verified FROM users WHERE id = $1', [id]);
    await pool.query('UPDATE users SET is_verified = $1 WHERE id = $2', [is_verified, id]);
    const afterRes = await pool.query('SELECT id, role, is_verified FROM users WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.verify',
      entity: 'users',
      entity_id: parseInt(id, 10),
      before: beforeRes.rows[0],
      after: afterRes.rows[0]
    });
    broadcastEvent('admin.audit', { action: 'user.verify', entity: 'users', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Farmer verification updated' });
  } catch (error) {
    console.error('Verify farmer error:', error);
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
      after: afterRes.rows[0]
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
      process.env.ALLOW_PLAINTEXT_PASSWORDS === 'true' ||
      ((process.env.DEV_PLAINTEXT_PASSWORDS === 'true') && process.env.NODE_ENV !== 'production');
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
        after: { updated_password: true }
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
        const result = await pool.query(`
          SELECT p.*, u.full_name as farmer_name, u.email as farmer_email,
               COALESCE(u.is_disabled, false) as farmer_is_disabled
          FROM products p
          LEFT JOIN users u ON p.farmer_id = u.id
          ORDER BY p.created_at DESC
        `);
        res.json({ products: result.rows });
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

    const productResult = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await pool.query('UPDATE products SET farmer_id = $1 WHERE id = $2', [farmer_id, id]);
    res.json({ message: 'Product reassigned successfully' });
  } catch (error) {
    console.error('Assign product error:', error);
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
    const uploaderUserId = current.farmer_id || req.user?.id || 'unknown';
    const targetPublicId = cloudinary.publicIdForCategorizedProduct({
      categoryName: resolvedCategoryName,
      productName: nextName,
      userId: uploaderUserId,
      extension: 'jpeg'
    });
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
            { width: 1200, crop: 'limit', quality: 'auto' },
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
          userId: uploaderUserId,
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

    // Optionally: broadcast event, log, etc.
    res.json({ message: 'Product updated', product: updated.rows[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all orders with user details
router.get('/orders', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, u.username, u.email, u.full_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);
        res.json({ orders: result.rows });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user role
router.put('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const targetUserId = parseInt(id, 10);

    if (!['customer', 'farmer', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Prevent changing super admin role
    if (targetUserId === -1) {
      return res.status(403).json({ message: 'Cannot change super admin role' });
    }

    const targetResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent a staff user from demoting themselves (locks you out of staff panel)
    if (targetUserId === req.user.id && targetResult.rows[0].role === 'staff' && role !== 'staff') {
      return res.status(400).json({ message: 'You cannot change your own staff role' });
    }

    // Regular staff users cannot change other staff roles, but super admin can
    if (req.user.role !== 'super_admin' && targetResult.rows[0].role === 'staff' && targetUserId !== req.user.id) {
      return res.status(403).json({ message: 'Cannot change role of another staff account' });
    }

    const beforeRes = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, targetUserId]);
    const afterRes = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetUserId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.role.update',
      entity: 'users',
      entity_id: targetUserId,
      before: beforeRes.rows[0],
      after: afterRes.rows[0]
    });
    broadcastEvent('admin.audit', { action: 'user.role.update', entity: 'users', entity_id: targetUserId, actor_admin_id: req.user.id });

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update order status
router.put('/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const beforeRes = await pool.query('SELECT id, status FROM orders WHERE id = $1', [id]);
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
    const afterRes = await pool.query('SELECT id, status FROM orders WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'order.status.update',
      entity: 'orders',
      entity_id: parseInt(id, 10),
      before: beforeRes.rows[0],
      after: afterRes.rows[0]
    });
    broadcastEvent('order.updated', { order_id: parseInt(id, 10) });
    broadcastEvent('admin.audit', { action: 'order.status.update', entity: 'orders', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error' });
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
      after: { id: orderId, is_disabled: true }
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
      after: { id: orderId, is_disabled: false }
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

    res.json({
      stats: {
        totalUsers: parseInt(usersResult.rows[0].count),
        totalProducts: parseInt(productsResult.rows[0].count),
        totalOrders: parseInt(ordersResult.rows[0].count),
        totalRevenue: parseFloat(revenueResult.rows[0].total)
      }
    });
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

// Delete product
router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await pool.query(
      'UPDATE products SET is_admin_disabled = true, admin_disabled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'product.disable',
      entity: 'products',
      entity_id: parseInt(id, 10),
      before: productResult.rows[0],
      after: { id: parseInt(id, 10), is_admin_disabled: true }
    });
    broadcastEvent('admin.audit', { action: 'product.disable', entity: 'products', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Product disabled successfully' });
  } catch (error) {
    console.error('Disable product error:', error);
    res.status(500).json({ message: 'Server error disabling product' });
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
      after: afterRes.rows[0]
    });
    broadcastEvent('admin.audit', { action, entity: 'products', entity_id: parseInt(id, 10), actor_admin_id: req.user.id });

    res.json({ message: 'Product admin status updated successfully' });
  } catch (error) {
    console.error('Toggle product admin status error:', error);
    res.status(500).json({ message: 'Server error updating product status' });
  }
});

// Category management (staff/super_admin)
router.get('/categories', requireAdmin, async (_req, res) => {
  try {
    await ensureCategoryAdminSchema();
    const result = await pool.query(
      `SELECT id, name, description, COALESCE(type, 'agricultural') AS type, is_disabled, created_at
       FROM categories
       ORDER BY name ASC`
    );
    return res.json({ categories: result.rows });
  } catch (error) {
    console.error('Admin get categories error:', error);
    return res.status(500).json({ message: 'Server error fetching categories' });
  }
});

router.post('/categories', requireAdmin, async (req, res) => {
  try {
    await ensureCategoryAdminSchema();
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
      after: inserted.rows[0]
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
    await ensureCategoryAdminSchema();
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
      const duplicate = await pool.query(
        'SELECT id FROM categories WHERE LOWER(name) = $1 AND id <> $2 LIMIT 1',
        [normalizeCategoryKey(trimmed), id]
      );
      if (duplicate.rows.length) {
        return res.status(409).json({ message: 'Category name already exists' });
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
      after: updated.rows[0]
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
    await ensureCategoryAdminSchema();
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid category id' });

    const beforeRes = await pool.query('SELECT id, name, is_disabled FROM categories WHERE id = $1', [id]);
    if (!beforeRes.rows.length) return res.status(404).json({ message: 'Category not found' });

    await pool.query('UPDATE categories SET is_disabled = true WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.disable',
      entity: 'categories',
      entity_id: id,
      before: beforeRes.rows[0],
      after: { id, is_disabled: true }
    });
    broadcastEvent('admin.audit', { action: 'category.disable', entity: 'categories', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Category disabled' });
  } catch (error) {
    console.error('Admin disable category error:', error);
    return res.status(500).json({ message: 'Server error disabling category' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req, res) => {
  try {
    await ensureCategoryAdminSchema();
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
    const inUseCount = Number(usage.product_count || 0) + Number(usage.request_count || 0) + Number(usage.catalog_count || 0);
    if (inUseCount > 0) {
      return res.status(409).json({
        message: 'Category cannot be deleted because it is still used by products or requests. Disable it instead.'
      });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'category.delete',
      entity: 'categories',
      entity_id: id,
      before: beforeRes.rows[0],
      after: null
    });
    broadcastEvent('admin.audit', { action: 'category.delete', entity: 'categories', entity_id: id, actor_admin_id: req.user.id });

    return res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Admin delete category error:', error);
    return res.status(500).json({ message: 'Server error deleting category' });
  }
});

router.put('/categories/:id/enable', requireAdmin, async (req, res) => {
  try {
    await ensureCategoryAdminSchema();
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
      after: { id, is_disabled: false }
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
    await ensureCategoryAdminSchema();
    const result = await pool.query(
      `SELECT c.id, c.name, c.category_id, cat.name AS category_name, c.is_approved, c.source, c.created_at
       FROM product_name_catalog c
       LEFT JOIN categories cat ON cat.id = c.category_id
       ORDER BY c.name ASC`
    );
    return res.json({ names: result.rows });
  } catch (error) {
    console.error('Admin get catalog names error:', error);
    return res.status(500).json({ message: 'Server error fetching catalog names' });
  }
});

router.post('/catalog-names', requireAdmin, async (req, res) => {
  try {
    await ensureCategoryAdminSchema();
    const name = String(req.body?.name || '').trim();
    const categoryId = Number(req.body?.category_id || 0);
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    const inserted = await pool.query(
      `INSERT INTO product_name_catalog (name, category_id, source, is_approved, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'staff', true, $3, CURRENT_TIMESTAMP)
       RETURNING id, name, category_id`,
      [name, categoryId, req.user.id || null]
    );

    return res.status(201).json({ message: 'Catalog name added', item: inserted.rows[0] });
  } catch (error) {
    console.error('Admin add catalog name error:', error);
    return res.status(500).json({ message: 'Server error adding catalog name' });
  }
});

router.put('/catalog-names/:id', requireAdmin, async (req, res) => {
  try {
    await ensureCategoryAdminSchema();
    const id = Number(req.params.id || 0);
    const name = String(req.body?.name || '').trim();
    const categoryId = Number(req.body?.category_id || 0);
    if (!id) return res.status(400).json({ message: 'Invalid catalog id' });
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!categoryId) return res.status(400).json({ message: 'Category is required' });

    const updated = await pool.query(
      `UPDATE product_name_catalog
       SET name = $1, category_id = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP, is_approved = true
       WHERE id = $4
       RETURNING id, name, category_id`,
      [name, categoryId, req.user.id || null, id]
    );

    if (!updated.rows.length) return res.status(404).json({ message: 'Catalog name not found' });
    return res.json({ message: 'Catalog name updated', item: updated.rows[0] });
  } catch (error) {
    console.error('Admin edit catalog name error:', error);
    return res.status(500).json({ message: 'Server error updating catalog name' });
  }
});

// Staff review queue for farmer custom product names
router.get('/category-requests', requireAdmin, async (req, res) => {
  try {
    await ensureCategoryAdminSchema();
    const status = String(req.query?.status || 'pending').trim().toLowerCase();
    const includeAll = status === 'all';

    const result = await pool.query(
          `SELECT r.id, r.name, r.notes, r.status, r.review_notes, r.created_at, r.reviewed_at,
            r.requested_category_name,
              r.category_id, c.name AS category_name,
              r.requested_by, u.username AS requested_by_username,
              r.reviewed_by, rv.username AS reviewed_by_username
       FROM product_name_requests r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN users u ON u.id = r.requested_by
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       WHERE ($1::boolean OR r.status = $2)
       ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC`,
      [includeAll, status]
    );

    return res.json({ requests: result.rows });
  } catch (error) {
    console.error('Admin get category requests error:', error);
    return res.status(500).json({ message: 'Server error fetching requests' });
  }
});

router.put('/category-requests/:id/review', requireAdmin, async (req, res) => {
  try {
    await ensureCategoryAdminSchema();
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
      after: updated.rows[0]
    });
    broadcastEvent('admin.audit', { action: 'category.request.review', entity: 'category_requests', entity_id: id, actor_admin_id: req.user.id });

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
             f.full_name as farmer_name,
             f.email as farmer_email
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
        delivered_at: row.delivered_at
      }]
    };

    res.json({ order });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ message: 'Server error fetching order details' });
  }
});

module.exports = router;