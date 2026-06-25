const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n').reduce((acc, line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#') && valueParts.length) {
    acc[key.trim()] = valueParts.join('=').trim();
  }
  return acc;
}, {});

const pool = new Pool({
  connectionString: envContent.includes('DATABASE_URL') 
    ? envLines.DATABASE_URL 
    : `postgresql://${envLines.DB_USER}:${envLines.DB_PASSWORD}@${envLines.DB_HOST}:${envLines.DB_PORT}/${envLines.DB_NAME}`,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Running migration: add_cart_is_preorder.sql');
    
    // Add is_preorder column
    await client.query(`
      ALTER TABLE cart ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT false
    `);
    console.log('✓ Added is_preorder column to cart table');
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cart_is_preorder ON cart(is_preorder)
    `);
    console.log('✓ Created index idx_cart_is_preorder');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
