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

router.get('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const result = await pool.query(
      'SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [user.id]
    );
    res.json({ addresses: result.rows });
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const {
      label,
      full_name,
      phone,
      address_line1,
      address_line2,
      city,
      province,
      postal_code,
      is_default
    } = req.body;

    if (is_default) {
      await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [user.id]);
    }

    const result = await pool.query(`
      INSERT INTO user_addresses (user_id, label, full_name, phone, address_line1, address_line2, city, province, postal_code, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [user.id, label, full_name, phone, address_line1, address_line2, city, province, postal_code, !!is_default]);

    res.status(201).json({ address: result.rows[0] });
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const {
      label,
      full_name,
      phone,
      address_line1,
      address_line2,
      city,
      province,
      postal_code,
      is_default
    } = req.body;

    if (is_default) {
      await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [user.id]);
    }

    await pool.query(`
      UPDATE user_addresses
      SET label = $1, full_name = $2, phone = $3, address_line1 = $4, address_line2 = $5,
          city = $6, province = $7, postal_code = $8, is_default = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND user_id = $11
    `, [label, full_name, phone, address_line1, address_line2, city, province, postal_code, !!is_default, id, user.id]);

    res.json({ message: 'Address updated successfully' });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    await pool.query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [id, user.id]);
    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/set-default', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    await pool.query('UPDATE user_addresses SET is_default = false WHERE user_id = $1', [user.id]);
    await pool.query('UPDATE user_addresses SET is_default = true WHERE id = $1 AND user_id = $2', [id, user.id]);
    res.json({ message: 'Default address set' });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
