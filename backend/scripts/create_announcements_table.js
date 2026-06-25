require('dotenv').config();
const { pool } = require('../utils/db');

async function createAnnouncementsTable() {
  try {
    console.log('Creating announcements table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        audience VARCHAR(50) NOT NULL DEFAULT 'all',
        is_active BOOLEAN DEFAULT true,
        is_dismissible BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL
      )
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, expires_at)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements(audience)
    `);
    
    console.log('✅ Announcements table created successfully!');
    await pool.end();
  } catch (error) {
    console.error('❌ Error creating announcements table:', error);
    await pool.end();
    process.exit(1);
  }
}

createAnnouncementsTable();
