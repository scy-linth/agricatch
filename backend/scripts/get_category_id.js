require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function getCategoryId() {
  try {
    const result = await pool.query('SELECT id, name FROM categories WHERE name ILIKE $1', ['%vegetable%']);
    console.log('Categories matching "vegetable":');
    result.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Name: ${row.name}`);
    });
    
    // Also show all categories
    const allCategories = await pool.query('SELECT id, name FROM categories ORDER BY name');
    console.log('\nAll categories:');
    allCategories.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Name: ${row.name}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

getCategoryId();
