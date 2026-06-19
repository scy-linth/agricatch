/**
 * Auth helper for Playwright tests
 * Generates a valid JWT token for an admin user by querying the database
 */
const path = require('path');
const fs = require('fs');

// Add backend node_modules to module resolution paths
module.paths.unshift(path.join(__dirname, '..', 'backend', 'node_modules'));

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

function loadEnv() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found at ' + envPath);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
  return env;
}

async function getAdminToken() {
  const env = loadEnv();
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not found in .env');
  }

  const pool = new Pool({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432'),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Prefer super_admin for testing all sections
    let result = await pool.query(
      `SELECT id, email, username, role FROM users WHERE role = 'super_admin' OR role = 'superadmin' LIMIT 1`
    );
    if (result.rows.length === 0) {
      // Fallback to admin
      result = await pool.query(
        `SELECT id, email, username, role FROM users WHERE role = 'admin' LIMIT 1`
      );
    }
    if (result.rows.length === 0) {
      // Last resort: just get any user
      result = await pool.query(
        `SELECT id, email, username, role FROM users LIMIT 1`
      );
    }
    if (result.rows.length === 0) {
      throw new Error('No users found in database at all');
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '1h' }
    );

    return { token, user };
  } finally {
    await pool.end();
  }
}

async function getFarmerToken() {
  const env = loadEnv();
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not found in .env');
  }

  const pool = new Pool({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432'),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Get specific farmer user for testing
    const result = await pool.query(
      `SELECT id, email, username, role, full_name, shop_name FROM users WHERE email = 'dhelhilis@gmail.com' LIMIT 1`
    );
    if (result.rows.length === 0) {
      // Fallback to any farmer user
      const fallbackResult = await pool.query(
        `SELECT id, email, username, role, full_name, shop_name FROM users WHERE role = 'farmer' LIMIT 1`
      );
      if (fallbackResult.rows.length === 0) {
        throw new Error('No farmer user found in database');
      }
      const user = fallbackResult.rows[0];
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '1h' }
      );
      return { token, user };
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '1h' }
    );

    return { token, user };
  } finally {
    await pool.end();
  }
}

async function loginAsAdmin(page) {
  const { token } = await getAdminToken();
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);
  await page.reload();
}

async function loginAsFarmer(page) {
  const { token } = await getFarmerToken();
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);
  await page.reload();
}

module.exports = { getAdminToken, getFarmerToken, loginAsAdmin, loginAsFarmer };
