require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function deletePlatformFeeSetting() {
  try {
    console.log('Deleting unused platform_fee setting...');
    
    const result = await pool.query(
      "DELETE FROM platform_settings WHERE key = 'platform_fee'"
    );
    
    if (result.rowCount > 0) {
      console.log(`✓ Deleted ${result.rowCount} row(s) from platform_settings`);
    } else {
      console.log('✓ No platform_fee setting found (already deleted)');
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

deletePlatformFeeSetting();
