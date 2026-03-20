const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../utils/db');

const { sendOtpEmail } = require('../utils/emailService');

const router = express.Router();

const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
const PASSWORD_RESET_OTP_TTL_MINUTES = Number.parseInt(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || '15', 10);
const PASSWORD_RESET_MAX_VERIFY_ATTEMPTS = Number.parseInt(process.env.PASSWORD_RESET_MAX_VERIFY_ATTEMPTS || '5', 10);
const PASSWORD_RESET_COOLDOWN_SECONDS = Number.parseInt(process.env.PASSWORD_RESET_COOLDOWN_SECONDS || '60', 10);
const PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = Number.parseInt(process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR || '5', 10);

// Dev-only OTP surfacing toggle (do NOT enable in production)
const DEV_SHOW_PASSWORD_RESET_OTP = (process.env.DEV_SHOW_PASSWORD_RESET_OTP === 'true') && process.env.NODE_ENV !== 'production';

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
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
  );
  USER_COLUMNS_CACHE = new Set(result.rows.map((row) => row.column_name));
  return USER_COLUMNS_CACHE;
}

async function insertUserRecord({ username, email, fullName, phone, address, role, passwordHash }) {
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
  pushField('phone', phone || null);
  pushField('address', address || null);
  pushField('role', role);
  pushField('user_type', role);
  pushField('password', passwordHash);
  pushField('password_hash', passwordHash);

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

async function updateUserPassword(userId, hashedPassword) {
  const columns = await getUserColumns();
  const sets = [];
  const values = [];

  if (columns.has('password')) {
    values.push(hashedPassword);
    sets.push(`password = $${values.length}`);
  }
  if (columns.has('password_hash')) {
    values.push(hashedPassword);
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
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, address, role = 'customer' } = req.body;

    // Check if user already exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Verify OTP was verified for this email (for register purpose)
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
    const otpCreatedAt = new Date(otpRecord.created_at);
    
    // Check if OTP has expired (expires_at is in the past)
    if (otpExpiresAt < now) {
      return res.status(403).json({ 
        message: 'OTP verification expired. Please request a new OTP and verify again.' 
      });
    }

    // Check if OTP was created recently (within last 10 minutes - OTP validity period)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (otpCreatedAt < tenMinutesAgo) {
      return res.status(403).json({ 
        message: 'OTP verification expired. Please request a new OTP and verify again.' 
      });
    }

    // Store password as bcrypt hash (existing plaintext accounts are still supported at login).
    const hashedPassword = await bcrypt.hash(String(password || ''), BCRYPT_ROUNDS);

    // Role rules:
    // - If password matches ADMIN_SECRET (default: 'admin123') -> staff
    // - Else if registering from farmer flow (role === 'farmer') -> farmer
    // - Otherwise -> customer
    //
    // NOTE: This is intentionally simple per project requirements.
    const requestedRole = String(role || 'customer').toLowerCase();
    const expectedSecret = process.env.ADMIN_SECRET || 'admin123';
    const isStaffPassword = String(password || '') === String(expectedSecret);
    let userRole = 'customer';

    if (isStaffPassword) {
      userRole = 'staff';
    } else if (requestedRole === 'farmer') {
      userRole = 'farmer';
    }

    const user = await insertUserRecord({
      username,
      email,
      fullName: full_name,
      phone,
      address,
      role: userRole,
      passwordHash: hashedPassword
    });

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '24h' }
    );

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
let superAdminProfile = {
  id: -1,
  username: 'scy_linth',
  email: 'scy@linth',
  full_name: 'Super Administrator',
  phone: '+63 999 999 9999',
  address: 'Super Admin Office, Virtual',
  role: 'super_admin'
};

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password, requestedRole } = req.body;
    const normalizedRequestedRole = String(requestedRole || '').toLowerCase() === 'admin' ? 'staff' : requestedRole;
    const loginIdentifier = email; // Can be either username or email

    // Check for hardcoded super admin credentials first (both email and username)
    // Super admin bypasses OTP for convenience
    if ((loginIdentifier === 'scy@linth' || loginIdentifier === 'scy_linth') && password === '1234') {
      // Create JWT token for super admin
      const token = jwt.sign(
        { id: -1, username: 'scy_linth', role: 'super_admin' },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        user: { ...superAdminProfile },
        token
      });
      return;
    }

    // Find regular user by either email or username
    const result = await pool.query(
      'SELECT id, username, email, password, password_hash, full_name, role FROM users WHERE email = $1 OR username = $1',
      [loginIdentifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password (backward-compatible):
    // - If stored password is bcrypt hash, use bcrypt compare
    // - Else fall back to plaintext compare for legacy accounts
    const storedPassword = getStoredPasswordFromRow(user);
    const providedPassword = String(password || '');
    let passwordOk = false;

    // If the stored value is a bcrypt hash, prefer bcrypt compare
    if (isBcryptHash(storedPassword)) {
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
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // OTP verification removed from login - users can login directly with email/password
    // Role validation: Allow staff/super_admin to login with any requested role
    // For non-staff users, validate that their actual role matches requested role
    if (normalizedRequestedRole && user.role !== 'staff' && user.role !== 'super_admin') {
      if (user.role !== normalizedRequestedRole) {
        return res.status(403).json({ message: `Access denied. This login is for ${normalizedRequestedRole}s only.` });
      }
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '24h' }
    );

    // Remove password from response
    delete user.password;
    delete user.password_hash;

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

    const expectedSecret = process.env.ADMIN_SECRET || 'admin123';
    if (!admin_secret || admin_secret !== expectedSecret) {
      return res.status(403).json({ message: 'Invalid admin secret' });
    }

    const result = await pool.query(
      "UPDATE users SET role = 'staff' WHERE email = $1 RETURNING id, username, email, full_name, role",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Role updated to staff', user: result.rows[0] });
  } catch (error) {
    console.error('Recover admin error:', error);
    res.status(500).json({ message: 'Server error recovering admin role' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

    // Check if this is super admin (virtual user)
    if (decoded.id === -1 && decoded.role === 'super_admin') {
      res.json({ user: { ...superAdminProfile, created_at: new Date().toISOString() } });
      return;
    }

    const result = await pool.query(
      'SELECT id, username, email, full_name, phone, address, shop_description, shop_banner_url, shop_avatar_url, role, created_at FROM users WHERE id = $1',
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    const { username, full_name, phone, address } = req.body;

    if (username && String(username).trim().length > 0) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1',
        [String(username).trim(), decoded.id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           full_name = COALESCE($2, full_name),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [username || null, full_name || null, phone || null, address || null, decoded.id]
    );

    res.json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

// Forgot Password (OTP) flow

router.post('/forgot', async (req, res) => {
  const genericMessage = "If that email exists, we've sent a verification code.";
  try {
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

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updateUserPassword(userId, newHash);
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
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    } catch (_) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    const userId = decoded?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const userRes = await pool.query('SELECT password, password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const stored = getStoredPasswordFromRow(userRes.rows[0]);
    let ok = false;
    if (isBcryptHash(stored)) {
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

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updateUserPassword(userId, newHash);

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error updating password.' });
  }
});

module.exports = router;