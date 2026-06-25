require('dotenv').config();
const { pool } = require('../utils/db');

async function removeOtpVerificationFlag() {
  try {
    console.log('Removing otp_verification feature flag...');
    
    const result = await pool.query(
      "DELETE FROM feature_flags WHERE key = 'otp_verification' RETURNING key, name"
    );
    
    if (result.rows.length > 0) {
      console.log(`✓ Removed: ${result.rows[0].key} - ${result.rows[0].name}`);
    } else {
      console.log('ℹ otp_verification flag not found (already removed)');
    }
    
    console.log('\n✅ Migration completed successfully!');
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

removeOtpVerificationFlag();
