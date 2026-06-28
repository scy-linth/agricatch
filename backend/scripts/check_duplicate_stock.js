require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('../utils/db');

async function checkDuplicateStock() {
  console.log('=== DUPLICATE STOCK CHECK ===\n');

  try {
    // Check for duplicate product entries (same name + farmer)
    const duplicateProducts = await pool.query(`
      SELECT name, farmer_id, COUNT(*) as count
      FROM products
      GROUP BY name, farmer_id
      HAVING COUNT(*) > 1
    `);
    console.log(`1. Duplicate product entries (same name + farmer): ${duplicateProducts.rows.length}`);
    if (duplicateProducts.rows.length > 0) {
      duplicateProducts.rows.forEach(p => {
        console.log(`   - "${p.name}" by farmer ${p.farmer_id}: ${p.count} entries`);
      });
    }

    // Check for products with same stock value across multiple entries (potential copy-paste error)
    const sameStock = await pool.query(`
      SELECT stock_quantity, COUNT(*) as count
      FROM products
      WHERE stock_quantity IS NOT NULL
      GROUP BY stock_quantity
      HAVING COUNT(*) > 10
      ORDER BY count DESC
    `);
    console.log(`2. Stock values appearing >10 times: ${sameStock.rows.length}`);
    if (sameStock.rows.length > 0) {
      sameStock.rows.forEach(s => {
        console.log(`   - Stock ${s.stock_quantity}: ${s.count} products`);
      });
    }

    // Check for products with identical pricing and stock (potential duplicates)
    const identicalPricing = await pool.query(`
      SELECT price, stock_quantity, COUNT(*) as count
      FROM products
      WHERE stock_quantity IS NOT NULL
      GROUP BY price, stock_quantity
      HAVING COUNT(*) > 5
      ORDER BY count DESC
    `);
    console.log(`3. Identical price+stock combinations (>5 products): ${identicalPricing.rows.length}`);
    if (identicalPricing.rows.length > 0) {
      identicalPricing.rows.forEach(p => {
        console.log(`   - Price ${p.price}, Stock ${p.stock_quantity}: ${p.count} products`);
      });
    }

    const totalIssues = duplicateProducts.rows.length + sameStock.rows.length + identicalPricing.rows.length;
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total duplicate stock issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✓ No duplicate stock issues detected');
    } else {
      console.log('✗ Potential duplicate stock issues detected - review above');
    }

  } catch (error) {
    console.error('Error checking duplicate stock:', error);
  } finally {
    await pool.end();
  }
}

checkDuplicateStock();
