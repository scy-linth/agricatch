const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function applyPhoneUniqueConstraint() {
  try {
    console.log('Applying UNIQUE constraint on phone column...\n');

    // Check if constraint already exists
    const checkConstraint = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname = 'idx_users_phone_unique'
    `);

    if (checkConstraint.rows.length > 0) {
      console.log('✓ UNIQUE constraint already exists on phone column.');
      return;
    }

    // Verify no duplicates exist before applying constraint
    const duplicateCheck = await pool.query(`
      SELECT phone, COUNT(*) as count
      FROM users
      WHERE phone IS NOT NULL AND phone != '' AND phone != '—'
      GROUP BY phone
      HAVING COUNT(*) > 1
    `);

    if (duplicateCheck.rows.length > 0) {
      console.log('⚠ Cannot apply UNIQUE constraint: Duplicate phone numbers still exist.');
      console.log('Please run resolve_duplicate_phones.js first.');
      process.exit(1);
    }

    // Apply partial unique index (PostgreSQL best practice for nullable columns)
    console.log('Creating partial unique index on phone column...');
    await pool.query(`
      CREATE UNIQUE INDEX idx_users_phone_unique 
      ON users(phone) 
      WHERE phone IS NOT NULL 
        AND phone != '' 
        AND phone != '—'
    `);

    console.log('✓ UNIQUE constraint applied successfully.');
    console.log('  Index name: idx_users_phone_unique');
    console.log('  Scope: Non-null, non-empty phone numbers');

  } catch (error) {
    console.error('Error applying UNIQUE constraint:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyPhoneUniqueConstraint();
