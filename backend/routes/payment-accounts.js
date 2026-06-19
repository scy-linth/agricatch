const express = require('express');
const { pool } = require('../utils/db');
const requireRole = require('../middleware/requireRole');
const { writeAdminAuditLog } = require('../utils/auditLog');

const router = express.Router();

const requireAdmin = requireRole('admin', 'super_admin');

// ── GET /api/admin/payment-accounts ───────────────────────────────────────
router.get('/payment-accounts', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, account_number, type, is_active, sort_order, created_at
       FROM payment_accounts
       ORDER BY sort_order ASC, created_at ASC`
    );
    res.json({ accounts: result.rows });
  } catch (err) {
    console.error('Get payment accounts error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/admin/payment-accounts ─────────────────────────────────────────
router.post('/payment-accounts', requireAdmin, async (req, res) => {
  try {
    const { name, account_number, type, sort_order } = req.body;
    if (!name || !account_number || !type) {
      return res.status(400).json({ message: 'Name, account_number, and type are required' });
    }
    const result = await pool.query(
      `INSERT INTO payment_accounts (name, account_number, type, is_active, sort_order)
       VALUES ($1, $2, $3, true, $4)
       RETURNING *`,
      [name, account_number, type, sort_order || 0]
    );
    const after = result.rows[0];
    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: req.user.id,
        action: 'payment_account.create',
        entity: 'payment_accounts',
        entity_id: after.id,
        before: null,
        after: { name: after.name, account_number: after.account_number, type: after.type },
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }
    res.status(201).json({ account: result.rows[0], message: 'Payment account created' });
  } catch (err) {
    console.error('Create payment account error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /api/admin/payment-accounts/:id ──────────────────────────────────────
router.put('/payment-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, account_number, type, is_active, sort_order } = req.body;
    const beforeRes = await pool.query('SELECT * FROM payment_accounts WHERE id = $1', [id]);
    if (beforeRes.rows.length === 0) {
      return res.status(404).json({ message: 'Payment account not found' });
    }
    const before = beforeRes.rows[0];
    const result = await pool.query(
      `UPDATE payment_accounts
       SET name = COALESCE($1, name),
           account_number = COALESCE($2, account_number),
           type = COALESCE($3, type),
           is_active = COALESCE($4, is_active),
           sort_order = COALESCE($5, sort_order),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name, account_number, type, is_active, sort_order, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payment account not found' });
    }
    const after = result.rows[0];
    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: req.user.id,
        action: 'payment_account.update',
        entity: 'payment_accounts',
        entity_id: id,
        before: { name: before.name, account_number: before.account_number, type: before.type, is_active: before.is_active },
        after: { name: after.name, account_number: after.account_number, type: after.type, is_active: after.is_active },
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }
    res.json({ account: result.rows[0], message: 'Payment account updated' });
  } catch (err) {
    console.error('Update payment account error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/admin/payment-accounts/:id ───────────────────────────────────
router.delete('/payment-accounts/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const beforeRes = await pool.query('SELECT * FROM payment_accounts WHERE id = $1', [id]);
    if (beforeRes.rows.length === 0) {
      return res.status(404).json({ message: 'Payment account not found' });
    }
    const before = beforeRes.rows[0];
    const result = await pool.query(
      'DELETE FROM payment_accounts WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payment account not found' });
    }
    try {
      await writeAdminAuditLog(pool, {
        actor_admin_id: req.user.id,
        action: 'payment_account.delete',
        entity: 'payment_accounts',
        entity_id: id,
        before: { name: before.name, account_number: before.account_number, type: before.type },
        after: null,
        req
      });
    } catch (auditErr) {
      console.error('Audit log error (non-fatal):', auditErr);
    }
    res.json({ message: 'Payment account deleted' });
  } catch (err) {
    console.error('Delete payment account error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
