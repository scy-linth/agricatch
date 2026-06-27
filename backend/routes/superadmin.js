const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, clearSettingsCache } = require('../utils/db');
const { writeAdminAuditLog } = require('../utils/auditLog');
const { broadcastEvent } = require('../utils/realtime');
const requireRole = require('../middleware/requireRole');
const { requireAnnouncementsEnabled } = require('../middleware/featureFlags');

const router = express.Router();
const requireSuperAdmin = requireRole('super_admin');

// ── GET /api/superadmin/status ───────────────────────────────────────────────
// Returns safe configuration and connectivity status for external services
// No secrets are exposed; only configuration presence and safe details
router.get('/status', requireSuperAdmin, async (req, res) => {
  try {
    const checkedAt = new Date().toISOString();
    const services = [];

    // Render Backend
    const renderService = {
      key: 'render',
      name: 'Render Backend',
      configured: false,
      online: false,
      status: 'not_detected',
      last_checked: checkedAt,
      last_configured: null,
      details: {}
    };
    if (process.env.RENDER_SERVICE_NAME || process.env.RENDER_GIT_COMMIT || process.env.RENDER) {
      renderService.configured = true;
      renderService.online = true;
      renderService.status = 'online';
      renderService.details = {
        service: process.env.RENDER_SERVICE_NAME || null,
        environment: process.env.NODE_ENV || null,
        commit: process.env.RENDER_GIT_COMMIT || null
      };
    }
    services.push(renderService);

    // Vercel Frontend (optional env vars)
    const vercelService = {
      key: 'vercel',
      name: 'Vercel Frontend',
      configured: false,
      online: false,
      status: 'not_detected',
      last_checked: checkedAt,
      last_configured: null,
      details: {}
    };
    if (process.env.FRONTEND_PROVIDER === 'vercel' || process.env.VERCEL_PROJECT_NAME) {
      vercelService.configured = true;
      vercelService.status = 'configured';
      vercelService.details = {
        project: process.env.VERCEL_PROJECT_NAME || null,
        url: process.env.FRONTEND_URL || null
      };
      // Optional: try to ping frontend if URL exists
      if (process.env.FRONTEND_URL) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          await fetch(process.env.FRONTEND_URL, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          vercelService.online = true;
          vercelService.status = 'online';
        } catch (e) {
          vercelService.online = false;
          vercelService.status = 'unreachable';
        }
      }
    }
    services.push(vercelService);

    // Database
    const dbService = {
      key: 'database',
      name: 'Database',
      configured: false,
      online: false,
      status: 'not_configured',
      last_checked: checkedAt,
      last_configured: null,
      details: {}
    };
    const dbUrl = process.env.DATABASE_URL || '';
    const dbHost = process.env.DB_HOST || '';
    const hasDbConfig = dbUrl || (dbHost && process.env.DB_USER && process.env.DB_NAME);
    if (hasDbConfig) {
      dbService.configured = true;
      // Detect provider
      const hostHint = (dbUrl || dbHost).toLowerCase();
      if (hostHint.includes('supabase.co') || hostHint.includes('supabase.com')) {
        dbService.provider = 'Supabase';
      } else if (hostHint.includes('render.com')) {
        dbService.provider = 'Render Postgres';
      } else {
        dbService.provider = 'PostgreSQL';
      }
      // Test connectivity
      try {
        await pool.query('SELECT 1');
        dbService.online = true;
        dbService.status = 'connected';
        dbService.details = {
          provider: dbService.provider,
          ssl: !!require('../utils/db').pgSsl
        };
      } catch (e) {
        dbService.online = false;
        dbService.status = 'unreachable';
        dbService.details = {
          provider: dbService.provider,
          error: String(e.message || 'Connection failed')
        };
      }
    }
    services.push(dbService);

    // Cloudinary
    const cloudinaryService = {
      key: 'cloudinary',
      name: 'Cloudinary',
      configured: false,
      online: false,
      status: 'not_configured',
      last_checked: checkedAt,
      last_configured: null,
      details: {}
    };
    const hasCloudinary = process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    if (hasCloudinary) {
      cloudinaryService.configured = true;
      cloudinaryService.status = 'configured';
      cloudinaryService.details = {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || null
      };
      // Optional: could ping Cloudinary API, but keep it simple for now
      cloudinaryService.online = true;
    }
    services.push(cloudinaryService);

    // Resend Email
    const resendService = {
      key: 'resend',
      name: 'Resend Email',
      configured: false,
      online: false,
      status: 'not_configured',
      last_checked: checkedAt,
      last_configured: null,
      details: {}
    };
    if (process.env.RESEND_API_KEY) {
      resendService.configured = true;
      resendService.status = 'configured';
      resendService.details = {
        from_email: process.env.RESEND_FROM_EMAIL || null
      };
      // Actual connectivity is tested during email sending
      resendService.online = true;
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      resendService.name = 'SMTP Email (Fallback)';
      resendService.configured = true;
      resendService.status = 'configured';
      resendService.details = {
        host: process.env.SMTP_HOST,
        user: process.env.SMTP_USER
      };
      resendService.online = true;
    }
    services.push(resendService);

    // reCAPTCHA
    const recaptchaService = {
      key: 'recaptcha',
      name: 'Google reCAPTCHA',
      configured: false,
      online: false,
      status: 'not_configured',
      last_checked: checkedAt,
      last_configured: null,
      details: {}
    };
    if (process.env.RECAPTCHA_SECRET_KEY) {
      recaptchaService.configured = true;
      recaptchaService.status = 'configured';
      recaptchaService.details = {
        site_key: process.env.RECAPTCHA_SITE_KEY || null
      };
      recaptchaService.online = true;
    }
    services.push(recaptchaService);

    res.json({
      checked_at: checkedAt,
      services
    });
  } catch (err) {
    console.error('Superadmin status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/superadmin/admin ──────────────────────────────────────────────────
router.get('/admin', requireSuperAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const offset = (page - 1) * limit;

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE role IN ('admin', 'super_admin')`
    );
    const result = await pool.query(
      `SELECT id, username, email, full_name, first_name, middle_name, last_name, role, is_verified, is_disabled, created_at
       FROM users
       WHERE role IN ('admin', 'super_admin')
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ admin: result.rows, total: totalRes.rows[0]?.count || 0, page, limit });
  } catch (err) {
    console.error('Superadmin get admin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/superadmin/announcements — broadcast platform notice ───────────
router.post('/announcements', requireSuperAdmin, requireAnnouncementsEnabled, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const audience = String(req.body?.audience || 'all').trim().toLowerCase();
    
    const audienceMap = {
      farmer: ['farmer'],
      customer: ['customer'],
      admin: ['admin', 'super_admin'],
      all: ['farmer', 'customer', 'admin', 'super_admin']
    };

    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required' });
    }

    // Handle comma-separated audience values (e.g., "farmer,customer")
    const audienceValues = audience.split(',').map(a => a.trim()).filter(a => a);
    let roles = [];

    if (audienceValues.length === 0) {
      return res.status(400).json({ message: 'Invalid audience' });
    }

    // Map each audience value to its roles and combine
    for (const aud of audienceValues) {
      const mappedRoles = audienceMap[aud];
      if (mappedRoles) {
        roles.push(...mappedRoles);
      }
    }

    // Remove duplicates
    roles = [...new Set(roles)];

    if (roles.length === 0) {
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

    // Create announcement record for dismissible banner
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
    
    await pool.query(
      `INSERT INTO announcements (title, message, audience, is_active, is_dismissible, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [title, message, audience, expiresAt]
    );

    // Broadcast notification.created event for each recipient
    const notifiedUserIds = insertRes.rows.map(row => row.user_id);
    for (const userId of notifiedUserIds) {
      broadcastEvent('notification.created', { user_id: userId });
    }
    
    // Broadcast announcement.created event for banner updates
    broadcastEvent('announcement.created', { audience });

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

// ── GET /api/superadmin/announcements — get active announcements (public) ─────
router.get('/announcements', async (req, res) => {
  try {
    const userRole = req.query?.role || 'customer';
    
    const result = await pool.query(
      `SELECT id, title, message, audience, is_dismissible, expires_at 
       FROM announcements 
       WHERE is_active = true 
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         AND (audience = 'all' OR audience = $1)
       ORDER BY created_at DESC`,
      [userRole]
    );
    
    res.json({ announcements: result.rows });
  } catch (err) {
    console.error('Get announcements error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/superadmin/users — create any account ───────────────────────────
router.post('/users', requireSuperAdmin, async (req, res) => {
  try {
    const { first_name, middle_name, last_name, full_name, email, username, password, role } = req.body || {};

    const allowedRoles = ['admin', 'super_admin', 'farmer', 'customer'];
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

    // Validate name lengths (40 characters max)
    const fn = String(first_name || '').trim();
    const mn = String(middle_name || '').trim();
    const ln = String(last_name || '').trim();
    if (fn.length > 40) {
      return res.status(400).json({ message: 'First name must be 40 characters or less' });
    }
    if (mn.length > 40) {
      return res.status(400).json({ message: 'Middle name must be 40 characters or less' });
    }
    if (ln.length > 40) {
      return res.status(400).json({ message: 'Last name must be 40 characters or less' });
    }

    // Derive display name
    const displayName = fn && ln
      ? `${fn}${mn ? ' ' + mn : ''} ${ln}`.trim()
      : String(full_name || '').trim() || cleanUsername;
    const isVerified = cleanRole === 'farmer' ? false : true;

    // Force plaintext password storage
    const pwHash = cleanPass;

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

    // Validate name length limits
    if (typeof first_name !== 'undefined' && String(first_name || '').trim().length > 40) {
      return res.status(400).json({ message: 'First name must be 40 characters or less' });
    }
    if (typeof middle_name !== 'undefined' && String(middle_name || '').trim().length > 40) {
      return res.status(400).json({ message: 'Middle name must be 40 characters or less' });
    }
    if (typeof last_name !== 'undefined' && String(last_name || '').trim().length > 40) {
      return res.status(400).json({ message: 'Last name must be 40 characters or less' });
    }

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
      // Force plaintext password storage
      const pwHash = p;
      push('password', pwHash);
    }
    if (typeof role !== 'undefined') {
      const allowedRoles = ['admin', 'super_admin', 'farmer', 'customer'];
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

    // Clear settings cache so changes take effect immediately
    clearSettingsCache();

    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('Superadmin update settings error:', err);
    res.status(500).json({ message: 'Server error updating settings' });
  }
});

// ── PUT /api/superadmin/users/:id/debug-mode ─────────────────────────────────────
// Toggle debug mode for a user (superadmin only)
router.put('/users/:id/debug-mode', requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { enabled } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id, email, is_debug_account FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const before = { is_debug_account: userCheck.rows[0].is_debug_account };

    // Update debug mode
    await pool.query('UPDATE users SET is_debug_account = $1 WHERE id = $2', [enabled, userId]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: req.user.id,
      action: 'user.debug_mode_toggle',
      entity: 'users',
      entity_id: userId,
      before,
      after: { is_debug_account: enabled },
      req
    });

    res.json({ message: 'Debug mode updated', is_debug_account: enabled });
  } catch (err) {
    console.error('Toggle debug mode error:', err);
    res.status(500).json({ message: 'Server error updating debug mode' });
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
