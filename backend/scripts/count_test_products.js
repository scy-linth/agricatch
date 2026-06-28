trequire('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function countTestProducts() {
  try {
    const res = await pool.query(`
      SELECT p.id, p.name, p.is_preorder, p.is_available, p.status, p.farmer_id,
             c.name AS category_name, p.created_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE LOWER(p.name) LIKE '%test%'
         OR LOWER(p.name) LIKE '%scenario%'
         OR LOWER(p.name) LIKE '%smoke%'
         OR LOWER(p.name) LIKE '%hero harvest%'
         OR LOWER(p.name) LIKE '%linked%'
         OR LOWER(p.name) LIKE '%impostor%'
         OR LOWER(p.name) LIKE '%placeholder%'
         OR LOWER(p.name) LIKE '%demo%'
         OR LOWER(p.name) LIKE '%sample%'
      ORDER BY p.id
    `);

    console.log(`=== Test Products Found: ${res.rows.length} ===\n`);
    for (const p of res.rows) {
      console.log(`ID ${p.id} | ${p.name} | ${p.category_name || 'NULL'} | preorder=${p.is_preorder} | available=${p.is_available} | status=${p.status} | farmer=${p.farmer_id} | created=${p.created_at}`);
    }

    // Also count generic script-generated products (from refresh_catalog_and_smoke.js)
    const genericRes = await pool.query(`
      SELECT id, name, is_preorder, is_available, farmer_id, p.created_at
      FROM products p
      WHERE LOWER(p.name) LIKE '%fresh mixed vegetables%'
         OR LOWER(p.name) LIKE '%seasonal fruit basket%'
         OR LOWER(p.name) LIKE '%premium well-milled rice%'
         OR LOWER(p.name) LIKE '%farm chicken cut pack%'
         OR LOWER(p.name) LIKE '%aromatic herb bundle%'
         OR LOWER(p.name) LIKE '%market selection%'
      ORDER BY p.id
    `);

    if (genericRes.rows.length > 0) {
      console.log(`\n=== Generic Script-Generated Products: ${genericRes.rows.length} ===\n`);
      for (const p of genericRes.rows) {
        console.log(`ID ${p.id} | ${p.name} | preorder=${p.is_preorder} | available=${p.is_available} | farmer=${p.farmer_id} | created=${p.created_at}`);
      }
    }

    console.log(`\n=== TOTAL: ${res.rows.length + genericRes.rows.length} test/script products ===`);

  } catch (error) {
    console.error('Error:', error.message || error);
  } finally {
    await pool.end();
  }
}

countTestProducts();
