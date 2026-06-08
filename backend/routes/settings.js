const express = require('express');
const { pool } = require('../utils/db');

const router = express.Router();

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

module.exports = router;
