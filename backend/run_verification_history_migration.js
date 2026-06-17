const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Running verification_history table migration...');
    
    const sql = `
      -- Add verification_history table for tracking verification changes
      -- This provides a complete audit trail of verification status changes

      CREATE TABLE IF NOT EXISTS verification_history (
        id SERIAL PRIMARY KEY,
        farmer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL CHECK (action IN ('verified', 'unverified', 'request_approved', 'request_rejected')),
        actor_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Index for farmer verification history
      CREATE INDEX IF NOT EXISTS idx_verification_history_farmer ON verification_history(farmer_id);

      -- Index for admin actions
      CREATE INDEX IF NOT EXISTS idx_verification_history_admin ON verification_history(actor_admin_id);

      -- Index for timeline queries
      CREATE INDEX IF NOT EXISTS idx_verification_history_created ON verification_history(created_at DESC);
    `;

    await pool.query(sql);
    console.log('✓ Migration completed successfully!');
    console.log('  - verification_history table created');
    console.log('  - Indexes created');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
