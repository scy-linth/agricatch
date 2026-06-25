const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');
const { writeAdminAuditLog } = require('../utils/auditLog');
const { broadcastEvent } = require('../utils/realtime');

function getUserFromToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded;
  } catch (err) {
    return null;
  }
}

const MAX_MESSAGE_LENGTH = 500;

router.post('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (!['farmer', 'customer'].includes(user.role)) return res.status(403).json({ message: 'Only farmers and customers can create tickets' });

    const { subject, description, priority } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ message: 'Subject and description are required' });
    }
    if (subject.length > 200) {
      return res.status(400).json({ message: 'Subject exceeds maximum length of 200 characters' });
    }
    if (description.length > 500) {
      return res.status(400).json({ message: 'Description exceeds maximum length of 500 characters' });
    }
    // Priority is optional - default to 'medium' if not provided
    const ticketPriority = (priority && ['low', 'medium', 'high'].includes(priority)) ? priority : 'medium';

    const result = await pool.query(
      `INSERT INTO support_tickets (farmer_id, subject, description, priority, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING id, status`,
      [user.id, subject.trim(), description.trim(), ticketPriority]
    );

    res.status(201).json({ ticket_id: result.rows[0].id, status: result.rows[0].status });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (!['admin', 'staff', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE st.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM support_tickets st ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT st.*, u.full_name as farmer_name, u.email as farmer_email, u.role, u.shop_name,
              (SELECT COUNT(*) FROM support_messages sm WHERE sm.ticket_id = st.id) as message_count
       FROM support_tickets st
       JOIN users u ON st.farmer_id = u.id
       ${whereClause}
       ORDER BY st.updated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      tickets: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread message count for admin badge
router.get('/unread-count', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (!['admin', 'staff', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Count distinct tickets with unread messages from farmers or customers
    const result = await pool.query(`
      SELECT COUNT(DISTINCT sm.ticket_id) as unread_count
      FROM support_messages sm
      JOIN users u ON u.id = sm.sender_id
      WHERE sm.is_read = false
      AND u.role IN ('farmer', 'customer')
    `);

    res.json({ unread_count: result.rows[0]?.unread_count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/my', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (!['farmer', 'customer'].includes(user.role)) return res.status(403).json({ message: 'Farmer or customer access required' });

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM support_tickets WHERE farmer_id = $1',
      [user.id]
    );

    const result = await pool.query(
      `SELECT st.*,
              (SELECT COUNT(*) FROM support_messages sm WHERE sm.ticket_id = st.id AND sm.is_read = false AND sm.sender_id != $1) as unread_count
       FROM support_tickets st
       WHERE st.farmer_id = $1
       ORDER BY st.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    res.json({
      tickets: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM support_tickets WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const ticket = result.rows[0];

    // Check access: farmer/customer can only see own tickets, admin can see all
    if (['farmer', 'customer'].includes(user.role) && ticket.farmer_id !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT sm.*, u.full_name as sender_name, u.role as sender_role
       FROM support_messages sm
       JOIN users u ON sm.sender_id = u.id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC`,
      [id]
    );

    res.json({
      ticket,
      messages: messagesResult.rows
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (!['admin', 'staff', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const beforeRes = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    if (beforeRes.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    const before = beforeRes.rows[0];

    const result = await pool.query(
      'UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const after = result.rows[0];

    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: user.id,
        action: 'support_ticket.status.update',
        entity: 'support_tickets',
        entity_id: id,
        before: { status: before.status, subject: before.subject },
        after: { status: after.status, subject: after.subject },
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }

    res.json({ message: 'Ticket status updated', ticket: result.rows[0] });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/messages', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
    }

    // Check ticket exists and user has access
    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    const ticket = ticketResult.rows[0];

    if (['farmer', 'customer'].includes(user.role) && ticket.farmer_id !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Insert message
    await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_id, message)
       VALUES ($1, $2, $3)`,
      [id, user.id, message.trim()]
    );

    // Update ticket updated_at
    await pool.query(
      'UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // If admin sends message, create notification for ticket owner
    if (['admin', 'staff', 'super_admin'].includes(user.role)) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, 'support_ticket', 'New Support Message', $2, false, CURRENT_TIMESTAMP)`,
        [ticket.farmer_id, `Admin responded to your support ticket: ${ticket.subject}`]
      );

      try {
        await writeAdminAuditLog(pool, {
          actor_admin_id: user.id,
          action: 'support_ticket.message.sent',
          entity: 'support_tickets',
          entity_id: id,
          before: { subject: ticket.subject },
          after: { message: message.trim() },
          req
        });
      } catch (auditErr) {
        console.error('Audit log error (non-fatal):', auditErr);
      }
    } else {
      // Ticket owner sent message - broadcast to admins
      broadcastEvent('support.message', { ticket_id: id, user_id: user.id });
    }

    res.status(201).json({ message: 'Message sent' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const { page = 1, limit = 50, mark_read = 'true' } = req.query;
    const offset = (page - 1) * limit;

    // Check ticket exists and user has access
    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    const ticket = ticketResult.rows[0];

    if (['farmer', 'customer'].includes(user.role) && ticket.farmer_id !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark messages as read only when mark_read=true (first load, not polling)
    if (mark_read === 'true') {
      if (['farmer', 'customer'].includes(user.role)) {
        await pool.query(
          'UPDATE support_messages SET is_read = true WHERE ticket_id = $1 AND sender_id != $2',
          [id, user.id]
        );
      } else if (['admin', 'staff', 'super_admin'].includes(user.role)) {
        // Admin viewing: mark farmer/customer messages as read
        await pool.query(
          'UPDATE support_messages SET is_read = true WHERE ticket_id = $1 AND sender_id IN (SELECT id FROM users WHERE role = ANY($2))',
          [id, ['farmer', 'customer']]
        );
        // Notify admins to refresh badge
        broadcastEvent('support.read', { ticket_id: id });
      }
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM support_messages WHERE ticket_id = $1',
      [id]
    );

    const result = await pool.query(
      `SELECT sm.*, u.full_name as sender_name, u.role as sender_role
       FROM support_messages sm
       JOIN users u ON sm.sender_id = u.id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
