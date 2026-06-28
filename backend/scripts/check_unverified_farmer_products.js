const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    const farmers = await pool.query(`
      SELECT id, email, username, full_name, is_verified, shop_name
      FROM users
      WHERE role = 'farmer' AND COALESCE(is_verified, false) = false
      ORDER BY created_at DESC
    `);

    // Show all farmers with product counts first
    const allCounts = await pool.query(`
      SELECT u.id, u.email, u.is_verified, u.shop_name,
             COUNT(pr.id) AS product_count
      FROM users u
      LEFT JOIN products pr ON pr.farmer_id = u.id
      WHERE u.role = 'farmer'
      GROUP BY u.id, u.email, u.is_verified, u.shop_name
      ORDER BY product_count DESC
      LIMIT 30
    `);
    console.log('=== ALL FARMERS BY PRODUCT COUNT ===');
    for (const r of allCounts.rows) {
      console.log(`  [verified:${r.is_verified}] ${r.email} | shop: ${r.shop_name} | products: ${r.product_count}`);
    }

    console.log('\n=== UNVERIFIED FARMERS WITH PRODUCTS ===');
    for (const f of farmers.rows) {
      console.log(`\n[Farmer] ${f.email} | shop: ${f.shop_name} | verified: ${f.is_verified}`);

      const products = await pool.query(`
        SELECT id, name, is_preorder, is_available, status, stock_quantity
        FROM products
        WHERE farmer_id = $1
        ORDER BY name, is_preorder
      `, [f.id]);

      console.log(`  Total products: ${products.rows.length}`);
      if (products.rows.length === 0) continue;

      const byName = {};
      for (const p of products.rows) {
        if (!byName[p.name]) byName[p.name] = { available: [], preorder: [] };
        if (p.is_preorder) byName[p.name].preorder.push(p.id);
        else byName[p.name].available.push(p.id);
      }

      console.log('\n  --- Per-name breakdown ---');
      let allOk = true;
      for (const [name, counts] of Object.entries(byName)) {
        const ok = counts.available.length === 1 && counts.preorder.length === 1;
        if (!ok) allOk = false;
        console.log(`  ${ok ? '[OK]' : '[MISMATCH]'} "${name}" => available: ${counts.available.length}, preorder: ${counts.preorder.length}`);
      }
      console.log(`\n  Result: ${allOk ? 'ALL 1:1 PAIRS OK' : 'SOME MISMATCHES FOUND'}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
})();
