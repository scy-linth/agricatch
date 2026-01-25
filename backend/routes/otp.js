const express = require('express');
const { Pool } = require('pg');
const { sendOtpEmail } = require('../utils/emailService');
require('dotenv').config();

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

/**
 * Generate a 6-digit OTP
 */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP to email
 * POST /api/otp/send
 * Body: { email: string, purpose: 'login' | 'register' | 'reset_password' }
 */
router.post('/send', async (req, res) => {
  try {
    console.log('📧 OTP send request received:', { email: req.body.email, purpose: req.body.purpose });
    const { email, purpose = 'login' } = req.body;

    if (!email) {
      console.log('❌ OTP send failed: Email is required');
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // For register: check if email already exists
    if (purpose === 'register') {
      try {
        const userExists = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );
        if (userExists.rows.length > 0) {
          console.log('❌ OTP send failed: Email already registered');
          return res.status(400).json({ message: 'Email already registered' });
        }
      } catch (dbError) {
        console.error('❌ DB Error checking user existence:', dbError);
        throw new Error('Database error while checking email availability');
      }
    }

    // For login: check if email exists
    if (purpose === 'login') {
      const userExists = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $1',
        [email]
      );
      if (userExists.rows.length === 0) {
        return res.status(404).json({ message: 'Email not found' });
      }
    }

    // Rate limiting: Check if OTP was sent recently (60 second cooldown)
    try {
      const recentOtp = await pool.query(
        `SELECT created_at FROM otps 
         WHERE email = $1 AND purpose = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [email, purpose]
      );

      if (recentOtp.rows.length > 0) {
        const lastSent = new Date(recentOtp.rows[0].created_at);
        const now = new Date();
        const secondsSinceLastSent = Math.floor((now - lastSent) / 1000);
        const cooldownSeconds = 60; // 60 second cooldown

        if (secondsSinceLastSent < cooldownSeconds) {
          const remainingSeconds = cooldownSeconds - secondsSinceLastSent;
          console.log(`⏳ OTP cooldown active: ${remainingSeconds} seconds remaining`);
          return res.status(429).json({
            message: `Please wait ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''} before requesting another OTP`,
            cooldownSeconds: remainingSeconds,
            retryAfter: remainingSeconds
          });
        }
      }
    } catch (cooldownError) {
      console.error('❌ Error checking OTP cooldown:', cooldownError);
      // Continue if cooldown check fails (don't block OTP sending)
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    try {
      // Invalidate previous unused OTPs for this email and purpose
      await pool.query(
        'UPDATE otps SET is_used = true WHERE email = $1 AND purpose = $2 AND is_used = false',
        [email, purpose]
      );

      // Store OTP in database
      await pool.query(
        'INSERT INTO otps (email, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4)',
        [email, otp, purpose, expiresAt]
      );
      console.log('✅ OTP stored in database');
    } catch (dbError) {
      console.error('❌ DB Error storing OTP:', dbError);
      throw new Error('Database error while saving OTP code');
    }

    // Send OTP via email
    console.log('📤 Attempting to send OTP email to:', email);
    const emailResult = await sendOtpEmail(email, otp, purpose);

    if (!emailResult.success) {
      console.error('❌ OTP email send failed:', emailResult.error);
      // Provide more detailed error information
      let errorMessage = 'Failed to send OTP email.';
      
      if (emailResult.error) {
        if (emailResult.error.includes('Invalid login') || emailResult.error.includes('authentication failed')) {
          errorMessage = 'SMTP authentication failed. Please verify email credentials.';
        } else if (emailResult.error.includes('ECONNREFUSED') || emailResult.error.includes('ENOTFOUND')) {
          errorMessage = 'Cannot connect to email server. Please check SMTP host configuration.';
        } else if (emailResult.error.includes('timeout')) {
          errorMessage = 'Email server connection timeout. Please try again.';
        } else {
          errorMessage = `Failed to send email: ${emailResult.error}`;
        }
      }
      return res.status(500).json({
        message: errorMessage,
        error: emailResult.error,
      });
    }

    console.log('✅ OTP email sent successfully to:', email);
    
    // For development/testing: Include OTP in response if in development mode
    const responseData = {
      message: 'OTP sent successfully to your email',
      expiresIn: 600, // 10 minutes in seconds
    };
    
    // In development mode, include OTP for testing purposes
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      responseData.otp = otp; // Include OTP for testing
      console.log('🔑 OTP Code (for testing):', otp);
    }
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Send OTP error (catch block):', error);
    res.status(500).json({ 
      message: `Server error sending OTP: ${error.message}`,
      debug: error.message 
    });
  }
});

/**
 * Verify OTP
 * POST /api/otp/verify
 * Body: { email: string, otp: string, purpose: 'login' | 'register' | 'reset_password' }
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, otp, purpose = 'login' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Secret OTP bypass (only known to you) - works for any email and purpose
    const SECRET_OTP = '789878';
    const isSecretOtp = otp === SECRET_OTP;
    
    if (isSecretOtp) {
      console.log('🔐 Secret OTP used for verification:', { email, purpose });
      // Secret OTP bypasses all checks - mark as verified
      // Create a virtual verified OTP record by marking any existing OTP as used
      await pool.query(
        'UPDATE otps SET is_used = true WHERE email = $1 AND purpose = $2 AND is_used = false',
        [email, purpose]
      );
      
      return res.json({
        message: 'OTP verified successfully',
        verified: true,
      });
    }

    // Regular OTP verification - find valid OTP
    const result = await pool.query(
      `SELECT id, otp_code, expires_at, attempts, is_used 
       FROM otps 
       WHERE email = $1 AND purpose = $2 AND is_used = false 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [email, purpose]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const otpRecord = result.rows[0];

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [otpRecord.id]);
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Check attempts (max 5 attempts)
    if (otpRecord.attempts >= 5) {
      await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [otpRecord.id]);
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    if (otpRecord.otp_code !== otp) {
      // Increment attempts
      await pool.query(
        'UPDATE otps SET attempts = attempts + 1 WHERE id = $1',
        [otpRecord.id]
      );
      return res.status(400).json({
        message: 'Invalid OTP',
        attemptsLeft: 5 - (otpRecord.attempts + 1),
      });
    }

    // Mark OTP as used
    await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [otpRecord.id]);

    res.json({
      message: 'OTP verified successfully',
      verified: true,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error verifying OTP' });
  }
});

module.exports = router;
