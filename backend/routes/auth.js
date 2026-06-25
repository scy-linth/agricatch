const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../utils/db');

const { sendOtpEmail, sendWelcomeEmail } = require('../utils/emailService');
const { verifyRecaptchaToken } = require('../utils/recaptcha');
const { writeAdminAuditLog } = require('../utils/auditLog');
const { requireRegistrationsEnabled } = require('../middleware/featureFlags');

const router = express.Router();

// Public endpoint to get OTP mode (for frontend to show/hide OTP sections)
router.get('/otp-mode', async (req, res) => {
  try {
    const { getPlatformSetting } = require('../utils/db');
    const otpMode = await getPlatformSetting('otp_mode', 'strict');
    res.json({ otp_mode: otpMode });
  } catch (error) {
    console.error('Error getting OTP mode:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
const PASSWORD_RESET_OTP_TTL_MINUTES = Number.parseInt(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || '15', 10);
const PASSWORD_RESET_MAX_VERIFY_ATTEMPTS = Number.parseInt(process.env.PASSWORD_RESET_MAX_VERIFY_ATTEMPTS || '5', 10);
const PASSWORD_RESET_COOLDOWN_SECONDS = Number.parseInt(process.env.PASSWORD_RESET_COOLDOWN_SECONDS || '60', 10);
const PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = Number.parseInt(process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR || '5', 10);

// Dev-only OTP surfacing toggle (do NOT enable in production)
const DEV_SHOW_PASSWORD_RESET_OTP = (process.env.DEV_SHOW_PASSWORD_RESET_OTP === 'true') && process.env.NODE_ENV !== 'production';
// Plaintext password mode:
// - DEV_PLAINTEXT_PASSWORDS=true works only outside production.
// - ALLOW_PLAINTEXT_PASSWORDS is intentionally disallowed in production to prevent misconfiguration.
const PLAINTEXT_PASSWORDS_ENABLED =
  process.env.NODE_ENV !== 'production' &&
  (process.env.ALLOW_PLAINTEXT_PASSWORDS === 'true' || process.env.DEV_PLAINTEXT_PASSWORDS === 'true');

function isBcryptHash(value) {
  return typeof value === 'string' && value.startsWith('$2') && value.length > 20;
}

function normalizeBcryptHash(hash) {
  const h = String(hash || '');
  // PHP bcrypt hashes often use $2y$; bcryptjs expects $2a$/$2b$.
  if (h.startsWith('$2y$')) return `$2a$${h.slice(4)}`;
  return h;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateNumericOtp() {
  // cryptographically stronger than Math.random
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

async function requireRecaptcha(req, res) {
  // Check platform setting for reCAPTCHA mode
  const { getPlatformSetting } = require('../utils/db');
  const recaptchaMode = await getPlatformSetting('recaptcha_mode', 'auto');
  
  let recaptchaEnabled = false;
  
  if (recaptchaMode === 'auto') {
    // Auto mode: OFF in development, ON in production
    recaptchaEnabled = process.env.NODE_ENV !== 'development';
  } else if (recaptchaMode === 'always_on') {
    // Always ON regardless of environment
    recaptchaEnabled = true;
  } else if (recaptchaMode === 'always_off') {
    // Always OFF regardless of environment
    recaptchaEnabled = false;
  }
  
  // Skip CAPTCHA if disabled
  if (!recaptchaEnabled) {
    return true;
  }

  const token = req.body?.['g-recaptcha-response'] || req.body?.gRecaptchaResponse || '';
  if (!token || !String(token).trim()) {
    res.status(400).json({ message: 'Please complete the CAPTCHA before submitting. If the CAPTCHA is not visible, please refresh the page.' });
    return false;
  }
  const result = await verifyRecaptchaToken(token, { remoteip: getClientIp(req) });
  if (!result.ok) {
    res.status(result.status || 403).json({ message: result.message || 'CAPTCHA verification failed' });
    return false;
  }
  return true;
}

// Very small in-memory rate limiter to avoid account enumeration via different responses.
// Applies equally whether or not the account exists.
const _forgotLimiter = new Map();
function checkForgotRateLimit(key, { maxPerHour, minIntervalSeconds }) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const existing = _forgotLimiter.get(key) || { timestamps: [], lastAt: 0 };
  existing.timestamps = existing.timestamps.filter(ts => ts > hourAgo);

  const secondsSinceLast = existing.lastAt ? Math.floor((now - existing.lastAt) / 1000) : Infinity;
  if (secondsSinceLast < minIntervalSeconds) {
    return { allowed: false, retryAfterSeconds: minIntervalSeconds - secondsSinceLast, reason: 'cooldown' };
  }
  if (existing.timestamps.length >= maxPerHour) {
    const oldest = existing.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000));
    return { allowed: false, retryAfterSeconds, reason: 'hourly' };
  }

  existing.timestamps.push(now);
  existing.lastAt = now;
  _forgotLimiter.set(key, existing);
  return { allowed: true };
}

async function ensurePasswordResetsTable() {
  // best-effort and idempotent
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
}

let USER_COLUMNS_CACHE = null;
async function getUserColumns() {
  if (USER_COLUMNS_CACHE) return USER_COLUMNS_CACHE;
  // Scope to public schema to avoid picking up Supabase's auth.users columns
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'`
  );
  USER_COLUMNS_CACHE = new Set(result.rows.map((row) => row.column_name));
  return USER_COLUMNS_CACHE;
}

async function insertUserRecord({ username, email, fullName, firstName, middleName, lastName, phone, address, role, passwordValue, plainPasswordValue }) {
  const columns = await getUserColumns();
  const fieldNames = [];
  const values = [];

  const pushField = (name, value) => {
    if (!columns.has(name)) return;
    fieldNames.push(name);
    values.push(value);
  };

  pushField('username', username);
  pushField('email', email);
  pushField('full_name', fullName);
  pushField('first_name', firstName);
  pushField('middle_name', middleName);
  pushField('last_name', lastName);
  pushField('phone', phone || null);
  pushField('address', address || null);
  pushField('role', role);
  pushField('user_type', role);
  pushField('password', plainPasswordValue !== undefined ? plainPasswordValue : passwordValue);
  pushField('password_hash', passwordValue);

  if (!fieldNames.length) {
    throw new Error('No compatible user columns found for insert');
  }

  const placeholders = fieldNames.map((_, index) => `$${index + 1}`).join(', ');
  const query = `INSERT INTO users (${fieldNames.join(', ')}) VALUES (${placeholders}) RETURNING id, username, email, full_name, role`;
  const result = await pool.query(query, values);
  return result.rows[0];
}

function getStoredPasswordFromRow(row) {
  if (!row || typeof row !== 'object') return '';
  return row.password_hash || row.password || '';
}

async function updateUserPassword(userId, passwordValue) {
  const columns = await getUserColumns();
  const sets = [];
  const values = [];

  if (columns.has('password')) {
    values.push(passwordValue);
    sets.push(`password = $${values.length}`);
  }
  if (columns.has('password_hash')) {
    values.push(passwordValue);
    sets.push(`password_hash = $${values.length}`);
  }
  if (columns.has('updated_at')) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
  }

  if (!sets.length) {
    throw new Error('No password columns found in users table');
  }

  values.push(userId);
  const query = `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length}`;
  await pool.query(query, values);
}

async function getLoginSelectFields() {
  const columns = await getUserColumns();
  // Always include password fields â€” they are required for auth and must not be dropped
  // even if getUserColumns() returns an incomplete cache.
  const fields = ['id', 'username', 'email', 'full_name', 'role'];
  if (columns.has('is_disabled')) fields.push('is_disabled');
  // Unconditionally include both password columns; if they don't exist the SELECT
  // will throw a clear SQL error rather than silently skipping password verification.
  fields.push('password');
  fields.push('password_hash');
  return fields;
}

async function getPasswordSelectFields() {
  const columns = await getUserColumns();
  const fields = [];
  if (columns.has('password')) fields.push('password');
  if (columns.has('password_hash')) fields.push('password_hash');
  return fields;
}

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.trim().length === 0) {
      return res.status(400).json({ available: false, message: 'Username is required' });
    }

    // Validate username format
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ available: false, message: 'Username must be between 3 and 20 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ available: false, message: 'Username can only contain letters, numbers, and underscores' });
    }

    // Check if username exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.json({ available: false, message: 'This username is already taken' });
    }

    return res.json({ available: true, message: 'Username is available' });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ available: false, message: 'Error checking username availability' });
  }
});

// Register new user
// Note: For farmers, full_name should represent the shop/farm name (not personal name)
// This will be displayed in chat conversations and shop profiles
router.post('/register', requireRegistrationsEnabled, async (req, res) => {
  try {
  if (!(await requireRecaptcha(req, res))) return;

  const { username, email, password, full_name, first_name, middle_name, last_name, phone, address, role = 'customer' } = req.body;

    // Validate phone number format (must start with 9 and be 10 digits)
    if (phone) {
      const phoneDigits = String(phone).replace(/\D/g, '');
      if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
        return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
      }
    }

    // Check if user already exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Verify OTP was verified for this email (for register purpose)
    // Check if OTP is enabled via otp_mode setting
    const { getPlatformSetting } = require('../utils/db');
    const otpMode = await getPlatformSetting('otp_mode', 'strict');

    if (otpMode !== 'disabled') {
      // Check if there's a recently verified OTP that hasn't expired
      const otpCheck = await pool.query(
        `SELECT id, created_at, expires_at FROM otps
         WHERE email = $1 AND purpose = 'register' AND is_used = true
         ORDER BY created_at DESC LIMIT 1`,
        [email]
      );

      if (otpCheck.rows.length === 0) {
        return res.status(403).json({
          message: 'OTP verification required. Please verify your OTP first.'
        });
      }

      const otpRecord = otpCheck.rows[0];
      const now = new Date();
      const otpExpiresAt = new Date(otpRecord.expires_at);

      // In development, use 30 minutes expiration for easier testing
      // In production, use the original 10 minutes
      const isDev = process.env.NODE_ENV === 'development';
      const expirationMinutes = isDev ? 30 : 10;
      const effectiveExpiresAt = new Date(otpRecord.created_at.getTime() + expirationMinutes * 60 * 1000);

      // Check if OTP has expired
      if (effectiveExpiresAt < now) {
        return res.status(403).json({
          message: `OTP verification expired. Please request a new OTP and verify again. (Expires after ${expirationMinutes} minutes)`
        });
      }
    }

    const providedPassword = String(password || '');
    const passwordValue = await bcrypt.hash(providedPassword, BCRYPT_ROUNDS);

    // Validate name lengths (40 characters max)
    const firstName = String(first_name || '').trim();
    const middleName = String(middle_name || '').trim();
    const lastName = String(last_name || '').trim();
    if (firstName.length > 40) {
      return res.status(400).json({ message: 'First name must be 40 characters or less' });
    }
    if (middleName.length > 40) {
      return res.status(400).json({ message: 'Middle name must be 40 characters or less' });
    }
    if (lastName.length > 40) {
      return res.status(400).json({ message: 'Last name must be 40 characters or less' });
    }

    // Role rules:
    // - If password matches ADMIN_SECRET (must be configured) -> admin
    // - Else if registering from farmer flow (role === 'farmer') -> farmer
    // - Otherwise -> customer
    //
    // NOTE: This is intentionally simple per project requirements.
    const requestedRole = String(role || 'customer').toLowerCase();
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret) {
      return res.status(500).json({ message: 'Server configuration error: ADMIN_SECRET not set' });
    }
    const isAdminPassword = String(password || '') === String(expectedSecret);
    let userRole = 'customer';

    if (isAdminPassword) {
      userRole = 'admin';
    } else if (requestedRole === 'farmer') {
      userRole = 'farmer';
    }

    const user = await insertUserRecord({
      username,
      email,
      fullName: full_name,
      firstName: first_name,
      middleName: middle_name,
      lastName: last_name,
      phone,
      address,
      role: userRole,
      passwordValue,
      plainPasswordValue: providedPassword
    });

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, firstName, userRole).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Super admin virtual user storage (in memory for demonstration)
// Note: super-admin should be stored in the `users` table. Virtual/demo
// super-admin was removed in favor of a DB-backed account.

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password, requestedRole, 'g-recaptcha-response': recaptchaToken } = req.body;
    const normalizedRequestedRole = String(requestedRole || '').toLowerCase() === 'admin' ? 'admin' : requestedRole;
    const loginIdentifier = String(email || '').trim(); // Can be either username or email
    const loginIdentifierLower = loginIdentifier.toLowerCase();

    // Note: virtual super-admin bypass removed. Ensure a super-admin user
    // exists in the `users` table (email: scy@linth by default) and log in
    // via the normal database-backed flow. The subsequent code queries the
    // `users` table and handles password checks and role validation.

    if (!(await requireRecaptcha(req, res))) return;

    // Find regular user by either email or username
    const loginSelectFields = await getLoginSelectFields();
    const result = await pool.query(
      `SELECT ${loginSelectFields.join(', ')} FROM users WHERE username = $1 OR email = $1 OR LOWER(email) = $2`,
      [loginIdentifier, loginIdentifierLower]
    );

    if (result.rows.length === 0) {
      await writeAdminAuditLog(pool, {
        actor_admin_id: null,
        action: 'login.failed',
        entity: 'users',
        entity_id: null,
        before: null,
        after: { reason: 'user_not_found', identifier: loginIdentifier },
        req
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_disabled) {
      await writeAdminAuditLog(pool, {
        actor_admin_id: user.id,
        action: 'login.failed',
        entity: 'users',
        entity_id: user.id,
        before: null,
        after: { reason: 'account_disabled', identifier: loginIdentifier },
        req
      });
      return res.status(403).json({ message: 'Account disabled. Please contact support.' });
    }

    // Check password (backward-compatible):
    // - If stored password is bcrypt hash, use bcrypt compare
    // - Else fall back to plaintext compare for legacy accounts
    const storedPassword = getStoredPasswordFromRow(user);
    const providedPassword = String(password || '');
    let passwordOk = false;

    if (PLAINTEXT_PASSWORDS_ENABLED) {
      // Development-only: keep password checks as direct plaintext equality.
      passwordOk = providedPassword === String(storedPassword || '');
    } else if (isBcryptHash(storedPassword)) {
      try {
        passwordOk = await bcrypt.compare(providedPassword, normalizeBcryptHash(storedPassword));
      } catch (e) {
        console.error('bcrypt compare failed:', e.message);
        passwordOk = false;
      }

      // Fallback: if bcrypt compare failed but a legacy plaintext `password` column exists and matches,
      // accept the login and upgrade the stored password to a bcrypt hash.
      if (!passwordOk && user.password && String(user.password) === providedPassword) {
        passwordOk = true;
        try {
          const newHash = await bcrypt.hash(providedPassword, BCRYPT_ROUNDS);
          await updateUserPassword(user.id, newHash);
          console.log(`Upgraded plaintext password to bcrypt for user ${user.id}`);
        } catch (e) {
          console.warn('Failed to upgrade password hash:', e.message);
        }
      }
    } else {
      // Stored value is not a bcrypt hash (legacy plaintext). Compare directly and then upgrade to bcrypt.
      passwordOk = providedPassword === String(storedPassword || '');
      if (passwordOk) {
        try {
          const newHash = await bcrypt.hash(providedPassword, BCRYPT_ROUNDS);
          await updateUserPassword(user.id, newHash);
          console.log(`Upgraded legacy plaintext password to bcrypt for user ${user.id}`);
        } catch (e) {
          console.warn('Failed to upgrade plaintext password to bcrypt:', e.message);
        }
      }
    }

    if (!passwordOk) {
      await writeAdminAuditLog(pool, {
        actor_admin_id: user.id,
        action: 'login.failed',
        entity: 'users',
        entity_id: user.id,
        before: null,
        after: { reason: 'invalid_password', identifier: loginIdentifier },
        req
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // OTP verification removed from login - users can login directly with email/password
    // Role validation: Allow admin/super_admin to login with any requested role
    // For non-admin users, validate that their actual role matches requested role
    if (normalizedRequestedRole && user.role !== 'admin' && user.role !== 'super_admin') {
      if (user.role !== normalizedRequestedRole) {
        return res.status(403).json({ message: `Access denied. This login is for ${normalizedRequestedRole}s only.` });
      }
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    delete user.password;
    delete user.password_hash;

    await writeAdminAuditLog(pool, {
      actor_admin_id: user.id,
      action: 'login.success',
      entity: 'users',
      entity_id: user.id,
      before: null,
      after: { role: user.role, identifier: loginIdentifier },
      req
    });

    res.json({
      message: 'Login successful',
      user,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Recover admin role (for accidental demotion)
// Requires a secret so random users can't promote themselves.
router.post('/recover-admin', async (req, res) => {
  try {
    const { email, admin_secret } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret) {
      return res.status(500).json({ message: 'Server configuration error: ADMIN_SECRET not set' });
    }
    if (!admin_secret || admin_secret !== expectedSecret) {
      return res.status(403).json({ message: 'Invalid admin secret' });
    }

    const result = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, username, email, full_name, role",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Role updated to admin', user: result.rows[0] });
  } catch (error) {
    console.error('Recover admin error:', error);
    res.status(500).json({ message: 'Server error recovering admin role' });
  }
});

// Logout endpoint (logs audit log)
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    let userId = null;
    let userEmail = null;
    let userRole = null;
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        userEmail = decoded.email;
        userRole = decoded.role;
      } catch (err) {
        // Token invalid, but still log the attempt
      }
    }
    
    // Log logout to audit logs
    if (userId) {
      await writeAdminAuditLog(pool, {
        actor_admin_id: userId,
        action: 'logout.success',
        entity: 'users',
        entity_id: userId,
        before: null,
        after: { role: userRole, email: userEmail },
        req
      });
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const columns = await getUserColumns();
    const selectFields = ['id', 'username', 'email', 'full_name', 'role', 'created_at'];
    [
      'first_name',
      'middle_name',
      'last_name',
      'shop_name',
      'phone',
      'address',
      'shop_description',
      'shop_banner_url',
      'shop_avatar_url',
      'is_verified',
      'is_disabled',
      'disabled_reason'
    ].forEach((field) => {
      if (columns.has(field)) selectFields.push(field);
    });

    const result = await pool.query(
      `SELECT ${selectFields.join(', ')} FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Get profile error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Alias for /me endpoint (for compatibility)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const columns = await getUserColumns();
    const selectFields = ['id', 'username', 'email', 'full_name', 'role', 'created_at'];
    [
      'first_name',
      'middle_name',
      'last_name',
      'shop_name',
      'phone',
      'address',
      'shop_description',
      'shop_banner_url',
      'shop_avatar_url',
      'is_verified',
      'is_disabled',
      'disabled_reason'
    ].forEach((field) => {
      if (columns.has(field)) selectFields.push(field);
    });

    const result = await pool.query(
      `SELECT ${selectFields.join(', ')} FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const columns = await getUserColumns();
    const hasColumn = (column) => columns.has(column);
    const currentUserFields = ['id', 'username', 'full_name', 'first_name', 'middle_name', 'last_name', 'shop_name']
      .filter(hasColumn);
    const profileRes = await pool.query(
      `SELECT ${currentUserFields.join(', ')} FROM users WHERE id = $1`,
      [decoded.id]
    );
    if (!profileRes.rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = profileRes.rows[0];
    const body = req.body || {};
    const username = body.username;
    const phone = body.phone;
    const address = body.address;
    const shopName = body.shop_name;
    const providedFirstName = Object.prototype.hasOwnProperty.call(body, 'first_name');
    const providedMiddleName = Object.prototype.hasOwnProperty.call(body, 'middle_name');
    const providedLastName = Object.prototype.hasOwnProperty.call(body, 'last_name');
    const providedFullName = Object.prototype.hasOwnProperty.call(body, 'full_name');
    const providedShopName = Object.prototype.hasOwnProperty.call(body, 'shop_name');

    if (username && String(username).trim().length > 0) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1',
        [String(username).trim(), decoded.id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;
    const push = (column, value) => {
      updates.push(`${column} = $${paramIndex++}`);
      values.push(value);
    };

    if (typeof username !== 'undefined') {
      const nextUsername = String(username || '').trim();
      if (!nextUsername) {
        return res.status(400).json({ message: 'Username cannot be empty' });
      }
      push('username', nextUsername);
    }

    const firstName = providedFirstName ? String(body.first_name || '').trim() : String(currentUser.first_name || '').trim();
    const middleName = providedMiddleName ? String(body.middle_name || '').trim() : String(currentUser.middle_name || '').trim();
    const lastName = providedLastName ? String(body.last_name || '').trim() : String(currentUser.last_name || '').trim();
    const fallbackFullName = providedFullName ? String(body.full_name || '').trim() : String(currentUser.full_name || '').trim();

    if (providedFirstName || providedMiddleName || providedLastName || providedFullName) {
      if ((providedFirstName || providedLastName || providedMiddleName) && (!firstName || !lastName)) {
        return res.status(400).json({ message: 'First name and last name are required when updating name fields' });
      }
      if (firstName.length > 40) {
        return res.status(400).json({ message: 'First name must be 40 characters or less' });
      }
      if (middleName.length > 40) {
        return res.status(400).json({ message: 'Middle name must be 40 characters or less' });
      }
      if (lastName.length > 40) {
        return res.status(400).json({ message: 'Last name must be 40 characters or less' });
      }

      const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim() || fallbackFullName;
      if (!displayName) {
        return res.status(400).json({ message: 'Full name is required' });
      }

      if (hasColumn('full_name')) {
        push('full_name', displayName);
      }
      if (providedFirstName || providedLastName || providedMiddleName) {
        if (hasColumn('first_name')) push('first_name', firstName || null);
        if (hasColumn('middle_name')) push('middle_name', middleName || null);
        if (hasColumn('last_name')) push('last_name', lastName || null);
      }
    }

    if (providedShopName && hasColumn('shop_name')) {
      const nextShopName = String(shopName || '').trim();
      if (!nextShopName) {
        return res.status(400).json({ message: 'Shop name cannot be empty' });
      }
      if (nextShopName.length > 40) {
        return res.status(400).json({ message: 'Shop name must be 40 characters or less' });
      }
      push('shop_name', nextShopName);
    }

    if (typeof phone !== 'undefined' && hasColumn('phone')) {
      const nextPhone = String(phone || '').trim();
      if (nextPhone) {
        const phoneDigits = nextPhone.replace(/\D/g, '');
        if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
          return res.status(400).json({ message: 'Phone number must be 10 digits starting with 9' });
        }
      }
      push('phone', nextPhone || null);
    }
    if (typeof address !== 'undefined' && hasColumn('address')) push('address', String(address || '').trim() || null);

    if (!updates.length) {
      return res.status(400).json({ message: 'No profile fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(decoded.id);
    const returningFields = [
      'id',
      'username',
      'email',
      'full_name',
      'first_name',
      'middle_name',
      'last_name',
      'shop_name',
      'phone',
      'address',
      'role',
      'is_verified',
      'is_disabled',
      'disabled_reason',
      'created_at'
    ].filter(hasColumn);
    const updated = await pool.query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING ${returningFields.join(', ')}`,
      values
    );

    res.json({ message: 'Profile updated successfully', user: updated.rows[0] });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

// Forgot Password (OTP) flow

router.post('/forgot', async (req, res) => {
  const genericMessage = "If that email exists, we've sent a verification code.";
  try {
    // Check if OTP is enabled via otp_mode setting
    const { getPlatformSetting } = require('../utils/db');
    const otpMode = await getPlatformSetting('otp_mode', 'strict');
    if (otpMode === 'disabled') {
      return res.status(403).json({ message: 'Password reset via OTP is currently disabled' });
    }
    
    if (!(await requireRecaptcha(req, res))) return;

    await ensurePasswordResetsTable();

    const email = normalizeEmail(req.body?.email);
    const ip = getClientIp(req);
    const limiterKey = `${ip}:${email || 'noemail'}`;
    const rl = checkForgotRateLimit(limiterKey, {
      maxPerHour: PASSWORD_RESET_MAX_REQUESTS_PER_HOUR,
      minIntervalSeconds: PASSWORD_RESET_COOLDOWN_SECONDS
    });

    if (!rl.allowed) {
      return res.status(429).json({ message: genericMessage, retryAfter: rl.retryAfterSeconds, cooldownSeconds: rl.retryAfterSeconds });
    }

    if (!email || !isValidEmail(email)) {
      return res.json({ message: genericMessage });
    }

    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.json({ message: genericMessage });
    }

    const userId = userRes.rows[0].id;
    const otp = generateNumericOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);

    // Invalidate prior unused reset requests for this user
    await pool.query('UPDATE password_resets SET used = true, used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used = false', [userId]);

    await pool.query(
      `INSERT INTO password_resets (user_id, email, otp_hash, expires_at, request_ip, user_agent, sent_count, last_sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP)`,
      [userId, email, otpHash, expiresAt, ip, userAgent]
    );

    // Best-effort cleanup
    await pool.query('DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL \'7 days\'');

    const emailResult = await sendOtpEmail(email, otp, 'reset_password');
    if (!emailResult?.success) {
      console.error('Forgot password email send failed:', emailResult?.error);
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: userId,
      action: 'auth.recover_admin',
      entity: 'users',
      entity_id: userId,
      before: null,
      after: { email, purpose: 'password_reset' },
      req
    });

    if (DEV_SHOW_PASSWORD_RESET_OTP) {
      return res.json({ message: genericMessage, debugOtp: otp, expiresIn: PASSWORD_RESET_OTP_TTL_MINUTES * 60 });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.json({ message: genericMessage });
  }
});

router.post('/forgot/resend', async (req, res) => {
  const genericMessage = "If that email exists, we've sent a verification code.";
  try {
    // Check if OTP is enabled via otp_mode setting
    const { getPlatformSetting } = require('../utils/db');
    const otpMode = await getPlatformSetting('otp_mode', 'strict');
    if (otpMode === 'disabled') {
      return res.status(403).json({ message: 'Password reset via OTP is currently disabled' });
    }
    
    if (!(await requireRecaptcha(req, res))) return;

    await ensurePasswordResetsTable();

    const email = normalizeEmail(req.body?.email);
    const ip = getClientIp(req);
    const limiterKey = `${ip}:${email || 'noemail'}`;
    const rl = checkForgotRateLimit(limiterKey, {
      maxPerHour: PASSWORD_RESET_MAX_REQUESTS_PER_HOUR,
      minIntervalSeconds: PASSWORD_RESET_COOLDOWN_SECONDS
    });

    if (!rl.allowed) {
      return res.status(429).json({ message: genericMessage, retryAfter: rl.retryAfterSeconds, cooldownSeconds: rl.retryAfterSeconds });
    }

    if (!email || !isValidEmail(email)) {
      return res.json({ message: genericMessage });
    }

    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.json({ message: genericMessage });
    }

    const userId = userRes.rows[0].id;
    const otp = generateNumericOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60 * 1000);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);

    await pool.query('UPDATE password_resets SET used = true, used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used = false', [userId]);
    await pool.query(
      `INSERT INTO password_resets (user_id, email, otp_hash, expires_at, request_ip, user_agent, sent_count, last_sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP)`,
      [userId, email, otpHash, expiresAt, ip, userAgent]
    );

    const emailResult = await sendOtpEmail(email, otp, 'reset_password');
    if (!emailResult?.success) {
      console.error('Forgot password resend email send failed:', emailResult?.error);
    }

    await writeAdminAuditLog(pool, {
      actor_admin_id: userId,
      action: 'auth.recover_admin',
      entity: 'users',
      entity_id: userId,
      before: null,
      after: { email, purpose: 'password_reset_resend' },
      req
    });

    if (DEV_SHOW_PASSWORD_RESET_OTP) {
      return res.json({ message: genericMessage, debugOtp: otp, expiresIn: PASSWORD_RESET_OTP_TTL_MINUTES * 60 });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password resend error:', error);
    return res.json({ message: genericMessage });
  }
});

router.post('/forgot/verify-otp', async (req, res) => {
  try {
    await ensurePasswordResetsTable();

    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();

    if (!email || !isValidEmail(email) || !otp) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }
    const userId = userRes.rows[0].id;

    const resetRes = await pool.query(
      `SELECT id, otp_hash, expires_at, attempts
       FROM password_resets
       WHERE user_id = $1 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (resetRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const record = resetRes.rows[0];
    if (new Date(record.expires_at) < new Date()) {
      await pool.query('UPDATE password_resets SET used = true, used_at = CURRENT_TIMESTAMP WHERE id = $1', [record.id]);
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    if (Number(record.attempts || 0) >= PASSWORD_RESET_MAX_VERIFY_ATTEMPTS) {
      await pool.query('UPDATE password_resets SET used = true, used_at = CURRENT_TIMESTAMP WHERE id = $1', [record.id]);
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
    }

    const otpOk = await bcrypt.compare(otp, record.otp_hash);
    if (!otpOk) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      const attemptsLeft = Math.max(0, PASSWORD_RESET_MAX_VERIFY_ATTEMPTS - (Number(record.attempts || 0) + 1));
      return res.status(400).json({ message: 'Invalid or expired code.', attemptsLeft });
    }

    return res.json({ message: 'Code verified.', verified: true });
  } catch (error) {
    console.error('Forgot password verify-otp error:', error);
    return res.status(500).json({ message: 'Server error verifying code.' });
  }
});

router.post('/forgot/reset', async (req, res) => {
  try {
    await ensurePasswordResetsTable();

    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !isValidEmail(email) || !otp || !newPassword) {
      return res.status(400).json({ message: 'Invalid request.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }
    const userId = userRes.rows[0].id;

    const resetRes = await pool.query(
      `SELECT id, otp_hash, expires_at, attempts
       FROM password_resets
       WHERE user_id = $1 AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (resetRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const record = resetRes.rows[0];
    if (new Date(record.expires_at) < new Date()) {
      await pool.query('UPDATE password_resets SET used = true, used_at = CURRENT_TIMESTAMP WHERE id = $1', [record.id]);
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }
    if (Number(record.attempts || 0) >= PASSWORD_RESET_MAX_VERIFY_ATTEMPTS) {
      await pool.query('UPDATE password_resets SET used = true, used_at = CURRENT_TIMESTAMP WHERE id = $1', [record.id]);
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
    }

    const otpOk = await bcrypt.compare(otp, record.otp_hash);
    if (!otpOk) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      const attemptsLeft = Math.max(0, PASSWORD_RESET_MAX_VERIFY_ATTEMPTS - (Number(record.attempts || 0) + 1));
      return res.status(400).json({ message: 'Invalid or expired code.', attemptsLeft });
    }

    const newPasswordValue = PLAINTEXT_PASSWORDS_ENABLED
      ? newPassword
      : await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updateUserPassword(userId, newPasswordValue);
    await pool.query('UPDATE password_resets SET used = true, used_at = CURRENT_TIMESTAMP WHERE id = $1', [record.id]);

    return res.json({ message: 'Password reset successful.' });
  } catch (error) {
    console.error('Forgot password reset error:', error);
    return res.status(500).json({ message: 'Server error resetting password.' });
  }
});

// Authenticated change password
router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    const userId = decoded?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    const currentPassword = String(req.body?.currentPassword || req.body?.current_password || '');
    const newPassword = String(req.body?.newPassword || req.body?.new_password || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const passwordFields = await getPasswordSelectFields();
    if (!passwordFields.length) {
      return res.status(500).json({ message: 'Password columns are missing on users table.' });
    }

    const userRes = await pool.query(`SELECT ${passwordFields.join(', ')} FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const stored = getStoredPasswordFromRow(userRes.rows[0]);
    let ok = false;
    if (PLAINTEXT_PASSWORDS_ENABLED) {
      ok = String(stored || '') === currentPassword;
    } else if (isBcryptHash(stored)) {
      try {
        ok = await bcrypt.compare(currentPassword, normalizeBcryptHash(stored));
      } catch (_) {
        ok = false;
      }
    } else {
      ok = String(stored || '') === currentPassword;
    }
    if (!ok) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const newPasswordValue = PLAINTEXT_PASSWORDS_ENABLED
      ? newPassword
      : await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updateUserPassword(userId, newPasswordValue);

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error updating password.' });
  }
});

// Get public feature flags (no auth required for farmer-facing flags)
router.get('/feature-flags', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, enabled FROM feature_flags WHERE key IN ('require_product_approval')"
    );
    const flags = {};
    result.rows.forEach(row => {
      flags[row.key] = row.enabled;
    });
    res.json({ flags });
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;