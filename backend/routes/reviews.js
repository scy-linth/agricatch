const express = require('express');
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

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
  } catch (error) {
    return null;
  }
};

// Get reviews for a product
router.get('/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.*, u.username, u.full_name
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = $1
      ORDER BY r.created_at DESC
    `, [id]);
    res.json({ reviews: result.rows });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a review
router.post('/products/:id/reviews', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const result = await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, user.id, rating, comment || null]);

    res.status(201).json({ review: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ message: 'You already reviewed this product' });
    }
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a review
router.put('/reviews/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { id } = req.params;
    const { rating, comment } = req.body;

    const reviewResult = await pool.query('SELECT user_id FROM reviews WHERE id = $1', [id]);
    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (reviewResult.rows[0].user_id !== user.id) {
      return res.status(403).json({ message: 'You can only update your own review' });
    }

    await pool.query(`
      UPDATE reviews
      SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [rating, comment, id]);

    res.json({ message: 'Review updated successfully' });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a review
router.delete('/reviews/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { id } = req.params;
    const reviewResult = await pool.query('SELECT user_id FROM reviews WHERE id = $1', [id]);
    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (reviewResult.rows[0].user_id !== user.id) {
      return res.status(403).json({ message: 'You can only delete your own review' });
    }

    await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
