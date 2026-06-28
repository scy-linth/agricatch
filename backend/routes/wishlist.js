const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

const router = express.Router();

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Get wishlist items
router.get('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const result = await pool.query(`
      SELECT w.id, w.created_at as added_at,
             p.*,
             COALESCE(u.shop_name, u.full_name) as farmer_name,
             p.location as farm_location,
             COALESCE(u.is_verified, false) as farmer_verified,
             c.name as category_name
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN users u ON p.farmer_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `, [user.id]);

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add to wishlist
router.post('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    await pool.query(`
      INSERT INTO wishlist (user_id, product_id)
      VALUES ($1, $2)
    `, [user.id, productId]);

    res.status(201).json({ message: 'Added to wishlist' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Already in wishlist' });
    }
    console.error('Add wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove from wishlist
router.delete('/:productId', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { productId } = req.params;
    await pool.query('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [user.id, productId]);
    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Remove wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
