require('dotenv').config({ path: '.env' });
const { pool } = require('../utils/db');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Adding expiry_reason column to farmer_subscriptions table...');
    
    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'farmer_subscriptions' 
      AND column_name = 'expiry_reason'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Column expiry_reason already exists. Skipping migration.');
      return;
    }
    
    // Add the column
    await client.query(`
      ALTER TABLE farmer_subscriptions 
      ADD COLUMN expiry_reason TEXT
    `);
    
    console.log('✅ Migration successful: expiry_reason column added to farmer_subscriptions');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
