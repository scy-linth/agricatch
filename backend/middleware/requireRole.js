const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');

module.exports = (...allowedRoles) => async (req, res, next) => {
  try {
    console.log(`[requireRole START] Path=${req.path}, Allowed=[${allowedRoles.join(', ')}]`);
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      console.log('[requireRole] No token found');
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[requireRole] Token decoded:', decoded);
    console.log('[requireRole] Token role:', decoded.role);
    
    const result = await pool.query(
      'SELECT id, role, email, full_name, username FROM users WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length) {
      console.log('[requireRole] User not found in DB');
      return res.status(403).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    console.log(`[requireRole] User from DB:`, user);
    console.log(`[requireRole] User role=${user.role}, Allowed roles=[${allowedRoles.join(', ')}]`);

    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      console.log(`[requireRole] ACCESS DENIED - role ${user.role} not in allowed list`);
      console.log(`[requireRole] Comparing: "${user.role}" vs [${allowedRoles.map(r => `"${r}"`).join(', ')}]`);
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    console.log(`[requireRole] ACCESS GRANTED`);
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
    console.error('[requireRole] Error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
