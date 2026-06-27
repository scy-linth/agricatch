const { Pool } = require('pg');

// Render / Supabase Postgres requires SSL for external connections.
// Enable SSL automatically for hosted DBs and allow override via DB_SSL=true.
let pgSsl = false;
if (process.env.DB_SSL === 'true') {
  pgSsl = { rejectUnauthorized: false };
} else {
  const hostHint = String(process.env.DB_HOST || process.env.DATABASE_URL || '').toLowerCase();
  if (hostHint.includes('render.com') || hostHint.includes('supabase.co') || hostHint.includes('supabase.com')) {
    pgSsl = { rejectUnauthorized: false };
  }
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: pgSsl,
      // Set timezone to UTC for consistent timestamps across environments
      timezone: 'UTC',
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'agricatch',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      ssl: pgSsl,
      // Set timezone to UTC for consistent timestamps across environments
      timezone: 'UTC',
    });

// Cache for platform settings to avoid frequent DB queries
let _settingsCache = {};
let _settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute

async function getPlatformSetting(key, defaultValue = null) {
  const now = Date.now();
  
  // Return cached value if still valid
  if (_settingsCache[key] && (now - _settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return _settingsCache[key];
  }
  
  try {
    const result = await pool.query(
      'SELECT value FROM platform_settings WHERE key = $1',
      [key]
    );
    
    if (result.rows.length > 0) {
      const value = result.rows[0].value;
      _settingsCache[key] = value;
      _settingsCacheTime = now;
      return value;
    }
    
    // Return default value if not found
    return defaultValue;
  } catch (error) {
    console.error(`Error reading platform setting ${key}:`, error);
    return defaultValue;
  }
}

async function getPlatformSettings() {
  try {
    const result = await pool.query('SELECT key, value FROM platform_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    _settingsCache = settings;
    _settingsCacheTime = Date.now();
    return settings;
  } catch (error) {
    console.error('Error reading platform settings:', error);
    return {};
  }
}

function clearSettingsCache() {
  _settingsCache = {};
  _settingsCacheTime = 0;
}

module.exports = {
  pool,
  pgSsl,
  getPlatformSetting,
  getPlatformSettings,
  clearSettingsCache,
};
