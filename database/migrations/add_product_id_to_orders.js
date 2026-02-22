// Migration script to add product_id column to orders table
// Run with: node database/migrations/add_product_id_to_orders.js

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agricatch',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Checking if product_id column exists...');
    
    // Check if product_id column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'product_id'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('Adding product_id column to orders table...');
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN product_id INTEGER REFERENCES products(id)
      `);
      console.log('✓ Added product_id column');
    } else {
      console.log('✓ product_id column already exists');
    }

    // Check and add quantity column
    const checkQuantity = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'quantity'
    `);
    
    if (checkQuantity.rows.length === 0) {
      console.log('Adding quantity column to orders table...');
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1
      `);
      console.log('✓ Added quantity column');
    } else {
      console.log('✓ quantity column already exists');
    }

    // Check and add price column
    const checkPrice = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'price'
    `);
    
    if (checkPrice.rows.length === 0) {
      console.log('Adding price column to orders table...');
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0
      `);
      console.log('✓ Added price column');
    } else {
      console.log('✓ price column already exists');
    }

    // Check and add total_amount column
    const checkTotal = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'total_amount'
    `);
    
    if (checkTotal.rows.length === 0) {
      console.log('Adding total_amount column to orders table...');
      await client.query(`
        ALTER TABLE orders 
        ADD COLUMN total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0
      `);
      console.log('✓ Added total_amount column');
    } else {
      console.log('✓ total_amount column already exists');
    }

    // Create index on product_id
    console.log('Creating index on product_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id)
    `);
    console.log('✓ Index created');

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    
    // Verify columns
    const verify = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('product_id', 'quantity', 'price', 'total_amount')
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
