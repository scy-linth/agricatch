const https = require('https');
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const url = process.env.PING_URL || process.env.RENDER_EXTERNAL_URL || 'https://api.agricatch.store';
const path = process.env.PING_PATH || '/_health';
const fullUrl = url.replace(/\/+$/, '') + path;

// Database connection for feature flag check
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DATABASE_URL?.includes('supabase') || process.env.DATABASE_URL?.includes('render') ? { rejectUnauthorized: false } : false
});

async function checkWakeUpPingFlag() {
  try {
    const result = await pool.query(
      'SELECT enabled FROM feature_flags WHERE key = $1',
      ['enable_wake_up_ping']
    );
    // Default to enabled if flag doesn't exist
    return result.rows.length > 0 ? result.rows[0].enabled : true;
  } catch (error) {
    console.error('[self-ping] Error checking feature flag:', error.message);
    // Default to enabled on error to avoid breaking the ping
    return true;
  } finally {
    await pool.end();
  }
}

async function ping() {
  const isEnabled = await checkWakeUpPingFlag();
  
  if (!isEnabled) {
    console.log('[self-ping] Wake-up ping is disabled via feature flag. Skipping.');
    process.exit(0);
  }

  console.log(`[self-ping] Pinging ${fullUrl}`);
  https.get(fullUrl, (res) => {
    console.log(`[self-ping] Status: ${res.statusCode}`);
    res.on('data', () => {});
    res.on('end', () => {
      process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1);
    });
  }).on('error', (err) => {
    console.error('[self-ping] Error:', err.message);
    process.exit(2);
  });
}

ping();
