const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');
const { broadcastEvent } = require('../utils/realtime');

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

async function refreshCustomerRatingForUser(customerId) {
  if (!customerId) return;
  const ratingResult = await pool.query(
    `
      SELECT COALESCE(AVG(r.rating), 0) AS avg_rating,
             COUNT(r.id)::int AS total_ratings
      FROM customer_ratings r
      WHERE r.customer_id = $1
    `,
    [customerId]
  );

  const avgRating = Number(ratingResult.rows?.[0]?.avg_rating || 0);
  const totalRatings = Number(ratingResult.rows?.[0]?.total_ratings || 0);

  await pool.query(
    'UPDATE users SET customer_average_rating = $1, customer_total_ratings = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [avgRating, totalRatings, customerId]
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

async function getCustomerRatingEligibility(farmerId, orderId) {
  const orderResult = await pool.query(
    `
      SELECT o.id, o.user_id AS customer_id, o.status,
             COALESCE(o.delivered_at, o.updated_at, o.created_at) AS delivered_ref
      FROM orders o
      JOIN products p ON p.id = o.product_id
      WHERE o.id = $1
        AND p.farmer_id = $2
        AND COALESCE(o.is_disabled, false) = false
      LIMIT 1
    `,
    [orderId, farmerId]
  );

  if (!orderResult.rows.length) {
    return { allowed: false, reason: 'Order not found for this farmer.' };
  }

  const orderRow = orderResult.rows[0];
  if (orderRow.status !== 'delivered') {
    return { allowed: false, reason: 'You can rate a customer only after delivery.' };
  }

  const deliveredRef = new Date(orderRow.delivered_ref);
  const editableUntil = new Date(deliveredRef.getTime());
  editableUntil.setMonth(editableUntil.getMonth() + 1);

  if (Number.isNaN(editableUntil.getTime())) {
    return { allowed: false, reason: 'Unable to validate delivery date for rating eligibility.' };
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
    editableUntil,
    customerId: orderRow.customer_id
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

    // Send notification to farmer about new review
    try {
      const productResult = await pool.query('SELECT farmer_id, name FROM products WHERE id = $1', [productId]);
      if (productResult.rows.length > 0 && productResult.rows[0].farmer_id) {
        const farmerId = productResult.rows[0].farmer_id;
        const productName = productResult.rows[0].name;
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
          [farmerId, 'new_review', 'New Review Received', `Your product "${productName}" received a new ${rating}-star review.`, productId]
        );
        broadcastEvent('notification.created', { user_id: farmerId });
      }
    } catch (notifErr) {
      console.error('Failed to send review notification:', notifErr);
    }

    // Real-time fraud alert: Check if this user has suspicious pattern
    const patternCheck = await pool.query(`
      SELECT 
        COUNT(*) as review_count,
        AVG(r.rating) as avg_rating,
        COUNT(DISTINCT p.farmer_id) as unique_farmers
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = $1
      GROUP BY r.user_id
    `, [user.id]);

    if (patternCheck.rows.length > 0) {
      const pattern = patternCheck.rows[0];
      // Flag if: 3+ reviews, 4.5+ avg rating, only 1 farmer
      if (pattern.review_count >= 3 && pattern.avg_rating >= 4.5 && pattern.unique_farmers === 1) {
        // Send notification to admin
        try {
          const adminResult = await pool.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
          );
          if (adminResult.rows.length > 0) {
            await pool.query(`
              INSERT INTO notifications (user_id, type, message, is_read)
              VALUES ($1, 'fraud_alert', $2, false)
            `, [adminResult.rows[0].id, `Suspicious pattern detected: User ${user.username} (ID: ${user.id}) has ${pattern.review_count} reviews with ${pattern.avg_rating.toFixed(1)} avg rating from only 1 farmer`]);
            broadcastEvent('notification.created', { user_id: adminResult.rows[0].id });
          }
        } catch (notifErr) {
          console.error('Failed to send fraud alert notification:', notifErr);
        }
      }
    }

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

    // Send notification to farmer about review update
    try {
      const productResult = await pool.query('SELECT farmer_id, name FROM products WHERE id = $1', [reviewResult.rows[0].product_id]);
      if (productResult.rows.length > 0 && productResult.rows[0].farmer_id) {
        const farmerId = productResult.rows[0].farmer_id;
        const productName = productResult.rows[0].name;
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, product_id, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
          [farmerId, 'review_updated', 'Review Updated', `A review for your product "${productName}" was updated to ${rating} stars.`, reviewResult.rows[0].product_id]
        );
        broadcastEvent('notification.created', { user_id: farmerId });
      }
    } catch (notifErr) {
      console.error('Failed to send review update notification:', notifErr);
    }

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

// Farmer rates customer (per delivered order)
router.get('/orders/:id/customer-rating/eligibility', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const orderId = Number(req.params.id || 0);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    const role = roleResult.rows[0]?.role;
    if (role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can rate customers' });
    }

    const eligibility = await getCustomerRatingEligibility(user.id, orderId);
    const myRating = await pool.query(
      `SELECT id, rating, created_at, updated_at
       FROM customer_ratings
       WHERE order_id = $1 AND farmer_id = $2
       LIMIT 1`,
      [orderId, user.id]
    );

    return res.json({
      can_rate: eligibility.allowed,
      reason: eligibility.reason || null,
      editable_until: eligibility.editableUntil ? eligibility.editableUntil.toISOString() : null,
      my_rating: myRating.rows[0] || null
    });
  } catch (error) {
    console.error('Customer rating eligibility error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/orders/:id/customer-rating', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const orderId = Number(req.params.id || 0);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    const role = roleResult.rows[0]?.role;
    if (role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can rate customers' });
    }

    const rating = Number(req.body?.rating || 0);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const eligibility = await getCustomerRatingEligibility(user.id, orderId);
    if (!eligibility.allowed) {
      return res.status(400).json({ message: eligibility.reason || 'You are not eligible to rate this customer.' });
    }

    const existing = await pool.query(
      'SELECT id FROM customer_ratings WHERE order_id = $1 AND farmer_id = $2 LIMIT 1',
      [orderId, user.id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ message: 'You already rated this customer for this order' });
    }

    const created = await pool.query(
      `INSERT INTO customer_ratings (order_id, farmer_id, customer_id, rating)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, created_at, updated_at`,
      [orderId, user.id, eligibility.customerId, rating]
    );

    await refreshCustomerRatingForUser(eligibility.customerId);

    return res.status(201).json({ rating: created.rows[0] });
  } catch (error) {
    console.error('Create customer rating error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/orders/:id/customer-rating', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const orderId = Number(req.params.id || 0);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    const role = roleResult.rows[0]?.role;
    if (role !== 'farmer') {
      return res.status(403).json({ message: 'Only farmers can rate customers' });
    }

    const rating = Number(req.body?.rating || 0);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const eligibility = await getCustomerRatingEligibility(user.id, orderId);
    if (!eligibility.allowed) {
      return res.status(400).json({ message: eligibility.reason || 'Rating update window has ended.' });
    }

    const existing = await pool.query(
      'SELECT id, customer_id FROM customer_ratings WHERE order_id = $1 AND farmer_id = $2 LIMIT 1',
      [orderId, user.id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ message: 'Customer rating not found' });
    }

    await pool.query(
      'UPDATE customer_ratings SET rating = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [rating, existing.rows[0].id]
    );

    await refreshCustomerRatingForUser(existing.rows[0].customer_id);

    return res.json({ message: 'Customer rating updated' });
  } catch (error) {
    console.error('Update customer rating error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get all reviews for the authenticated farmer's products
router.get('/mine', async (req, res) => {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (user.role !== 'farmer') return res.status(403).json({ message: 'Farmers only' });

  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(r.id) AS total
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE p.farmer_id = $1`,
      [user.id]
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const rows = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              p.name AS product_name, p.id AS product_id,
              u.username AS customer_name,
              u.first_name, u.last_name,
              COALESCE(u.is_verified, false) AS customer_is_verified
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       WHERE p.farmer_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    const aggResult = await pool.query(
      `SELECT COALESCE(AVG(r.rating), 0)::numeric(3,2) AS avg_rating,
              COUNT(r.id)::int AS total_reviews
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE p.farmer_id = $1`,
      [user.id]
    );

    return res.json({
      reviews: rows.rows,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      avgRating: Number(aggResult.rows[0]?.avg_rating || 0),
      totalReviews: Number(aggResult.rows[0]?.total_reviews || 0)
    });
  } catch (error) {
    console.error('Get farmer reviews error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
