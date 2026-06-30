require('dotenv').config();
const { pool } = require('../utils/db');

(async () => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM categories WHERE name ILIKE '%vegetable%' OR name ILIKE '%fruit%' OR name ILIKE '%rice%' LIMIT 5"
    );
    
    console.log('Valid categories:');
    result.rows.forEach(c => {
      console.log(`  ID ${c.id}: ${c.name}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
