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

async function checkCatalogEntries() {
  try {
    const result = await pool.query(
      `SELECT id, name, category_id FROM product_name_catalog ORDER BY name;`
    );
    
    console.log('Existing Product Catalog Entries:');
    console.log('ID\tName\t\tCategory ID');
    console.log('----------------------------------------');
    result.rows.forEach(row => {
      console.log(`${row.id}\t${row.name}\t${row.category_id}`);
    });
    
    console.log(`\nTotal entries: ${result.rows.length}`);
    
    // Check for our planned entries
    const plannedEntries = [
      'Pechay', 'Kangkong', 'Sitaw', 'Talong', 'Ampalaya', 'Okra', 'Kalabasa', 'Kamote',
      'Mango', 'Banana', 'Papaya', 'Calamansi', 'Guyabano', 'Lanzones', 'Rambutan', 'Santol'
    ];
    
    const existingNames = result.rows.map(r => r.name);
    const missingEntries = plannedEntries.filter(name => !existingNames.includes(name));
    
    console.log('\nPlanned entries that need to be added:');
    if (missingEntries.length === 0) {
      console.log('None - all planned entries already exist!');
    } else {
      missingEntries.forEach(name => console.log(`- ${name}`));
    }
    
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await pool.end();
  }
}

checkCatalogEntries();
