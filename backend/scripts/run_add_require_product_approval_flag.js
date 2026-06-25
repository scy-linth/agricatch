require('dotenv').config();
const { pool } = require('../utils/db');

async function runMigration() {
  try {
    console.log('Running migration: add_require_product_approval_flag.sql');
    
    const result = await pool.query(`
      INSERT INTO feature_flags (key, name, description, enabled)
      VALUES ('require_product_approval', 'Require Product Approval', 'OFF: Farmers add products freely (auto-approved). ON: New products require admin approval before appearing in marketplace.', true)
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        enabled = EXCLUDED.enabled
      RETURNING key, name, description, enabled
    `);
    
    console.log('✓ Feature flag added/updated successfully:');
    console.log('  Key:', result.rows[0].key);
    console.log('  Name:', result.rows[0].name);
    console.log('  Description:', result.rows[0].description);
    console.log('  Enabled:', result.rows[0].enabled);
    console.log('\nTOGGLE BEHAVIOR:');
    console.log('  - OFF (enabled=false): Farmers can add products freely - auto-approved and immediately visible');
    console.log('  - ON (enabled=true): New products require admin approval before appearing in marketplace');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
