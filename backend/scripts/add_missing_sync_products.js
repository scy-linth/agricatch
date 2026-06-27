require('dotenv').config();
const { pool } = require('../utils/db');

async function addMissingSyncProducts() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('=== Adding Missing Sync Products ===\n');
    
    // Get category IDs
    const categories = await client.query('SELECT id, name FROM categories WHERE name IN ($1, $2)', ['Fruits', 'Vegetables']);
    const fruitCategoryId = categories.rows.find(c => c.name === 'Fruits')?.id;
    const vegCategoryId = categories.rows.find(c => c.name === 'Vegetables')?.id;
    
    if (!fruitCategoryId || !vegCategoryId) {
      throw new Error('Fruits or Vegetables category not found');
    }
    
    console.log(`Fruits category ID: ${fruitCategoryId}`);
    console.log(`Vegetables category ID: ${vegCategoryId}\n`);
    
    // Get a farmer ID (use the first farmer)
    const farmerResult = await client.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['farmer']);
    if (farmerResult.rows.length === 0) {
      throw new Error('No farmer found');
    }
    const farmerId = farmerResult.rows[0].id;
    console.log(`Using farmer ID: ${farmerId}\n`);
    
    // Products to add
    const productsToAdd = [
      // Fruits - Regular (need 1 more)
      { name: 'Mangga', category_id: fruitCategoryId, farmer_id: farmerId, price: 80, stock_quantity: 50, is_preorder: false },
      // Fruits - Pre-order (need 2 more)
      { name: 'Mangga', category_id: fruitCategoryId, farmer_id: farmerId, price: 80, stock_quantity: 0, is_preorder: true, preorder_availability_date: '2025-07-15', max_preorder_quantity: 100 },
      { name: 'Papaya', category_id: fruitCategoryId, farmer_id: farmerId, price: 60, stock_quantity: 0, is_preorder: true, preorder_availability_date: '2025-07-20', max_preorder_quantity: 80 },
      // Vegetables - Regular (need 3 more)
      { name: 'Pechay', category_id: vegCategoryId, farmer_id: farmerId, price: 40, stock_quantity: 100, is_preorder: false },
      { name: 'Kangkong', category_id: vegCategoryId, farmer_id: farmerId, price: 35, stock_quantity: 80, is_preorder: false },
      { name: 'Mustasa', category_id: vegCategoryId, farmer_id: farmerId, price: 45, stock_quantity: 60, is_preorder: false },
      // Vegetables - Pre-order (need 4 more)
      { name: 'Pechay', category_id: vegCategoryId, farmer_id: farmerId, price: 40, stock_quantity: 0, is_preorder: true, preorder_availability_date: '2025-07-10', max_preorder_quantity: 150 },
      { name: 'Kangkong', category_id: vegCategoryId, farmer_id: farmerId, price: 35, stock_quantity: 0, is_preorder: true, preorder_availability_date: '2025-07-12', max_preorder_quantity: 120 },
      { name: 'Mustasa', category_id: vegCategoryId, farmer_id: farmerId, price: 45, stock_quantity: 0, is_preorder: true, preorder_availability_date: '2025-07-14', max_preorder_quantity: 100 },
      { name: 'Talong', category_id: vegCategoryId, farmer_id: farmerId, price: 70, stock_quantity: 0, is_preorder: true, preorder_availability_date: '2025-07-18', max_preorder_quantity: 90 },
    ];
    
    // Add products
    for (const product of productsToAdd) {
      const result = await client.query(`
        INSERT INTO products (name, description, price, category_id, farmer_id, stock_quantity, unit, 
                              is_available, status, is_preorder, preorder_availability_date, 
                              reserved_quantity, max_preorder_quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, name, is_preorder
      `, [
        product.name,
        `Fresh ${product.name} from local farm`,
        product.price,
        product.category_id,
        product.farmer_id,
        product.stock_quantity,
        'kg',
        true,
        'approved',
        product.is_preorder,
        product.preorder_availability_date || null,
        0,
        product.max_preorder_quantity || null
      ]);
      
      const created = result.rows[0];
      const type = created.is_preorder ? 'Pre-order' : 'Regular';
      console.log(`✓ Added ${type}: ${created.name} (ID: ${created.id})`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n=== Products Added Successfully ===');
    
    // Show final state
    const finalCheck = await client.query(`
      SELECT 
        c.name as category,
        COUNT(*) FILTER (WHERE p.is_preorder = false) as regular_count,
        COUNT(*) FILTER (WHERE p.is_preorder = true) as preorder_count
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = true
        AND c.name IN ('Fruits', 'Vegetables')
      GROUP BY c.name
      ORDER BY c.name
    `);
    
    console.log('\n=== Final Category State ===');
    finalCheck.rows.forEach(row => {
      console.log(`${row.category}: ${row.regular_count} regular, ${row.preorder_count} pre-order`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding products:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingSyncProducts();
