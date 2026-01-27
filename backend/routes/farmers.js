const express = require('express');
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

const jwt = require('jsonwebtoken');
const { deleteFileIfExists, resolvePublicPath } = require('../utils/fileUtils');

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
  } catch (error) {
    return null;
  }
};

// Public: get farmers listing
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.email, u.phone,
             u.address as location, COALESCE(u.is_verified, false) as is_verified,
             u.created_at, COUNT(p.id) as product_count
      FROM users u
      LEFT JOIN products p ON p.farmer_id = u.id
      WHERE u.role = 'farmer'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({ farmers: result.rows });
  } catch (error) {
    console.error('Get farmers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public: get farmer shop profile
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, username, full_name, email, phone, address as location, is_verified,
             shop_description, shop_banner_url, shop_avatar_url,
             total_sales, total_revenue, average_rating, total_reviews, created_at
      FROM users
      WHERE id = $1 AND role = 'farmer'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Farmer not found' });
    }

    res.json({ profile: result.rows[0] });
  } catch (error) {
    console.error('Get farmer profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: get dashboard stats
router.get('/me/stats', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    if (userResult.rows[0]?.role !== 'farmer') {
      return res.status(403).json({ message: 'Farmer access required' });
    }

    const totalOrdersResult = await pool.query(`
      SELECT COUNT(*)::int AS total_orders
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.farmer_id = $1
    `, [user.id]);

    const totalSoldResult = await pool.query(`
      SELECT COUNT(*)::int AS total_sold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.farmer_id = $1 AND oi.status = 'delivered'
    `, [user.id]);

    const totalRevenueResult = await pool.query(`
      SELECT COALESCE(SUM(oi.quantity * oi.price), 0)::numeric AS total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.farmer_id = $1 AND oi.status = 'delivered'
    `, [user.id]);

    const unreadCustomersResult = await pool.query(`
      SELECT COUNT(DISTINCT m.sender_id)::int AS unread_customers
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.receiver_id = $1 AND m.is_read = false AND u.role = 'customer'
    `, [user.id]);

    res.json({
      total_orders: totalOrdersResult.rows[0].total_orders || 0,
      total_sold: totalSoldResult.rows[0].total_sold || 0,
      total_revenue: totalRevenueResult.rows[0].total_revenue || 0,
      unread_customers: unreadCustomersResult.rows[0].unread_customers || 0
    });
  } catch (error) {
    console.error('Get farmer stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Farmer: update shop profile
router.put('/profile', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    if (userResult.rows[0]?.role !== 'farmer') {
      return res.status(403).json({ message: 'Farmer access required' });
    }

    const { shop_description, shop_banner_url, shop_avatar_url, full_name, address } = req.body;

    // Get current shop banner and avatar URLs if columns exist
    // Handle case where columns might not exist in database yet
    let currentBannerUrl = null;
    let currentAvatarUrl = null;
    try {
      const currentResult = await pool.query(
        'SELECT shop_banner_url, shop_avatar_url FROM users WHERE id = $1',
        [user.id]
      );
      if (currentResult.rows.length > 0) {
        currentBannerUrl = currentResult.rows[0].shop_banner_url;
        currentAvatarUrl = currentResult.rows[0].shop_avatar_url;
      }
    } catch (error) {
      // Columns might not exist yet - this is okay, we'll skip file deletion
      console.warn('Could not fetch current shop URLs (columns may not exist):', error.message);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (full_name !== undefined && full_name !== null && full_name !== '') {
      updates.push(`full_name = $${paramIndex}`);
      values.push(full_name);
      paramIndex++;
    }

    if (address !== undefined && address !== null && address !== '') {
      updates.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;
      
      // Sync product locations with new shop address
      try {
        await pool.query(
          'UPDATE products SET location = $1, updated_at = CURRENT_TIMESTAMP WHERE farmer_id = $2',
          [address, user.id]
        );
      } catch (productUpdateError) {
        console.error('Error syncing product locations:', productUpdateError);
        // Continue with user update even if product sync fails
        // The error is logged but doesn't block the shop profile update
      }
    }

    if (shop_description !== undefined && shop_description !== null && shop_description !== '') {
      updates.push(`shop_description = $${paramIndex}`);
      values.push(shop_description);
      paramIndex++;
    }

    if (shop_banner_url !== undefined && shop_banner_url !== null && shop_banner_url !== '') {
      updates.push(`shop_banner_url = $${paramIndex}`);
      values.push(shop_banner_url);
      paramIndex++;
    }

    if (shop_avatar_url !== undefined && shop_avatar_url !== null && shop_avatar_url !== '') {
      updates.push(`shop_avatar_url = $${paramIndex}`);
      values.push(shop_avatar_url);
      paramIndex++;
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      // Add user.id as the last parameter for WHERE clause
      // paramIndex is already correct (points to the next available parameter)
      values.push(user.id);
      
      try {
        await pool.query(`
          UPDATE users
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
        `, values);
      } catch (updateError) {
        // Check if error is due to missing columns
        if (updateError.code === '42703' && updateError.message.includes('does not exist')) {
          console.error('Database columns missing. Please run migration: database/migrations/add_shop_columns.sql');
          return res.status(500).json({ 
            message: 'Database schema is missing required columns. Please run the migration script: database/migrations/add_shop_columns.sql',
            error: process.env.NODE_ENV === 'development' ? updateError.message : undefined
          });
        }
        throw updateError; // Re-throw if it's a different error
      }
    }

    // Delete old files if URLs have changed
    if (shop_banner_url && currentBannerUrl && shop_banner_url !== currentBannerUrl) {
      const oldBannerPath = resolvePublicPath(currentBannerUrl);
      if (oldBannerPath) deleteFileIfExists(oldBannerPath);
    }
    if (shop_avatar_url && currentAvatarUrl && shop_avatar_url !== currentAvatarUrl) {
      const oldAvatarPath = resolvePublicPath(currentAvatarUrl);
      if (oldAvatarPath) deleteFileIfExists(oldAvatarPath);
    }

    res.json({ message: 'Shop profile updated successfully' });
  } catch (error) {
    console.error('Update shop profile error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Server error updating shop profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
