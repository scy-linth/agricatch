require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

async function scanProductsNotInCatalog() {
  console.log('=== Scanning Products Not in Product Name Catalog ===\n');

  try {
    // Get all catalog names (case-insensitive set)
    const catalogRes = await pool.query(`
      SELECT LOWER(name) AS lname, name, category_id, is_disabled
      FROM product_name_catalog
    `);
    const catalogNames = new Set(catalogRes.rows.map(r => r.lname));
    const catalogByName = {};
    catalogRes.rows.forEach(r => { catalogByName[r.lname] = r; });

    console.log(`Catalog entries: ${catalogNames.size}\n`);

    // Get all products with their category name
    const productsRes = await pool.query(`
      SELECT p.id, p.name, p.is_preorder, p.is_available, p.status,
             p.farmer_id, c.name AS category_name,
             p.linked_product_id, p.created_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id
    `);

    console.log(`Total products in DB: ${productsRes.rows.length}\n`);

    const orphans = [];
    for (const p of productsRes.rows) {
      const lname = String(p.name || '').toLowerCase().trim();
      if (!catalogNames.has(lname)) {
        orphans.push(p);
      }
    }

    if (orphans.length === 0) {
      console.log('✓ All products have matching catalog entries.');
      await pool.end();
      return;
    }

    console.log(`⚠ Found ${orphans.length} products NOT in catalog:\n`);
    console.log('ID    | Name                              | Category          | Preorder | Available | Status    | Farmer ID');
    console.log('------|-----------------------------------|-------------------|----------|-----------|-----------|----------');

    for (const p of orphans) {
      const name = String(p.name || '').padEnd(33).slice(0, 33);
      const cat = String(p.category_name || 'NULL').padEnd(17).slice(0, 17);
      const pre = p.is_preorder ? 'yes' : 'no';
      const avail = p.is_available ? 'yes' : 'no';
      const status = String(p.status || 'NULL').padEnd(9).slice(0, 9);
      console.log(`${String(p.id).padEnd(5)} | ${name} | ${cat} | ${pre.padEnd(8)} | ${avail.padEnd(9)} | ${status} | ${p.farmer_id}`);
    }

    // Group by name for summary
    const byName = {};
    for (const p of orphans) {
      const key = p.name;
      if (!byName[key]) byName[key] = [];
      byName[key].push(p);
    }

    console.log(`\n=== Summary: ${Object.keys(byName).length} distinct orphaned product names ===\n`);
    for (const [name, items] of Object.entries(byName).sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${name} (${items.length} product${items.length > 1 ? 's' : ''})`);
    }

  } catch (error) {
    console.error('Error:', error.message || error);
  } finally {
    await pool.end();
  }
}

scanProductsNotInCatalog();
