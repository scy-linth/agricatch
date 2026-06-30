const { pool } = require('../utils/db');

async function checkAndEnableFlag() {
  
  try {
    console.log('Checking require_product_approval feature flag...');
    
    const result = await pool.query(
      "SELECT key, enabled FROM feature_flags WHERE key = 'require_product_approval'"
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Feature flag does not exist. Creating it...');
      await pool.query(
        "INSERT INTO feature_flags (key, enabled, description) VALUES ($1, $2, $3)",
        ['require_product_approval', true, 'Require admin approval before products become visible']
      );
      console.log('✅ Feature flag created and enabled');
    } else {
      const flag = result.rows[0];
      if (flag.enabled) {
        console.log('✅ Feature flag is already enabled');
      } else {
        console.log('❌ Feature flag is disabled. Enabling it...');
        await pool.query(
          "UPDATE feature_flags SET enabled = true WHERE key = 'require_product_approval'"
        );
        console.log('✅ Feature flag enabled');
      }
    }
    
    // Verify
    const verifyResult = await pool.query(
      "SELECT key, enabled FROM feature_flags WHERE key = 'require_product_approval'"
    );
    console.log('Current state:', verifyResult.rows[0]);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkAndEnableFlag();
