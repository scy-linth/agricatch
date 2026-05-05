const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=\s]+)=(.*)$/);
    if (!m) return;
    const k = m[1].trim();
    let v = m[2].trim();
    if ((v.startsWith("\'") && v.endsWith("\'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  });
}

// Load backend/.env if present, then fallback to secret.ven
const repoRoot = path.join(__dirname, '..');
loadEnvFile(path.join(repoRoot, '.env'));
loadEnvFile(path.join(repoRoot, 'secret.ven'));
try {
  require('dotenv').config({ path: path.join(repoRoot, '.env') });
} catch (_) {}

function getPgSsl(host) {
  if (process.env.DB_SSL === 'true') return { rejectUnauthorized: false };
  const h = String(host || process.env.DB_HOST || process.env.DATABASE_URL || '').toLowerCase();
  if (h.includes('render.com') || h.includes('supabase.com') || h.includes('supabase.co') || h.includes('pooler.supabase.com')) {
    return { rejectUnauthorized: false };
  }
  return false;
}

function makeClient() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.TARGET_DATABASE_URL || '';
  if (connectionString) {
    return new Client({ connectionString, ssl: getPgSsl(process.env.DB_HOST || process.env.DATABASE_URL) });
  }
  return new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'agricatch',
    password: process.env.DB_PASSWORD || 'password',
    port: Number(process.env.DB_PORT || 5432),
    ssl: getPgSsl(process.env.DB_HOST),
  });
}

async function listUsers(limit = 100) {
  const client = makeClient();
  try {
    await client.connect();
    const q = `SELECT id, email, username, role, created_at FROM users ORDER BY id DESC LIMIT $1`;
    const res = await client.query(q, [limit]);
    console.log(JSON.stringify({ rows: res.rows, count: res.rowCount }, null, 2));
  } catch (e) {
    console.error('Query error:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

const lim = Number(process.argv[2] || 100);
listUsers(lim).catch((e) => { console.error(e); process.exit(1); });
