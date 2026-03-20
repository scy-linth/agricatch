const { Pool } = require('pg');

// Render / Supabase Postgres requires SSL for external connections.
// Enable SSL automatically for hosted DBs and allow override via DB_SSL=true.
let pgSsl = false;
if (process.env.DB_SSL === 'true') {
  pgSsl = { rejectUnauthorized: false };
} else {
  const hostHint = String(process.env.DB_HOST || process.env.DATABASE_URL || '').toLowerCase();
  if (hostHint.includes('render.com') || hostHint.includes('supabase.co')) {
    pgSsl = { rejectUnauthorized: false };
  }
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: pgSsl,
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'agricatch',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      ssl: pgSsl,
    });

module.exports = {
  pool,
  pgSsl,
};
