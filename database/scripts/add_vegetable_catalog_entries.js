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

async function addVegetableCatalogEntries() {
  try {
    // Get Vegetables category ID
    const categoryResult = await pool.query(
      `SELECT id FROM categories WHERE name = 'Vegetables' LIMIT 1`
    );
    
    if (categoryResult.rows.length === 0) {
      console.error('Vegetables category not found');
      return;
    }
    
    const vegCategoryId = categoryResult.rows[0].id;
    console.log(`Vegetables category ID: ${vegCategoryId}`);
    
    // Vegetables to add (excluding ones that already exist)
    const vegetables = [
      'Pechay',
      'Kangkong',
      'Sitaw',
      'Talong',
      'Okra',
      'Kamote'
    ];
    
    // Check which ones already exist
    const existingResult = await pool.query(
      `SELECT name FROM product_name_catalog WHERE category_id = $1`,
      [vegCategoryId]
    );
    const existingNames = existingResult.rows.map(r => r.name);
    
    const toAdd = vegetables.filter(v => !existingNames.includes(v));
    
    console.log(`Vegetables to add: ${toAdd.length}`);
    toAdd.forEach(v => console.log(`- ${v}`));
    
    if (toAdd.length === 0) {
      console.log('No new vegetables to add - all already exist');
      return;
    }
    
    // Insert each vegetable
    for (const veg of toAdd) {
      await pool.query(
        `INSERT INTO product_name_catalog (name, category_id, source, is_approved, created_at)
         VALUES ($1, $2, 'admin', true, NOW())`,
        [veg, vegCategoryId]
      );
      console.log(`Added: ${veg}`);
    }
    
    console.log('\nVegetable Product Catalog entries added successfully!');
    
  } catch (error) {
    console.error('Error adding vegetable catalog entries:', error);
  } finally {
    await pool.end();
  }
}

addVegetableCatalogEntries();
