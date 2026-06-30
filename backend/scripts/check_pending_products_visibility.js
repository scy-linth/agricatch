require('dotenv').config();
const { pool } = require('../utils/db');

async function checkPendingProducts() {
  try {
    console.log('=== Checking Pending Products Visibility ===\n');
    
    // Check all pending products
    const pendingResult = await pool.query(`
      SELECT p.id, p.name, p.status, p.is_available, p.is_preorder, u.username as farmer_username
      FROM products p
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${pendingResult.rows.length} pending products:`);
    if (pendingResult.rows.length > 0) {
      pendingResult.rows.forEach(p => {
        console.log(`  - ID ${p.id}: ${p.name} (is_available=${p.is_available}, is_preorder=${p.is_preorder}) by ${p.farmer_username}`);
      });
    } else {
      console.log('  No pending products found');
    }
    
    // Check if any pending products would be returned by the public API
    // (simulating the query from products.js GET / endpoint)
    const apiQueryResult = await pool.query(`
      SELECT p.id, p.name, p.status, p.is_available, p.is_preorder
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.is_available = true
        AND COALESCE(p.is_admin_disabled, false) = false
        AND COALESCE(u.is_disabled, false) = false
        AND p.status = 'approved'
      LIMIT 10
    `);
    
    console.log(`\nProducts returned by public API (status='approved' filter): ${apiQueryResult.rows.length}`);
    
    // Check if pending products would leak through without status filter
    const leakResult = await pool.query(`
      SELECT p.id, p.name, p.status, p.is_available, p.is_preorder
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.is_available = true
        AND COALESCE(p.is_admin_disabled, false) = false
        AND COALESCE(u.is_disabled, false) = false
        AND p.status = 'pending'
      LIMIT 10
    `);
    
    console.log(`\nPending products that would leak without status filter: ${leakResult.rows.length}`);
    if (leakResult.rows.length > 0) {
      console.log('⚠️  WARNING: These pending products would be visible without status filter:');
      leakResult.rows.forEach(p => {
        console.log(`  - ID ${p.id}: ${p.name} (status=${p.status})`);
      });
    } else {
      console.log('✅ No pending products would leak through');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkPendingProducts();
