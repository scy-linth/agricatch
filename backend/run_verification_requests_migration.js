const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Running verification_requests table migration...');
    
    const sql = `
      -- Add verification_requests table for farmer verification workflow
      -- This allows farmers to request verification and admins to review requests

      CREATE TABLE IF NOT EXISTS verification_requests (
        id SERIAL PRIMARY KEY,
        farmer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        documents TEXT, -- JSON array of document URLs/IDs
        notes TEXT,
        rejection_reason TEXT,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Index for farmer verification requests
      CREATE INDEX IF NOT EXISTS idx_verification_requests_farmer ON verification_requests(farmer_id);

      -- Index for status filtering
      CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);

      -- Index for admin review queue (pending first)
      CREATE INDEX IF NOT EXISTS idx_verification_requests_review_queue ON verification_requests(status, created_at) WHERE status = 'pending';
    `;

    await pool.query(sql);
    console.log('✓ Migration completed successfully!');
    console.log('  - verification_requests table created');
    console.log('  - Indexes created');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
