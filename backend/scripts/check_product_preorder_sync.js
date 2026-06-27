require('dotenv').config();
const { pool } = require('../utils/db');

async function checkProductPreorderSync() {
  try {
    console.log('=== Checking Product Pre-order Sync ===\n');

    // Get all products grouped by name
    const result = await pool.query(`
      SELECT 
        name,
        COUNT(*) FILTER (WHERE is_preorder = false) as regular_count,
        COUNT(*) FILTER (WHERE is_preorder = true) as preorder_count,
        STRING_AGG(id::text, ', ') as product_ids
      FROM products
      WHERE is_available = true
      GROUP BY name
      ORDER BY name
    `);
    
    console.log(`Total unique product names: ${result.rows.length}\n`);
    
    let mismatches = [];
    let synced = [];
    let missingRegular = [];
    let missingPreorder = [];
    
    result.rows.forEach(row => {
      const hasRegular = row.regular_count > 0;
      const hasPreorder = row.preorder_count > 0;
      
      if (hasRegular && hasPreorder) {
        if (row.regular_count === 1 && row.preorder_count === 1) {
          synced.push({
            name: row.name,
            regular_count: row.regular_count,
            preorder_count: row.preorder_count,
            product_ids: row.product_ids
          });
        } else if (row.regular_count > 1 || row.preorder_count > 1) {
          mismatches.push({
            name: row.name,
            regular_count: row.regular_count,
            preorder_count: row.preorder_count,
            product_ids: row.product_ids
          });
        } else {
          // 1:1 but not both exactly 1 (shouldn't happen with integer counts)
          synced.push({
            name: row.name,
            regular_count: row.regular_count,
            preorder_count: row.preorder_count,
            product_ids: row.product_ids
          });
        }
      } else if (hasRegular && !hasPreorder) {
        missingPreorder.push({
          name: row.name,
          regular_count: row.regular_count,
          product_ids: row.product_ids
        });
      } else if (!hasRegular && hasPreorder) {
        missingRegular.push({
          name: row.name,
          preorder_count: row.preorder_count,
          product_ids: row.product_ids
        });
      }
    });
    
    console.log('=== PERFECTLY SYNCED (1 regular, 1 pre-order) ===');
    if (synced.length === 0) {
      console.log('None');
    } else {
      synced.forEach(item => {
        console.log(`✓ ${item.name}: ${item.regular_count} regular, ${item.preorder_count} pre-order [IDs: ${item.product_ids}]`);
      });
    }
    
    console.log('\n=== MISMATCHES (multiple regular or multiple pre-order) ===');
    if (mismatches.length === 0) {
      console.log('None');
    } else {
      mismatches.forEach(item => {
        console.log(`⚠ ${item.name}: ${item.regular_count} regular, ${item.preorder_count} pre-order [IDs: ${item.product_ids}]`);
      });
    }
    
    console.log('\n=== MISSING PRE-ORDER (has regular but no pre-order) ===');
    if (missingPreorder.length === 0) {
      console.log('None');
    } else {
      missingPreorder.forEach(item => {
        console.log(`⚠ ${item.name}: ${item.regular_count} regular, 0 pre-order [IDs: ${item.product_ids}]`);
      });
    }
    
    console.log('\n=== MISSING REGULAR (has pre-order but no regular) ===');
    if (missingRegular.length === 0) {
      console.log('None');
    } else {
      missingRegular.forEach(item => {
        console.log(`⚠ ${item.name}: 0 regular, ${item.preorder_count} pre-order [IDs: ${item.product_ids}]`);
      });
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Perfectly synced: ${synced.length}`);
    console.log(`Mismatches: ${mismatches.length}`);
    console.log(`Missing pre-order: ${missingPreorder.length}`);
    console.log(`Missing regular: ${missingRegular.length}`);
    
    // Check categories for fruits and vegetables
    console.log('\n=== CATEGORY BREAKDOWN ===');
    const categoryResult = await pool.query(`
      SELECT 
        c.name as category,
        COUNT(*) FILTER (WHERE is_preorder = false) as regular_count,
        COUNT(*) FILTER (WHERE is_preorder = true) as preorder_count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = true
      GROUP BY c.name
      ORDER BY c.name
    `);
    
    categoryResult.rows.forEach(row => {
      console.log(`${row.category}: ${row.regular_count} regular, ${row.preorder_count} pre-order`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkProductPreorderSync();
