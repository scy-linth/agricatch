// Run migration to add pre-order fields
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    console.log('Running migration: add pre-order fields...\n');
    
    // Add pre-order fields to products table
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false`);
    console.log('✓ Added products.is_preorder');
    
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_availability_date DATE`);
    console.log('✓ Added products.preorder_availability_date');
    
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0)`);
    console.log('✓ Added products.reserved_quantity');
    
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS max_preorder_quantity INTEGER CHECK (max_preorder_quantity IS NULL OR max_preorder_quantity > 0)`);
    console.log('✓ Added products.max_preorder_quantity');
    
    // Add is_preorder field to orders table
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false`);
    console.log('✓ Added orders.is_preorder');
    
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_converted_at TIMESTAMP`);
    console.log('✓ Added orders.preorder_converted_at');

    // Add per-order preorder allocation tracking columns
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_reserved_quantity INTEGER DEFAULT 0 CHECK (preorder_reserved_quantity >= 0)`);
    console.log('✓ Added orders.preorder_reserved_quantity');
    
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS preorder_fulfilled_quantity INTEGER DEFAULT 0 CHECK (preorder_fulfilled_quantity >= 0)`);
    console.log('✓ Added orders.preorder_fulfilled_quantity');
    
    // Add indexes for performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_is_preorder ON products(is_preorder)`);
    console.log('✓ Created idx_products_is_preorder');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_preorder_availability_date ON products(preorder_availability_date)`);
    console.log('✓ Created idx_products_preorder_availability_date');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_is_preorder ON orders(is_preorder)`);
    console.log('✓ Created idx_orders_is_preorder');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_preorder_converted_at ON orders(preorder_converted_at)`);
    console.log('✓ Created idx_orders_preorder_converted_at');
    
    // Add check constraint for date validation (idempotent)
    try {
      await pool.query(`
        ALTER TABLE products ADD CONSTRAINT preorder_expiry_check CHECK (
          preorder_availability_date IS NULL OR
          expiry_date IS NULL OR
          expiry_date >= preorder_availability_date
        )
      `);
      console.log('✓ Added preorder_expiry_check constraint');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ preorder_expiry_check constraint already exists');
      } else {
        throw error;
      }
    }

    // Add NOT NULL constraints for pre-order fields
    try {
      await pool.query(`ALTER TABLE products ALTER COLUMN is_preorder SET NOT NULL`);
      console.log('✓ Added NOT NULL constraint on products.is_preorder');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('cannot be cast')) {
        console.log('✓ NOT NULL constraint on products.is_preorder already set or not needed');
      } else {
        console.log('✓ Could not set NOT NULL on products.is_preorder (may have NULL values)');
      }
    }

    try {
      await pool.query(`ALTER TABLE products ALTER COLUMN reserved_quantity SET NOT NULL`);
      console.log('✓ Added NOT NULL constraint on products.reserved_quantity');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('cannot be cast')) {
        console.log('✓ NOT NULL constraint on products.reserved_quantity already set or not needed');
      } else {
        console.log('✓ Could not set NOT NULL on products.reserved_quantity (may have NULL values)');
      }
    }

    try {
      await pool.query(`ALTER TABLE orders ALTER COLUMN is_preorder SET NOT NULL`);
      console.log('✓ Added NOT NULL constraint on orders.is_preorder');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('cannot be cast')) {
        console.log('✓ NOT NULL constraint on orders.is_preorder already set or not needed');
      } else {
        console.log('✓ Could not set NOT NULL on orders.is_preorder (may have NULL values)');
      }
    }

    // Add check constraint for preorder availability date requirement (idempotent)
    try {
      await pool.query(`
        ALTER TABLE products ADD CONSTRAINT preorder_availability_required CHECK (
          is_preorder = false OR preorder_availability_date IS NOT NULL
        )
      `);
      console.log('✓ Added preorder_availability_required constraint');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ preorder_availability_required constraint already exists');
      } else {
        throw error;
      }
    }

    // Add check constraint for reserved quantity <= max preorder quantity (idempotent)
    try {
      await pool.query(`
        ALTER TABLE products ADD CONSTRAINT preorder_reserved_within_max CHECK (
          max_preorder_quantity IS NULL OR reserved_quantity <= max_preorder_quantity
        )
      `);
      console.log('✓ Added preorder_reserved_within_max constraint');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ preorder_reserved_within_max constraint already exists');
      } else {
        throw error;
      }
    }

    // Add check constraint for stock_quantity >= 0 (idempotent)
    try {
      await pool.query(`
        ALTER TABLE products ADD CONSTRAINT stock_quantity_non_negative CHECK (
          stock_quantity >= 0
        )
      `);
      console.log('✓ Added stock_quantity_non_negative constraint');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ stock_quantity_non_negative constraint already exists');
      } else {
        throw error;
      }
    }
    
    console.log('\nMigration complete!');
    
  } catch (error) {
    console.error('Error running migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
