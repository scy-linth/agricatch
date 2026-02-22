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
  database: process.env.DB_NAME || 'agricatch',
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

async function refreshFarmerRatingForProduct(productId) {
  if (!productId) return;
  const farmerResult = await pool.query('SELECT farmer_id FROM products WHERE id = $1', [productId]);
  const farmerId = farmerResult.rows?.[0]?.farmer_id;
  if (!farmerId) return;

  const ratingResult = await pool.query(
    `
      SELECT COALESCE(AVG(r.rating), 0) AS avg_rating,
             COUNT(r.id)::int AS total_reviews
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      WHERE p.farmer_id = $1
    `,
    [farmerId]
  );

  const avgRating = Number(ratingResult.rows?.[0]?.avg_rating || 0);
  const totalReviews = Number(ratingResult.rows?.[0]?.total_reviews || 0);

  await pool.query(
    'UPDATE users SET average_rating = $1, total_reviews = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [avgRating, totalReviews, farmerId]
  );
}

async function getRatingEligibility(userId, productId) {
  const deliveredOrderResult = await pool.query(
    `
      SELECT COALESCE(delivered_at, updated_at, created_at) AS delivered_ref
      FROM orders
      WHERE user_id = $1
        AND product_id = $2
        AND status = 'delivered'
      ORDER BY COALESCE(delivered_at, updated_at, created_at) DESC
      LIMIT 1
    `,
    [userId, productId]
  );

  if (!deliveredOrderResult.rows.length) {
    return {
      allowed: false,
      reason: 'You can rate this product only after a delivered order.'
    };
  }

  const deliveredRef = new Date(deliveredOrderResult.rows[0].delivered_ref);
  const editableUntil = new Date(deliveredRef.getTime());
  editableUntil.setMonth(editableUntil.getMonth() + 1);

  if (Number.isNaN(editableUntil.getTime())) {
    return {
      allowed: false,
      reason: 'Unable to validate delivery date for rating eligibility.'
    };
  }

  const now = new Date();
  if (now > editableUntil) {
    return {
      allowed: false,
      reason: 'Rating window has ended. Ratings are editable for 1 month after delivery.',
      editableUntil
    };
  }

  return {
    allowed: true,
    editableUntil
  };
}

router.get('/products/:id/reviews/eligibility', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const productId = Number(req.params.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const eligibility = await getRatingEligibility(user.id, productId);
    const myReview = await pool.query(
      `SELECT id, rating, comment, created_at, updated_at FROM reviews WHERE product_id = $1 AND user_id = $2 LIMIT 1`,
      [productId, user.id]
    );

    return res.json({
      can_rate: eligibility.allowed,
      reason: eligibility.reason || null,
      editable_until: eligibility.editableUntil ? eligibility.editableUntil.toISOString() : null,
      my_review: myReview.rows[0] || null
    });
  } catch (error) {
    console.error('Review eligibility error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

    const productId = Number(id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const eligibility = await getRatingEligibility(user.id, productId);
    if (!eligibility.allowed) {
      return res.status(400).json({ message: eligibility.reason || 'You are not eligible to rate this product.' });
    }

    const result = await pool.query(`
      INSERT INTO reviews (product_id, user_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [productId, user.id, rating, comment || null]);

    await refreshFarmerRatingForProduct(productId);

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

    const reviewResult = await pool.query('SELECT user_id, product_id FROM reviews WHERE id = $1', [id]);
    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (reviewResult.rows[0].user_id !== user.id) {
      return res.status(403).json({ message: 'You can only update your own review' });
    }

    const eligibility = await getRatingEligibility(user.id, reviewResult.rows[0].product_id);
    if (!eligibility.allowed) {
      return res.status(400).json({ message: eligibility.reason || 'Rating update window has ended.' });
    }

    await pool.query(`
      UPDATE reviews
      SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [rating, comment, id]);

    await refreshFarmerRatingForProduct(reviewResult.rows[0].product_id);

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
    const reviewResult = await pool.query('SELECT user_id, product_id FROM reviews WHERE id = $1', [id]);
    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (reviewResult.rows[0].user_id !== user.id) {
      return res.status(403).json({ message: 'You can only delete your own review' });
    }

    await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
    await refreshFarmerRatingForProduct(reviewResult.rows[0].product_id);
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
