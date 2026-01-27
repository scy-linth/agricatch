// Migration script to add delivered_at, cancelled_at, and cancelled_by columns to orders table
// Run with: node database/migrations/add_order_timestamp_columns.js

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agri_fishery_marketplace',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Checking for missing timestamp columns in orders table...');
    
    // Check and add delivered_at column
    const checkDeliveredAt = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'delivered_at'
    `);

    if (checkDeliveredAt.rows.length === 0) {
      console.log('Adding delivered_at column...');
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN delivered_at TIMESTAMP
      `);
      console.log('✓ Added delivered_at column');
    } else {
      console.log('✓ delivered_at column already exists');
    }

    // Check and add cancelled_at column
    const checkCancelledAt = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'cancelled_at'
    `);

    if (checkCancelledAt.rows.length === 0) {
      console.log('Adding cancelled_at column...');
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN cancelled_at TIMESTAMP
      `);
      console.log('✓ Added cancelled_at column');
    } else {
      console.log('✓ cancelled_at column already exists');
    }

    // Check and add cancelled_by column
    const checkCancelledBy = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'cancelled_by'
    `);

    if (checkCancelledBy.rows.length === 0) {
      console.log('Adding cancelled_by column...');
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN cancelled_by VARCHAR(20)
      `);
      console.log('✓ Added cancelled_by column');
    } else {
      console.log('✓ cancelled_by column already exists');
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    
    // Verify columns
    const verify = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('delivered_at', 'cancelled_at', 'cancelled_by')
      ORDER BY column_name
    `);
    
    console.log('\nVerified columns:');
    verify.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
