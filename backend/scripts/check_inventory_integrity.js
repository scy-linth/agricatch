require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('../utils/db');

async function checkInventoryIntegrity() {
  console.log('=== INVENTORY INTEGRITY CHECK ===\n');

  try {
    // Check 1: Products with negative stock
    const negativeStock = await pool.query(`
      SELECT id, name, stock_quantity
      FROM products
      WHERE stock_quantity < 0
    `);
    console.log(`1. Products with negative stock: ${negativeStock.rows.length}`);
    if (negativeStock.rows.length > 0) {
      negativeStock.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}): ${p.stock_quantity}`);
      });
    }

    // Check 2: Available products with 0 stock
    const availableZeroStock = await pool.query(`
      SELECT id, name, stock_quantity
      FROM products
      WHERE is_available = true AND stock_quantity = 0
    `);
    console.log(`2. Available products with 0 stock: ${availableZeroStock.rows.length}`);
    if (availableZeroStock.rows.length > 0) {
      availableZeroStock.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}): ${p.stock_quantity}`);
      });
    }

    // Check 3: Stock vs order quantities mismatch
    const stockMismatch = await pool.query(`
      SELECT p.id, p.name, p.stock_quantity,
             COALESCE(SUM(o.quantity), 0) as total_ordered
      FROM products p
      LEFT JOIN orders o ON o.product_id = p.id AND o.status != 'cancelled'
      GROUP BY p.id, p.name, p.stock_quantity
      HAVING p.stock_quantity < COALESCE(SUM(o.quantity), 0)
    `);
    console.log(`3. Products with stock < total ordered: ${stockMismatch.rows.length}`);
    if (stockMismatch.rows.length > 0) {
      stockMismatch.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}): stock=${p.stock_quantity}, ordered=${p.total_ordered}`);
      });
    }

    // Check 4: Products with invalid stock values (NULL or non-numeric)
    const invalidStock = await pool.query(`
      SELECT id, name, stock_quantity
      FROM products
      WHERE stock_quantity IS NULL
    `);
    console.log(`4. Products with NULL stock: ${invalidStock.rows.length}`);
    if (invalidStock.rows.length > 0) {
      invalidStock.rows.forEach(p => {
        console.log(`   - Product ${p.id} (${p.name}): ${p.stock_quantity}`);
      });
    }

    const totalIssues = negativeStock.rows.length + availableZeroStock.rows.length + 
                       stockMismatch.rows.length + invalidStock.rows.length;
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total inventory issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('✓ No inventory corruption detected');
    } else {
      console.log('✗ Inventory corruption detected - review above issues');
    }

  } catch (error) {
    console.error('Error checking inventory integrity:', error);
  } finally {
    await pool.end();
  }
}

checkInventoryIntegrity();
