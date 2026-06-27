require('dotenv').config();
const { pool } = require('../utils/db');

async function syncAllProducts1to1() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('=== Syncing All Products to 1:1 ===\n');
    
    // Get category IDs
    const categories = await client.query('SELECT id, name FROM categories');
    const categoryMap = {};
    categories.rows.forEach(c => categoryMap[c.name] = c.id);
    
    // Get a farmer ID
    const farmerResult = await client.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['farmer']);
    const farmerId = farmerResult.rows[0].id;
    
    // Get existing products
    const existingProducts = await client.query(`
      SELECT id, name, category_id, price, unit, is_preorder, image_url
      FROM products
      WHERE is_available = true
    `);
    
    const productMap = {};
    existingProducts.rows.forEach(p => {
      if (!productMap[p.name]) {
        productMap[p.name] = {};
      }
      productMap[p.name][p.is_preorder ? 'preorder' : 'regular'] = p;
    });
    
    // Add missing pre-order counterparts
    const missingPreorder = [
      { name: 'Bawang', category: 'Vegetables', price: 120, stock: 0, preorder_date: '2025-07-10', max_qty: 80 },
      { name: 'Calamansi', category: 'Fruits', price: 150, stock: 0, preorder_date: '2025-07-15', max_qty: 100 },
      { name: 'Chico', category: 'Fruits', price: 90, stock: 0, preorder_date: '2025-07-20', max_qty: 60 },
      { name: 'Pakwan', category: 'Fruits', price: 25, stock: 0, preorder_date: '2025-07-25', max_qty: 200 },
    ];
    
    console.log('=== Adding Missing Pre-order Counterparts ===');
    for (const item of missingPreorder) {
      const regular = productMap[item.name]?.regular;
      if (!regular) {
        console.log(`⚠ ${item.name}: Regular not found, skipping`);
        continue;
      }
      
      const categoryId = categoryMap[item.category];
      if (!categoryId) {
        console.log(`⚠ ${item.name}: Category ${item.category} not found, skipping`);
        continue;
      }
      
      const result = await client.query(`
        INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity, unit, 
                              is_available, status, is_preorder, preorder_availability_date, 
                              reserved_quantity, max_preorder_quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, name, is_preorder
      `, [
        item.name,
        `Fresh ${item.name} from local farm`,
        item.price,
        categoryId,
        farmerId,
        item.stock,
        regular.unit || 'kg',
        true,
        'approved',
        true,
        item.preorder_date,
        0,
        item.max_qty
      ]);
      
      const created = result.rows[0];
      console.log(`✓ Added Pre-order: ${created.name} (ID: ${created.id})`);
    }
    
    // Add missing regular counterparts
    const missingRegular = [
      { name: 'Brown rice', category: 'Rice', price: 65, stock: 100 },
      { name: 'Guyabano', category: 'Fruits', price: 85, stock: 50 },
      { name: 'Lanzones', category: 'Fruits', price: 120, stock: 40 },
      { name: 'Papaya', category: 'Fruits', price: 60, stock: 80 },
      { name: 'Talong', category: 'Vegetables', price: 70, stock: 60 },
    ];
    
    console.log('\n=== Adding Missing Regular Counterparts ===');
    for (const item of missingRegular) {
      const preorder = productMap[item.name]?.preorder;
      if (!preorder) {
        console.log(`⚠ ${item.name}: Pre-order not found, skipping`);
        continue;
      }
      
      const categoryId = categoryMap[item.category];
      if (!categoryId) {
        console.log(`⚠ ${item.name}: Category ${item.category} not found, skipping`);
        continue;
      }
      
      const result = await client.query(`
        INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity, unit, 
                              is_available, status, is_preorder, reserved_quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, name, is_preorder
      `, [
        item.name,
        `Fresh ${item.name} from local farm`,
        item.price,
        categoryId,
        farmerId,
        item.stock,
        preorder.unit || 'kg',
        true,
        'approved',
        false,
        0
      ]);
      
      const created = result.rows[0];
      console.log(`✓ Added Regular: ${created.name} (ID: ${created.id})`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n=== Sync Complete ===');
    
    // Show final state
    const finalCheck = await client.query(`
      SELECT 
        name,
        COUNT(*) FILTER (WHERE is_preorder = false) as regular_count,
        COUNT(*) FILTER (WHERE is_preorder = true) as preorder_count
      FROM products
      WHERE is_available = true
      GROUP BY name
      ORDER BY name
    `);
    
    console.log('\n=== Final Product State ===');
    let syncedCount = 0;
    finalCheck.rows.forEach(row => {
      const isSynced = row.regular_count === 1 && row.preorder_count === 1;
      if (isSynced) syncedCount++;
      const status = isSynced ? '✓' : '⚠';
      console.log(`${status} ${row.name}: ${row.regular_count} regular, ${row.preorder_count} pre-order`);
    });
    
    console.log(`\nTotal synced: ${syncedCount}/${finalCheck.rows.length}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during sync:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

syncAllProducts1to1();
