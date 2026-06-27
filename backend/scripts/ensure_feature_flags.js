const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function ensureFeatureFlagsTable() {
  try {
    // Check if feature_flags table exists
    const checkResult = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feature_flags')"
    );
    
    const tableExists = checkResult.rows[0].exists;
    console.log('feature_flags table exists:', tableExists);
    
    if (!tableExists) {
      console.log('Creating feature_flags table...');
      await pool.query(`
        CREATE TABLE feature_flags (
          key VARCHAR(255) PRIMARY KEY,
          enabled BOOLEAN DEFAULT false,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('feature_flags table created');
      
      // Insert default feature flags
      await pool.query(`
        INSERT INTO feature_flags (key, enabled, description) VALUES
        ('allow_registrations', true, 'Allow new user registrations'),
        ('maintenance_mode', false, 'Site maintenance mode'),
        ('platform_announce', true, 'Platform announcements'),
        ('price_drop_alerts', true, 'Price drop alerts'),
        ('require_product_approval', false, 'Require admin approval for new products')
      `);
      console.log('Default feature flags inserted');
    } else {
      // Check if require_product_approval flag exists
      const flagResult = await pool.query(
        "SELECT * FROM feature_flags WHERE key = 'require_product_approval'"
      );
      
      if (flagResult.rows.length === 0) {
        console.log('Adding require_product_approval flag...');
        await pool.query(`
          INSERT INTO feature_flags (key, enabled, description) VALUES
          ('require_product_approval', false, 'Require admin approval for new products')
        `);
        console.log('require_product_approval flag added');
      }
    }
    
    // Show all feature flags
    const allFlags = await pool.query('SELECT * FROM feature_flags');
    console.log('Current feature flags:', allFlags.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

ensureFeatureFlagsTable();
