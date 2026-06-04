const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

const router = express.Router();

const NOTIFICATION_TYPE_PATTERN = /^[a-z0-9_-]{1,50}$/i;

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Get notifications (paginated)
router.get('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const type = req.query.type ? String(req.query.type).trim() : '';

    if (type && !NOTIFICATION_TYPE_PATTERN.test(type)) {
      return res.status(400).json({ message: 'Invalid notification type filter' });
    }

    const whereParts = ['n.user_id = $1'];
    const whereValues = [user.id];
    if (type) {
      whereParts.push(`n.type = $${whereValues.length + 1}`);
      whereValues.push(type);
    }
    const whereSql = `WHERE ${whereParts.join(' AND ')}`;

    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM notifications n ${whereSql}`, whereValues),
      pool.query(
        `SELECT n.*,
                COALESCE(p_direct.name, p_order.name) AS product_name,
                COALESCE(p_direct.image_url, p_order.image_url) AS product_image_url,
                o.status AS order_status
         FROM notifications n
         LEFT JOIN orders o ON o.id = n.order_id
         LEFT JOIN products p_direct ON p_direct.id = n.product_id
         LEFT JOIN products p_order ON p_order.id = o.product_id
         ${whereSql}
         ORDER BY n.created_at DESC
         LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}`,
        [...whereValues, limit, offset]
      )
    ]);

    const total = parseInt(countResult.rows[0]?.count || '0', 10);
    res.json({
      notifications: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { id } = req.params;
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Read all notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
