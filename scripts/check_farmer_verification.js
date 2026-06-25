const path = require('path');
module.paths.unshift(path.join(__dirname, 'backend', 'node_modules'));
const { Pool } = require('pg');
const fs = require('fs');

const envPath = path.join(__dirname, 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
}

const pool = new Pool({
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT || '5432'),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

(async () => {
  try {
    const result = await pool.query(
      `SELECT id, email, username, role, is_verified FROM users WHERE email = 'dhelhilis@gmail.com' LIMIT 1`
    );
    console.log('User:', result.rows[0]);
    
    // Check verification requests
    const verifResult = await pool.query(
      `SELECT * FROM verification_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [result.rows[0].id]
    );
    console.log('Verification request:', verifResult.rows[0]);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
