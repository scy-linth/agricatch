const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

module.exports = (...allowedRoles) => async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, role, email, full_name, username FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(403).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    req.user = {
      ...decoded,
      id: user.id,
      role: user.role,
      email: user.email,
      username: user.username,
      full_name: user.full_name || user.username
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
