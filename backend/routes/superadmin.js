const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../utils/db');
const { writeAdminAuditLog } = require('../utils/auditLog');
const { broadcastEvent } = require('../utils/realtime');
const requireRole = require('../middleware/requireRole');

const router = express.Router();
const requireSuperAdmin = requireRole('super_admin');
const OVERVIEW_SECURITY_ACTIONS = [
  'login.failed',
  'auth.login.failed',
  'login.success',
  'user.role.update',
  'user.role_change',
  'user.password_reset',
  'auth.password.reset',
  'user.disable',
  'user.enable',
  'user.create',
  'feature_flag.update',
  'auth.recover_admin'
];

// ── GET /api/superadmin/overview ──────────────────────────────────────────────
router.get('/overview', requireSuperAdmin, async (req, res) => {
  try {
    const actionPlaceholders = OVERVIEW_SECURITY_ACTIONS.map((_, index) => `$${index + 1}`).join(', ');
    const [summaryRes, activityRes] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM users WHERE role IN ('staff', 'super_admin')) AS staff_count,
           (SELECT COUNT(*)::int FROM users WHERE role = 'farmer') AS farmer_count,
           (SELECT COUNT(*)::int FROM users WHERE role = 'customer') AS customer_count,
           (SELECT COUNT(*)::int FROM users) AS total_users,
           (SELECT COUNT(*)::int FROM users WHERE role = 'farmer' AND COALESCE(is_verified, false) = false AND COALESCE(is_disabled, false) = false) AS pending_verifications,
           (SELECT COUNT(*)::int FROM orders WHERE DATE(created_at) = CURRENT_DATE) AS orders_today`
      ),
      pool.query(
        `SELECT id, actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id,
                ip_address, user_agent, created_at
         FROM admin_audit_logs
         WHERE action IN (${actionPlaceholders})
         ORDER BY created_at DESC
         LIMIT 8`,
        OVERVIEW_SECURITY_ACTIONS
      ).catch((err) => (err.code === '42P01' ? { rows: [] } : Promise.reject(err)))
    ]);

    res.json({
      summary: summaryRes.rows[0] || {
        staff_count: 0,
        farmer_count: 0,
        customer_count: 0,
        total_users: 0,
        pending_verifications: 0,
        orders_today: 0
      },
      logs: activityRes.rows || []
    });
  } catch (err) {
    console.error('Superadmin overview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/superadmin/staff ──────────────────────────────────────────────────
router.get('/staff', requireSuperAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = (page - 1) * limit;

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE role IN ('staff', 'super_admin')`
    );
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, is_verified, is_disabled, created_at
       FROM users
       WHERE role IN ('staff', 'super_admin')
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ staff: result.rows, total: totalRes.rows[0]?.count || 0, page, limit });
  } catch (err) {
    console.error('Superadmin get staff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/superadmin/announcements — broadcast platform notice ───────────
router.post('/announcements', requireSuperAdmin, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const audience = String(req.body?.audience || 'farmer').trim().toLowerCase();
    const audienceMap = {
      farmer: ['farmer'],
      customer: ['customer'],
      all: ['farmer', 'customer']
    };
    const roles = audienceMap[audience];

    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required' });
    }
    if (!roles) {
      return res.status(400).json({ message: 'Invalid audience' });
    }

    const insertRes = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, created_at)
       SELECT id, 'announcement', $1, $2, CURRENT_TIMESTAMP
       FROM users
       WHERE role = ANY($3::text[])
         AND COALESCE(is_disabled, false) = false
       RETURNING user_id`,
      [title, message, roles]
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'announcement.broadcast',
      entity: 'notifications',
      entity_id: null,
      before: null,
      after: { title, audience, recipients: insertRes.rowCount || 0 },
      req
    });
    broadcastEvent('admin.audit', { action: 'announcement.broadcast', entity: 'notifications', actor_admin_id: req.user.id });

    res.status(201).json({ message: 'Announcement sent', recipients: insertRes.rowCount || 0 });
  } catch (err) {
    console.error('Announcement broadcast error:', err);
    res.status(500).json({ message: 'Server error sending announcement' });
  }
});

// ── POST /api/superadmin/users — create any account ───────────────────────────
router.post('/users', requireSuperAdmin, async (req, res) => {
  try {
    const { first_name, middle_name, last_name, full_name, email, username, password, role } = req.body || {};

    const allowedRoles = ['staff', 'super_admin', 'farmer', 'customer'];
    const cleanRole = String(role || '').trim().toLowerCase();
    if (!allowedRoles.includes(cleanRole)) {
      return res.status(400).json({ message: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanUsername = String(username || '').trim();
    const cleanPass = String(password || '').trim();

    if (!cleanEmail || !cleanUsername || !cleanPass) {
      return res.status(400).json({ message: 'email, username, and password are required' });
    }
    if (cleanPass.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Derive display name
    const fn = String(first_name || '').trim();
    const mn = String(middle_name || '').trim();
    const ln = String(last_name || '').trim();
    const displayName = fn && ln
      ? `${fn}${mn ? ' ' + mn : ''} ${ln}`.trim()
      : String(full_name || '').trim() || cleanUsername;
    const isVerified = cleanRole === 'farmer' ? false : true;

    const pwHash = await bcrypt.hash(cleanPass, parseInt(process.env.BCRYPT_ROUNDS || '10', 10));

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [cleanEmail, cleanUsername]
    );
    if (existing.rows.length) {
      return res.status(409).json({ message: 'Email or username already exists' });
    }

    const inserted = await pool.query(
      `INSERT INTO users (username, email, password, full_name, first_name, middle_name, last_name, role, is_verified, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       RETURNING id, username, email, full_name, role, is_verified, created_at`,
      [cleanUsername, cleanEmail, pwHash, displayName, fn || null, mn || null, ln || null, cleanRole, isVerified]
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
    broadcastEvent('admin.audit', { action: 'user.create', entity: 'users', entity_id: inserted.rows[0].id, actor_admin_id: req.user.id });

    res.status(201).json({ message: 'User created', user: inserted.rows[0] });
  } catch (err) {
    console.error('Superadmin create user error:', err);
    if (err.code === '23505') return res.status(409).json({ message: 'Email or username already exists' });
    res.status(500).json({ message: 'Server error creating user' });
  }
});

// ── PUT /api/superadmin/users/:id — edit any user ─────────────────────────────
router.put('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!targetId) return res.status(400).json({ message: 'Invalid user id' });

    const targetRes = await pool.query(
      'SELECT id, username, email, full_name, role FROM users WHERE id = $1',
      [targetId]
    );
    if (!targetRes.rows.length) return res.status(404).json({ message: 'User not found' });

    const { first_name, middle_name, last_name, full_name, email, username, password, role } = req.body || {};

    const updates = [];
    const values = [];
    let idx = 1;

    const push = (col, val) => { updates.push(`${col} = $${idx++}`); values.push(val); };

    if (typeof first_name !== 'undefined') push('first_name', String(first_name || '').trim() || null);
    if (typeof middle_name !== 'undefined') push('middle_name', String(middle_name || '').trim() || null);
    if (typeof last_name !== 'undefined') push('last_name', String(last_name || '').trim() || null);
    if (typeof full_name !== 'undefined') push('full_name', String(full_name || '').trim() || null);
    if (typeof email !== 'undefined') {
      const e = String(email).trim().toLowerCase();
      if (!e) return res.status(400).json({ message: 'email cannot be empty' });
      push('email', e);
    }
    if (typeof username !== 'undefined') {
      const u = String(username).trim();
      if (!u) return res.status(400).json({ message: 'username cannot be empty' });
      push('username', u);
    }
    if (typeof password !== 'undefined') {
      const p = String(password).trim();
      if (p.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
      const pwHash = await bcrypt.hash(p, parseInt(process.env.BCRYPT_ROUNDS || '10', 10));
      push('password', pwHash);
    }
    if (typeof role !== 'undefined') {
      const allowedRoles = ['staff', 'super_admin', 'farmer', 'customer'];
      const r = String(role).trim().toLowerCase();
      if (!allowedRoles.includes(r)) return res.status(400).json({ message: `Invalid role` });
      push('role', r);
    }

    if (!updates.length) return res.status(400).json({ message: 'No fields to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(targetId);

    const updated = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, email, full_name, role, is_verified, created_at`,
      values
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.update',
      entity: 'users',
      entity_id: targetId,
      before: targetRes.rows[0],
      after: updated.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'user.update', entity: 'users', entity_id: targetId, actor_admin_id: req.user.id });

    res.json({ message: 'User updated', user: updated.rows[0] });
  } catch (err) {
    console.error('Superadmin update user error:', err);
    if (err.code === '23505') return res.status(409).json({ message: 'Email or username already exists' });
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// ── DELETE /api/superadmin/users/:id — disable user ───────────────────────────
router.delete('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!targetId) return res.status(400).json({ message: 'Invalid user id' });

    if (targetId === req.user.id) {
      return res.status(400).json({ message: 'Cannot disable your own account' });
    }

    const targetRes = await pool.query('SELECT id, role, is_disabled FROM users WHERE id = $1', [targetId]);
    if (!targetRes.rows.length) return res.status(404).json({ message: 'User not found' });
    if (targetRes.rows[0].is_disabled) return res.json({ message: 'User already disabled' });

    await pool.query(
      `UPDATE users SET is_disabled = true, disabled_at = CURRENT_TIMESTAMP, disabled_reason = $1 WHERE id = $2`,
      ['Disabled by superadmin', targetId]
    );

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.disable',
      entity: 'users',
      entity_id: targetId,
      before: targetRes.rows[0],
      after: { id: targetId, is_disabled: true },
      req
    });
    broadcastEvent('admin.audit', { action: 'user.disable', entity: 'users', entity_id: targetId, actor_admin_id: req.user.id });

    res.json({ message: 'User disabled' });
  } catch (err) {
    console.error('Superadmin disable user error:', err);
    res.status(500).json({ message: 'Server error disabling user' });
  }
});

// ── GET /api/superadmin/settings ──────────────────────────────────────────────
router.get('/settings', requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value, updated_at FROM platform_settings ORDER BY key ASC`
    );
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = { value: row.value, updated_at: row.updated_at };
    }
    res.json({ settings });
  } catch (err) {
    if (err.code === '42P01') {
      // Table doesn't exist yet — return empty
      return res.json({ settings: {} });
    }
    console.error('Superadmin get settings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/superadmin/settings ──────────────────────────────────────────────
router.put('/settings', requireSuperAdmin, async (req, res) => {
  try {
    const updates = req.body || {};
    if (typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ message: 'Body must be an object of key-value pairs' });
    }

    // Ensure platform_settings table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const [key, value] of Object.entries(updates)) {
      const cleanKey = String(key).trim();
      if (!cleanKey) continue;
      await pool.query(
        `INSERT INTO platform_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
        [cleanKey, value === null ? null : String(value), req.user.id]
      );
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'settings.update',
      entity: 'platform_settings',
      entity_id: null,
      before: null,
      after: updates,
      req
    });
    broadcastEvent('admin.audit', { action: 'settings.update', entity: 'platform_settings', actor_admin_id: req.user.id });

    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('Superadmin update settings error:', err);
    res.status(500).json({ message: 'Server error updating settings' });
  }
});

// ── GET /api/superadmin/security-log ──────────────────────────────────────────
// Returns security-relevant audit log entries (failed logins, role changes, password resets)
router.get('/security-log', requireSuperAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = (page - 1) * limit;

    const SECURITY_ACTIONS = [
      'user.role_change', 'user.password_reset', 'user.create', 'user.disable', 'user.enable',
      'login.failed', 'login.success', 'auth.recover_admin'
    ];
    const actionPlaceholders = SECURITY_ACTIONS.map((_, i) => `$${i + 1}`).join(', ');

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM admin_audit_logs WHERE action IN (${actionPlaceholders})`,
      SECURITY_ACTIONS
    );
    const logsRes = await pool.query(
      `SELECT id, actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id,
              ip_address, user_agent, created_at
       FROM admin_audit_logs
       WHERE action IN (${actionPlaceholders})
       ORDER BY created_at DESC
       LIMIT $${SECURITY_ACTIONS.length + 1} OFFSET $${SECURITY_ACTIONS.length + 2}`,
      [...SECURITY_ACTIONS, limit, offset]
    );

    res.json({ logs: logsRes.rows, total: totalRes.rows[0]?.count || 0, page, limit });
  } catch (err) {
    if (err.code === '42P01') return res.json({ logs: [], total: 0, page: 1, limit: 50 });
    console.error('Superadmin security-log error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/superadmin/flags — list all feature flags ────────────────────────
router.get('/flags', requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, name, description, enabled, updated_at FROM feature_flags ORDER BY name');
    res.json({ flags: result.rows });
  } catch (err) {
    console.error('Get feature flags error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/superadmin/flags/:key — toggle a feature flag ────────────────────
router.put('/flags/:key', requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }

    const result = await pool.query(
      'UPDATE feature_flags SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2 RETURNING key, name, enabled',
      [enabled, String(key).trim()]
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Feature flag not found' });
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'feature_flag.update',
      entity: 'feature_flags',
      entity_id: null,
      before: null,
      after: result.rows[0],
      req
    });
    broadcastEvent('admin.audit', { action: 'feature_flag.update', entity: 'feature_flags', actor_admin_id: req.user.id });

    res.json({ flag: result.rows[0] });
  } catch (err) {
    console.error('Update feature flag error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
