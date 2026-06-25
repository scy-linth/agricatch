const express = require('express');
const { pool } = require('../utils/db');
const { sendOtpEmail } = require('../utils/emailService');
const { verifyRecaptchaToken } = require('../utils/recaptcha');
const { writeAdminAuditLog } = require('../utils/auditLog');
require('dotenv').config();

const router = express.Router();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function shouldExposeOtpForDebug() {
  const { getPlatformSetting } = require('../utils/db');
  // Check OTP mode - only expose in testing mode
  const otpMode = await getPlatformSetting('otp_mode', 'strict');
  return otpMode === 'testing';
}

async function getOtpBypassCode() {
  const { getPlatformSetting } = require('../utils/db');
  // Bypass code only works in testing mode
  const otpMode = await getPlatformSetting('otp_mode', 'strict');
  if (otpMode !== 'testing') {
    return null; // No bypass code in strict or disabled mode
  }
  return await getPlatformSetting('otp_bypass_code', '789878');
}

async function isOtpEnabled() {
  const { getPlatformSetting } = require('../utils/db');
  const otpMode = await getPlatformSetting('otp_mode', 'strict');
  return otpMode !== 'disabled';
}

router.post('/send', async (req, res) => {
  try {
    console.log('📧 OTP send request received:', { email: req.body.email, purpose: req.body.purpose });
    
    // Check if OTP is enabled via otp_mode setting
    const otpEnabled = await isOtpEnabled();
    if (!otpEnabled) {
      return res.status(403).json({ message: 'OTP verification is currently disabled' });
    }
    
    const isResend = req.body?.resend === true || req.body?.resend === 'true';
    // Disable CAPTCHA verification in local development for testing
    if (!isResend && process.env.NODE_ENV !== 'development') {
      const captcha = await verifyRecaptchaToken(req.body?.['g-recaptcha-response'] || req.body?.gRecaptchaResponse || '', {
        remoteip: req.ip || req.connection?.remoteAddress || undefined
      });
      if (!captcha.ok) {
        return res.status(captcha.status || 403).json({ message: captcha.message || 'CAPTCHA verification failed' });
      }
    }

    const { email, purpose = 'login' } = req.body;

    if (!email) {
      console.log('❌ OTP send failed: Email is required');
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

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
        return res.status(500).json({ message: 'Database error while checking email availability' });
      }
    }

    if (purpose === 'login') {
      const userExists = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $1',
        [email]
      );
      if (userExists.rows.length === 0) {
        return res.status(404).json({ message: 'Email not found' });
      }
    }

    let userId = null;
    try {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
      }
    } catch (_) {}

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
        const cooldownSeconds = 60;

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
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let dbErrorOccurred = false;
    let insertedOtpId = null;
    try {
      await pool.query(
        'UPDATE otps SET is_used = true WHERE email = $1 AND purpose = $2 AND is_used = false',
        [email, purpose]
      );

      const insertResult = await pool.query(
        'INSERT INTO otps (email, otp_code, purpose, expires_at, is_used) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
        [email, otp, purpose, expiresAt, false]
      );
      insertedOtpId = insertResult.rows?.[0]?.id || null;
      console.log('✅ OTP stored in database', { insertedOtpId });
    } catch (dbError) {
      dbErrorOccurred = true;
      console.error('❌ DB Error storing OTP:', dbError);
    }

    console.log('📤 Attempting to send OTP email to:', email);
    const emailResult = await sendOtpEmail(email, otp, purpose);

    if (!emailResult.success) {
      console.error('❌ OTP email send failed:', emailResult.error);
      const isDevelopment = process.env.NODE_ENV !== 'production';

      // In local/dev environments, allow OTP flow to proceed even if email transport fails.
      // This prevents local registration from being blocked by SMTP/Resend credential issues.
      if (isDevelopment) {
        const responseData = {
          message: 'OTP generated for development mode. Email delivery failed, but you can continue using the OTP below.',
          expiresIn: 600,
          emailDelivery: 'failed',
          emailError: emailResult.error || 'Unknown email error'
        };
        if (shouldExposeOtpForDebug()) {
          responseData.otp = otp;
        }
        return res.json({
          ...responseData
        });
      }

      let errorMessage = 'Failed to send OTP email.';
      if (emailResult.error) {
        if (emailResult.error.includes('Invalid login') || emailResult.error.includes('authentication failed')) {
          errorMessage = 'SMTP authentication failed. Please verify email credentials.';
        } else if (emailResult.error.toLowerCase().includes('password') && emailResult.error.toLowerCase().includes('expired')) {
          errorMessage = 'Email account password expired. Update your SMTP/Resend credentials.';
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

    await writeAdminAuditLog(pool, {
      actor_admin_id: userId,
      action: 'otp.sent',
      entity: 'otps',
      entity_id: insertedOtpId,
      before: null,
      after: { email, purpose, otp_id: insertedOtpId },
      req
    });

    const responseData = {
      message: dbErrorOccurred
        ? 'OTP sent to your email, but there was a server issue saving the OTP. Please try again if you do not receive the code.'
        : 'OTP sent successfully to your email',
      expiresIn: 600,
    };

    if (shouldExposeOtpForDebug()) {
      responseData.otp = otp;
      console.log('🔑 OTP Code (for testing):', otp);
    }

    return res.json(responseData);
  } catch (error) {
    console.error('❌ Send OTP error (catch block):', error);
    return res.status(500).json({ message: 'Server error sending OTP' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { email, otp, purpose = 'login' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Secret bypass code for testing/development (from platform settings)
    const SECRET_BYPASS_OTP = await getOtpBypassCode();
    if (otp === SECRET_BYPASS_OTP) {
      console.log('🔓 Secret bypass OTP used for email:', email, 'purpose:', purpose);
      
      // Create or update an OTP record as verified for this email
      try {
        await pool.query(
          'UPDATE otps SET is_used = true WHERE email = $1 AND purpose = $2 AND is_used = false',
          [email, purpose]
        );
        
        // Insert a new verified OTP record (skip rate limit check for secret bypass)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const insertResult = await pool.query(
          'INSERT INTO otps (email, otp_code, purpose, expires_at, is_used) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [email, SECRET_BYPASS_OTP, purpose, expiresAt, true]
        );
        
        // Auto-verify the user account when using secret bypass (for testing)
        await pool.query(
          'UPDATE users SET is_verified = true WHERE email = $1',
          [email]
        );
        console.log('✅ Auto-verified user account for email:', email);
        
        await writeAdminAuditLog(pool, {
          actor_admin_id: null,
          action: 'otp.verify_success',
          entity: 'otps',
          entity_id: insertResult.rows[0].id,
          before: null,
          after: { email, purpose, method: 'secret_bypass', auto_verified: true },
          req
        });
      } catch (dbError) {
        console.error('Error creating bypass OTP record:', dbError);
      }

      return res.json({
        message: 'OTP verified successfully',
        verified: true,
      });
    }

    const result = await pool.query(
      `SELECT id, otp_code, expires_at, attempts, is_used 
       FROM otps 
       WHERE email = $1 AND purpose = $2 AND is_used = false 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [email, purpose]
    );

    if (result.rows.length === 0) {
      await writeAdminAuditLog(pool, {
        actor_admin_id: null,
        action: 'otp.verify_failed',
        entity: 'otps',
        entity_id: null,
        before: null,
        after: { email, purpose, reason: 'not_found' },
        req
      });
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const otpRecord = result.rows[0];

    if (new Date(otpRecord.expires_at) < new Date()) {
      await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [otpRecord.id]);
      await writeAdminAuditLog(pool, {
        actor_admin_id: null,
        action: 'otp.verify_failed',
        entity: 'otps',
        entity_id: otpRecord.id,
        before: null,
        after: { email, purpose, reason: 'expired' },
        req
      });
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (otpRecord.attempts >= 5) {
      await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [otpRecord.id]);
      await writeAdminAuditLog(pool, {
        actor_admin_id: null,
        action: 'otp.verify_failed',
        entity: 'otps',
        entity_id: otpRecord.id,
        before: null,
        after: { email, purpose, reason: 'too_many_attempts' },
        req
      });
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otpRecord.otp_code !== otp) {
      await pool.query(
        'UPDATE otps SET attempts = attempts + 1 WHERE id = $1',
        [otpRecord.id]
      );
      await writeAdminAuditLog(pool, {
        actor_admin_id: null,
        action: 'otp.verify_failed',
        entity: 'otps',
        entity_id: otpRecord.id,
        before: null,
        after: { email, purpose, reason: 'invalid_code', attempts: otpRecord.attempts + 1 },
        req
      });
      return res.status(400).json({
        message: 'Invalid OTP',
        attemptsLeft: 5 - (otpRecord.attempts + 1),
      });
    }

    await pool.query('UPDATE otps SET is_used = true WHERE id = $1', [otpRecord.id]);

    await writeAdminAuditLog(pool, {
      actor_admin_id: null,
      action: 'otp.verify_success',
      entity: 'otps',
      entity_id: otpRecord.id,
      before: null,
      after: { email, purpose },
      req
    });

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
