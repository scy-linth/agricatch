const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

const router = express.Router();

const addressColumnsCache = {
  columns: null,
  expiry: 0
};

async function getAddressColumns() {
  if (addressColumnsCache.columns && addressColumnsCache.expiry > Date.now()) {
    return addressColumnsCache.columns;
  }

  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_addresses'`
  );
  addressColumnsCache.columns = new Set((result.rows || []).map((row) => String(row.column_name || '').toLowerCase()));
  addressColumnsCache.expiry = Date.now() + 5 * 60 * 1000;
  return addressColumnsCache.columns;
}

function normalizeText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function buildFormattedAddress(address) {
  const parts = [
    normalizeText(address.street) || normalizeText(address.address_line1),
    normalizeText(address.barangay) || normalizeText(address.address_line2),
    normalizeText(address.city),
    normalizeText(address.province),
    normalizeText(address.postal_code)
  ].filter(Boolean);
  return parts.join(', ');
}

function shapeAddressRow(row) {
  const address = {
    ...row,
    street: normalizeText(row.street) || normalizeText(row.address_line1),
    barangay: normalizeText(row.barangay) || normalizeText(row.address_line2),
    city: normalizeText(row.city),
    province: normalizeText(row.province)
  };

  address.formatted_address = buildFormattedAddress(address);
  return address;
}

async function insertAddress(userId, payload) {
  const columns = await getAddressColumns();
  const fieldNames = [];
  const values = [];

  const pushField = (name, value) => {
    if (!columns.has(name)) return;
    fieldNames.push(name);
    values.push(value);
  };

  const street = normalizeText(payload.street) || normalizeText(payload.address_line1);
  const barangay = normalizeText(payload.barangay) || normalizeText(payload.address_line2);
  const city = normalizeText(payload.city);
  const province = normalizeText(payload.province);

  // Validate street field (max 100 characters)
  if (street && street.length > 100) {
    throw new Error('Street address must be 100 characters or less');
  }

  pushField('user_id', userId);
  pushField('label', normalizeText(payload.label) || '');
  pushField('full_name', normalizeText(payload.full_name));
  pushField('first_name', normalizeText(payload.first_name));
  pushField('middle_name', normalizeText(payload.middle_name));
  pushField('last_name', normalizeText(payload.last_name));
  
  // Validate phone number format
  const phone = normalizeText(payload.phone);
  if (phone) {
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
      throw new Error('Phone number must be 10 digits starting with 9');
    }
  }
  pushField('phone', phone);
  pushField('address_line1', street);
  pushField('address_line2', barangay);
  pushField('city', city);
  pushField('province', province);
  pushField('postal_code', normalizeText(payload.postal_code));
  pushField('street', street);
  pushField('barangay', barangay);
  pushField('is_default', !!payload.is_default);

  const placeholders = fieldNames.map((_, index) => `$${index + 1}`).join(', ');
  const result = await pool.query(
    `INSERT INTO user_addresses (${fieldNames.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );

  return result.rows[0];
}

async function updateAddress(userId, id, payload) {
  const columns = await getAddressColumns();
  const sets = [];
  const values = [];

  const setField = (name, value) => {
    if (!columns.has(name)) return;
    values.push(value);
    sets.push(`${name} = $${values.length}`);
  };

  const street = normalizeText(payload.street) || normalizeText(payload.address_line1);
  const barangay = normalizeText(payload.barangay) || normalizeText(payload.address_line2);

  // Validate street field (max 100 characters)
  if (street && street.length > 100) {
    throw new Error('Street address must be 100 characters or less');
  }

  setField('label', normalizeText(payload.label) || '');
  setField('full_name', normalizeText(payload.full_name));
  setField('first_name', normalizeText(payload.first_name));
  setField('middle_name', normalizeText(payload.middle_name));
  setField('last_name', normalizeText(payload.last_name));
  
  // Validate phone number format
  const phone = normalizeText(payload.phone);
  if (phone) {
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
      throw new Error('Phone number must be 10 digits starting with 9');
    }
  }
  setField('phone', phone);
  setField('address_line1', street);
  setField('address_line2', barangay);
  setField('city', normalizeText(payload.city));
  setField('province', normalizeText(payload.province));
  setField('postal_code', normalizeText(payload.postal_code));
  setField('street', street);
  setField('barangay', barangay);
  setField('is_default', !!payload.is_default);

  if (columns.has('updated_at')) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
  }

  values.push(id, userId);
  await pool.query(
    `UPDATE user_addresses SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length}`,
    values
  );
}

const getUserFromToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
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
    res.json({ addresses: (result.rows || []).map(shapeAddressRow) });
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
      first_name,
      middle_name,
      last_name,
      phone,
      street,
      barangay,
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

    const inserted = await insertAddress(user.id, {
      label,
      full_name,
      first_name,
      middle_name,
      last_name,
      phone,
      street,
      barangay,
      address_line1,
      address_line2,
      city,
      province,
      postal_code,
      is_default
    });

    res.status(201).json({ address: shapeAddressRow(inserted) });
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
      first_name,
      middle_name,
      last_name,
      phone,
      street,
      barangay,
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

    await updateAddress(user.id, id, {
      label,
      full_name,
      first_name,
      middle_name,
      last_name,
      phone,
      street,
      barangay,
      address_line1,
      address_line2,
      city,
      province,
      postal_code,
      is_default
    });

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
