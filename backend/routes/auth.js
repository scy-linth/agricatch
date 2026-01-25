const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();
const pgSsl = String(process.env.DB_HOST || '').includes('render.com')
  ? { rejectUnauthorized: false }
  : false;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agri_fishery_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: pgSsl,
});

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

    // Store password as plain text for demonstration (NOT SECURE!)
    const hashedPassword = password;

    // Role rules:
    // - If password matches ADMIN_SECRET (default: 'admin123') -> admin
    // - Else if registering from farmer flow (role === 'farmer') -> farmer
    // - Otherwise -> customer
    //
    // NOTE: This is intentionally simple per project requirements.
    const requestedRole = String(role || 'customer').toLowerCase();
    const expectedSecret = process.env.ADMIN_SECRET || 'admin123';
    const isAdminPassword = String(password || '') === String(expectedSecret);
    let userRole = 'customer';

    if (isAdminPassword) {
      userRole = 'admin';
    } else if (requestedRole === 'farmer') {
      userRole = 'farmer';
    }

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (username, email, password, full_name, phone, address, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, full_name, role',
      [username, email, hashedPassword, full_name, phone, address, userRole]
    );

    const user = result.rows[0];

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
      'SELECT id, username, email, password, full_name, role FROM users WHERE email = $1 OR username = $1',
      [loginIdentifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password (plain text for demonstration - NOT SECURE!)
    if (password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify OTP was verified for this email (for login purpose)
    // Check if there's a recently verified OTP that hasn't expired
    const otpCheck = await pool.query(
      `SELECT id, created_at, expires_at FROM otps 
       WHERE email = $1 AND purpose = 'login' AND is_used = true 
       ORDER BY created_at DESC LIMIT 1`,
      [user.email]
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

    // Role validation: Allow admin/super_admin to login with any requested role
    // For non-admin users, validate that their actual role matches requested role
    if (requestedRole && user.role !== 'admin' && user.role !== 'super_admin') {
      if (user.role !== requestedRole) {
        return res.status(403).json({ message: `Access denied. This login is for ${requestedRole}s only.` });
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
      'SELECT id, username, email, full_name, phone, address, role, created_at FROM users WHERE id = $1',
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
    const { full_name, phone, address } = req.body;

    await pool.query(
      'UPDATE users SET full_name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [full_name, phone, address, decoded.id]
    );

    res.json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

module.exports = router;