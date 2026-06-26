const express = require('express');
const { pool } = require('../utils/db');

const router = express.Router();

// ── GET /api/settings ─────────────────────────────────────────────
// Public endpoint - no authentication required
// Returns delivery address setting
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'use_default_delivery_address'`
    );
    
    const useDefaultAddress = result.rows.length > 0 ? result.rows[0].value === 'true' : true;
    res.json({ use_default_delivery_address: useDefaultAddress });
  } catch (err) {
    console.error('Error fetching delivery address setting:', err);
    // Fallback to true on error
    res.json({ use_default_delivery_address: true });
  }
});

// ── GET /api/settings/delivery-fee ─────────────────────────────────────────────
// Public endpoint - no authentication required
// Returns the delivery fee value from platform_settings
router.get('/delivery-fee', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'delivery_fee'`
    );
    
    if (result.rows.length === 0) {
      // Return default if not set
      return res.json({ delivery_fee: 35 });
    }
    
    const value = parseFloat(result.rows[0].value);
    // Treat null/invalid as 0 (no delivery fee)
    const deliveryFee = isNaN(value) ? 0 : value;
    
    res.json({ delivery_fee: deliveryFee });
  } catch (err) {
    console.error('Error fetching delivery fee:', err);
    // Fallback to default on error
    res.json({ delivery_fee: 35 });
  }
});

// ── GET /api/settings/product-limits ─────────────────────────────────────────────
// Public endpoint - no authentication required
// Returns product limit settings for farmers
router.get('/product-limits', async (req, res) => {
  try {
    const keys = [
      'max_products_per_farmer',
      'max_products_per_name_available',
      'max_products_per_name_preorder'
    ];
    const result = await pool.query(
      `SELECT key, value FROM platform_settings WHERE key = ANY($1)`,
      [keys]
    );
    
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    
    res.json({
      max_products_per_farmer: parseInt(settings.max_products_per_farmer || '10', 10),
      max_products_per_name_available: parseInt(settings.max_products_per_name_available || '1', 10),
      max_products_per_name_preorder: parseInt(settings.max_products_per_name_preorder || '1', 10)
    });
  } catch (err) {
    console.error('Error fetching product limits:', err);
    // Fallback to defaults on error
    res.json({
      max_products_per_farmer: 10,
      max_products_per_name_available: 1,
      max_products_per_name_preorder: 1
    });
  }
});

// ── GET /api/settings/recaptcha-mode ─────────────────────────────────────────────
// Public endpoint - no authentication required
// Returns the recaptcha_mode setting
router.get('/recaptcha-mode', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'recaptcha_mode'`
    );
    
    const recaptchaMode = result.rows.length > 0 ? result.rows[0].value : 'auto';
    res.json({ recaptcha_mode: recaptchaMode });
  } catch (err) {
    console.error('Error fetching recaptcha mode:', err);
    // Fallback to auto on error
    res.json({ recaptcha_mode: 'auto' });
  }
});

module.exports = router;
