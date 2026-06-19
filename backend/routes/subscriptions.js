const express = require('express');
const { pool } = require('../utils/db');
const authenticateToken = require('../middleware/authenticateToken');
const { broadcastEvent } = require('../utils/realtime');
const { paymentProofUpload } = require('../middleware/upload');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();

// ── GET /api/subscriptions/settings ──────────────────────────────────────────
// Public — returns pricing + active payment accounts
router.get('/settings', async (req, res) => {
  try {
    const keys = [
      'premium_monthly_price',
      'premium_3month_discount_pct',
      'premium_6month_discount_pct'
    ];
    const settingsResult = await pool.query(
      `SELECT key, value FROM platform_settings WHERE key = ANY($1)`,
      [keys]
    );
    const settings = {};
    for (const row of settingsResult.rows) settings[row.key] = row.value;

    const accountsResult = await pool.query(
      `SELECT id, name, account_number, type
       FROM payment_accounts
       WHERE is_active = true
       ORDER BY sort_order ASC, created_at ASC`
    );

    const monthly = parseFloat(settings.premium_monthly_price) || 299;
    const d3 = parseFloat(settings.premium_3month_discount_pct) || 10;
    const d6 = parseFloat(settings.premium_6month_discount_pct) || 20;

    res.json({
      monthly_price: monthly,
      durations: {
        1: { months: 1, total: Math.round(monthly), discount_pct: 0 },
        3: { months: 3, total: Math.round(monthly * 3 * (1 - d3 / 100)), discount_pct: d3 },
        6: { months: 6, total: Math.round(monthly * 6 * (1 - d6 / 100)), discount_pct: d6 }
      },
      payment_accounts: accountsResult.rows
    });
  } catch (err) {
    console.error('Subscription settings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/farmers/me/subscription ─────────────────────────────────────────
router.get('/farmers/me/subscription', authenticateToken, async (req, res) => {
  try {
    // farmer_id is now the user_id (integer) since farmers table doesn't exist
    const farmerId = req.user.id;
    let subRes;
    try {
      subRes = await pool.query(
        `SELECT tier, status, plan_duration_months, expires_at,
                payment_proof_url, amount_paid, created_at
         FROM farmer_subscriptions
         WHERE farmer_id = $1 AND status IN ('active', 'pending', 'expired')
         ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
                  expires_at DESC NULLS LAST, created_at DESC
         LIMIT 1`, [farmerId]
      );
    } catch (tableErr) {
      // Table doesn't exist yet, return default free tier
      if (tableErr.code === '42P01') { // relation does not exist
        return res.json({ tier: 'free', status: 'free', expires_at: null });
      }
      throw tableErr;
    }
    if (subRes.rows.length === 0) {
      return res.json({ tier: 'free', status: 'free', expires_at: null });
    }
    const sub = subRes.rows[0];
    // Check expiry
    if (sub.status === 'active' && sub.expires_at && new Date(sub.expires_at) < new Date()) {
      sub.status = 'expired';
    }
    res.json(sub);
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/farmers/me/subscription/request ───────────────────────────────
router.post('/farmers/me/subscription/request', authenticateToken, paymentProofUpload.single('payment_proof'), async (req, res) => {
  try {
    const { plan_duration_months, payment_account_id, payment_method, expected_amount } = req.body;
    const months = parseInt(plan_duration_months, 10);
    if (![1, 3, 6].includes(months)) {
      return res.status(400).json({ message: 'Plan duration must be 1, 3, or 6 months' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Payment proof receipt is required' });
    }
    // farmer_id is now the user_id (integer)
    const farmerId = req.user.id;
    const pendingRes = await pool.query(
      `SELECT id FROM farmer_subscriptions WHERE farmer_id = $1 AND status = 'pending'`, [farmerId]
    );
    if (pendingRes.rows.length > 0) {
      return res.status(400).json({ message: 'You already have a pending subscription request' });
    }

    // Validate payment_account_id if provided
    if (payment_account_id) {
      const accountRes = await pool.query(
        'SELECT id FROM payment_accounts WHERE id = $1 AND is_active = true',
        [payment_account_id]
      );
      if (accountRes.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid or inactive payment account selected' });
      }
    }

    // Upload to Cloudinary
    cloudinary.assertConfigured();
    const publicId = cloudinary.publicIdForPaymentProof(farmerId);
    const uploaded = await cloudinary.uploadFile(req.file.path, {
      public_id: publicId,
      folder: 'agricatch/payment-proofs',
      tags: ['payment-proof', `farmer:${farmerId}`]
    });
    const proofUrl = uploaded.secure_url;

    await pool.query(
      `INSERT INTO farmer_subscriptions
       (farmer_id, tier, status, plan_duration_months, payment_proof_url, payment_account_id, payment_method, amount_paid)
       VALUES ($1, 'premium', 'pending', $2, $3, $4, $5, $6)`,
      [farmerId, months, proofUrl, payment_account_id || null, payment_method || 'gcash', expected_amount || null]
    );
    res.json({ message: 'Subscription request submitted. Please wait for admin approval.' });
  } catch (err) {
    console.error('Subscription request error:', err);
    if (err.message && err.message.includes('Cloudinary')) {
      return res.status(500).json({ message: 'Failed to upload image. Please try again.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/farmers/me/subscription/history ───────────────────────────────
router.get('/farmers/me/subscription/history', authenticateToken, async (req, res) => {
  try {
    const farmerId = req.user.id;
    const historyRes = await pool.query(
      `SELECT id, tier, status, plan_duration_months, amount_paid,
              payment_proof_url, starts_at, expires_at, created_at, updated_at,
              rejection_reason, expiry_reason
       FROM farmer_subscriptions
       WHERE farmer_id = $1
       ORDER BY created_at DESC`,
      [farmerId]
    );
    res.json({ history: historyRes.rows });
  } catch (err) {
    console.error('Get subscription history error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
