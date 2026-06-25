const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '..', '..', 'backend', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
}

const pool = new Pool({
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT || '5432'),
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function addFruitCatalogEntries() {
  try {
    // Get Fruits category ID
    const categoryResult = await pool.query(
      `SELECT id FROM categories WHERE name = 'Fruits' LIMIT 1`
    );
    
    if (categoryResult.rows.length === 0) {
      console.error('Fruits category not found');
      return;
    }
    
    const fruitCategoryId = categoryResult.rows[0].id;
    console.log(`Fruits category ID: ${fruitCategoryId}`);
    
    // Fruits to add (excluding ones that already exist)
    const fruits = [
      'Mango',
      'Banana',
      'Guyabano',
      'Lanzones',
      'Rambutan',
      'Santol'
    ];
    
    // Check which ones already exist
    const existingResult = await pool.query(
      `SELECT name FROM product_name_catalog WHERE category_id = $1`,
      [fruitCategoryId]
    );
    const existingNames = existingResult.rows.map(r => r.name);
    
    const toAdd = fruits.filter(f => !existingNames.includes(f));
    
    console.log(`Fruits to add: ${toAdd.length}`);
    toAdd.forEach(f => console.log(`- ${f}`));
    
    if (toAdd.length === 0) {
      console.log('No new fruits to add - all already exist');
      return;
    }
    
    // Insert each fruit
    for (const fruit of toAdd) {
      await pool.query(
        `INSERT INTO product_name_catalog (name, category_id, source, is_approved, created_at)
         VALUES ($1, $2, 'admin', true, NOW())`,
        [fruit, fruitCategoryId]
      );
      console.log(`Added: ${fruit}`);
    }
    
    console.log('\nFruit Product Catalog entries added successfully!');
    
  } catch (error) {
    console.error('Error adding fruit catalog entries:', error);
  } finally {
    await pool.end();
  }
}

addFruitCatalogEntries();
