// Feature flag helper middleware and functions
const jwt = require('jsonwebtoken');

// Lazy-load the shared DB pool so this module can be required before dotenv runs
let _pool = null;
function getPool() {
  if (!_pool) {
    const { pool } = require('../utils/db');
    _pool = pool;
  }
  return _pool;
}

async function getFeatureFlag(key) {
  try {
    const result = await getPool().query(
      'SELECT enabled FROM feature_flags WHERE key = $1',
      [key]
    );
    return result.rows.length > 0 ? result.rows[0].enabled : false;
  } catch (error) {
    console.error(`Error checking feature flag ${key}:`, error);
    return false; // Default to disabled on error
  }
}

// Middleware to check if registrations are allowed
async function requireRegistrationsEnabled(req, res, next) {
  const enabled = await getFeatureFlag('allow_registrations');
  if (!enabled) {
    return res.status(403).json({ message: 'New registrations are currently disabled' });
  }
  next();
}

// Middleware to check if site is in maintenance mode
async function checkMaintenanceMode(req, res, next) {
  try {
    const enabled = await getFeatureFlag('maintenance_mode');
    if (!enabled) {
      return next();
    }

    // Allow auth routes so users can still log in (super_admin needs to log in to disable maintenance)
    const path = String(req.path || '').toLowerCase();
    if (path.startsWith('/api/auth/') || path === '/api/auth') {
      return next();
    }

    // Allow health check and static assets
    if (path === '/_health' || !path.startsWith('/api/')) {
      return next();
    }

    // Read JWT from headers to check if user is super_admin
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const token = header.slice('Bearer '.length).trim();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.role === 'super_admin') {
          return next();
        }
      } catch (_) {
        // Invalid token, proceed to block
      }
    }

    // Block all other users
    return res.status(503).json({
      message: 'Site is under maintenance. Please try again later.'
    });
  } catch (error) {
    console.error('Maintenance mode check error:', error);
    next();
  }
}

// Middleware to check if platform announcements are enabled
async function requireAnnouncementsEnabled(req, res, next) {
  const enabled = await getFeatureFlag('platform_announce');
  if (!enabled) {
    return res.status(403).json({ message: 'Platform announcements are currently disabled' });
  }
  next();
}

// Middleware to check if price drop alerts are enabled
async function requirePriceDropAlertsEnabled(req, res, next) {
  const enabled = await getFeatureFlag('price_drop_alerts');
  if (!enabled) {
    return res.status(403).json({ message: 'Price drop alerts are currently disabled' });
  }
  next();
}

// Middleware to check if product approval is required
async function requireProductApprovalEnabled(req, res, next) {
  const enabled = await getFeatureFlag('require_product_approval');
  if (!enabled) {
    return res.status(403).json({ message: 'Product approval is currently disabled' });
  }
  next();
}

module.exports = {
  getFeatureFlag,
  requireRegistrationsEnabled,
  checkMaintenanceMode,
  requireAnnouncementsEnabled,
  requirePriceDropAlertsEnabled,
  requireProductApprovalEnabled
};
