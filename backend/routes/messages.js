const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');
const { broadcastEvent } = require('../utils/realtime');

const router = express.Router();

const MAX_MESSAGE_LENGTH = 500;
const MESSAGES_PAGE_SIZE = 50;

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};


// Get conversations for user
// Note: For farmers, full_name represents the shop/farm name (editable via shop overview)
// The frontend will display other_name (full_name) with fallback to other_username if full_name is NULL
router.get('/conversations', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    // Query returns shop_name and full_name separately for proper formatting
    // LEFT JOIN ensures NULL values are handled gracefully, with username as fallback
    const result = await pool.query(`
      SELECT c.*,
             COALESCE(u.shop_name, u.full_name) as other_shop_name,
             u.full_name as other_full_name,
             u.username as other_username,
             (
               SELECT COUNT(*) FROM messages m
               WHERE m.conversation_id = c.conversation_id
                 AND m.receiver_id = $1
                 AND m.is_read = false
             )::int AS unread_count,
             (
               SELECT m.message FROM messages m
               WHERE m.conversation_id = c.conversation_id
               ORDER BY m.created_at DESC
               LIMIT 1
             ) AS last_message
      FROM conversations c
      LEFT JOIN users u ON u.id = CASE
        WHEN c.farmer_id = $1 THEN c.customer_id
        ELSE c.farmer_id
      END
      WHERE c.farmer_id = $1 OR c.customer_id = $1
      ORDER BY c.last_message_at DESC NULLS LAST
    `, [user.id]);

    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages in a conversation
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { conversationId } = req.params;

    // Verify user belongs to this conversation
    const convCheck = await pool.query(
      'SELECT farmer_id, customer_id FROM conversations WHERE conversation_id = $1',
      [conversationId]
    );
    if (convCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    const conv = convCheck.rows[0];
    if (conv.farmer_id !== user.id && conv.customer_id !== user.id) {
      return res.status(403).json({ message: 'Access denied to this conversation' });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * MESSAGES_PAGE_SIZE;

    const countResult = await pool.query(
      'SELECT COUNT(*)::int as total FROM messages WHERE conversation_id = $1',
      [conversationId]
    );
    const totalMessages = countResult.rows[0]?.total || 0;

    const result = await pool.query(`
      SELECT m.*
      FROM messages m
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3
    `, [conversationId, MESSAGES_PAGE_SIZE, offset]);

    res.json({
      messages: result.rows,
      pagination: {
        page,
        pageSize: MESSAGES_PAGE_SIZE,
        totalMessages,
        totalPages: Math.ceil(totalMessages / MESSAGES_PAGE_SIZE)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all messages in a conversation as read (for the current user)
router.put('/conversation/:conversationId/read', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { conversationId } = req.params;

    const update = await pool.query(
      `UPDATE messages
       SET is_read = true
       WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = false`,
      [conversationId, user.id]
    );

    if ((update.rowCount || 0) > 0) {
      broadcastEvent('chat.read', {
        conversation_id: conversationId,
        reader_id: user.id
      });
    }

    res.json({ message: 'Conversation marked as read', updated: update.rowCount || 0 });
  } catch (error) {
    console.error('Read conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/send', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { receiver_id, message, product_id } = req.body;
    if (!receiver_id || !message) {
      return res.status(400).json({ message: 'receiver_id and message are required' });
    }

    const trimmedMessage = String(message).trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`
      });
    }

    const senderRole = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    const role = senderRole.rows[0]?.role;

    const receiverResult = await pool.query('SELECT role FROM users WHERE id = $1', [receiver_id]);
    if (receiverResult.rows.length === 0) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const receiverRole = receiverResult.rows[0].role;

    let farmerId;
    let customerId;

    if (role === 'admin') {
      if (receiverRole !== 'farmer') {
        return res.status(403).json({ message: 'Admin can only chat with farmers' });
      }
      farmerId = receiver_id;
      customerId = user.id;
    } else if (role === 'farmer') {
      if (!['customer', 'admin'].includes(receiverRole)) {
        return res.status(403).json({ message: 'Farmer can only chat with customers or admin' });
      }
      farmerId = user.id;
      customerId = receiver_id;
    } else if (role === 'customer') {
      if (receiverRole !== 'farmer') {
        return res.status(403).json({ message: 'Customer can only chat with farmers' });
      }
      farmerId = receiver_id;
      customerId = user.id;
    } else {
      return res.status(403).json({ message: 'Unsupported role for chat' });
    }
    const conversationId = `${farmerId}_${customerId}`;

    const conversationResult = await pool.query(
      'SELECT id FROM conversations WHERE conversation_id = $1',
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      await pool.query(`
        INSERT INTO conversations (conversation_id, farmer_id, customer_id, last_message_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [conversationId, farmerId, customerId]);
    } else {
      await pool.query(
        'UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE conversation_id = $1',
        [conversationId]
      );
    }

    await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, receiver_id, message, product_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [conversationId, user.id, receiver_id, trimmedMessage, product_id || null]);

    broadcastEvent('chat.message', {
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: Number(receiver_id),
      farmer_id: Number(farmerId),
      customer_id: Number(customerId)
    });

    res.status(201).json({ message: 'Message sent' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const update = await pool.query(
      'UPDATE messages SET is_read = true WHERE id = $1 AND receiver_id = $2 RETURNING conversation_id',
      [id, user.id]
    );
    if ((update.rowCount || 0) > 0) {
      broadcastEvent('chat.read', {
        conversation_id: update.rows[0].conversation_id,
        reader_id: user.id
      });
    }
    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Read message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unread count
router.get('/unread-count', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const result = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND is_read = false',
      [user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
