const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabaseConsistency() {
  console.log('=== Database Consistency Check ===\n');
  
  try {
    // Check products with invalid MOQ (NULL is valid - defaults to 1)
    const moqCheck = await pool.query(`
      SELECT id, name, minimum_order_quantity, stock_quantity, price
      FROM products
      WHERE minimum_order_quantity IS NOT NULL AND (minimum_order_quantity < 1 OR minimum_order_quantity > 99999)
    `);
    
    if (moqCheck.rows.length > 0) {
      console.log('❌ Products with invalid MOQ:');
      moqCheck.rows.forEach(p => {
        console.log(`   ID: ${p.id}, Name: ${p.name}, MOQ: ${p.minimum_order_quantity}`);
      });
    } else {
      console.log('✅ All products have valid MOQ values (NULL defaults to 1)');
    }
    
    // Check products with invalid prices
    const priceCheck = await pool.query(`
      SELECT id, name, price
      FROM products
      WHERE price IS NULL OR price < 0 OR price > 99999
    `);
    
    if (priceCheck.rows.length > 0) {
      console.log('❌ Products with invalid prices:');
      priceCheck.rows.forEach(p => {
        console.log(`   ID: ${p.id}, Name: ${p.name}, Price: ${p.price}`);
      });
    } else {
      console.log('✅ All products have valid prices');
    }
    
    // Check products with invalid stock
    const stockCheck = await pool.query(`
      SELECT id, name, stock_quantity
      FROM products
      WHERE stock_quantity IS NOT NULL AND (stock_quantity < 0 OR stock_quantity > 99999)
    `);
    
    if (stockCheck.rows.length > 0) {
      console.log('❌ Products with invalid stock quantities:');
      stockCheck.rows.forEach(p => {
        console.log(`   ID: ${p.id}, Name: ${p.name}, Stock: ${p.stock_quantity}`);
      });
    } else {
      console.log('✅ All products have valid stock quantities (NULL allowed for preorders)');
    }
    
    // Check cart items with quantities below MOQ
    const cartCheck = await pool.query(`
      SELECT c.id, p.name, c.quantity, p.minimum_order_quantity
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.quantity < COALESCE(p.minimum_order_quantity, 1)
    `);
    
    if (cartCheck.rows.length > 0) {
      console.log('❌ Cart items with quantity below MOQ:');
      cartCheck.rows.forEach(c => {
        console.log(`   Cart ID: ${c.id}, Product: ${c.name}, Qty: ${c.quantity}, MOQ: ${c.minimum_order_quantity || 1}`);
      });
    } else {
      console.log('✅ All cart items respect MOQ');
    }
    
    // Check order items with quantities below MOQ
    const orderCheck = await pool.query(`
      SELECT oi.id, p.name, oi.quantity, p.minimum_order_quantity
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.quantity < COALESCE(p.minimum_order_quantity, 1)
    `);
    
    if (orderCheck.rows.length > 0) {
      console.log('❌ Order items with quantity below MOQ:');
      orderCheck.rows.forEach(o => {
        console.log(`   Order Item ID: ${o.id}, Product: ${o.name}, Qty: ${o.quantity}, MOQ: ${o.minimum_order_quantity || 1}`);
      });
    } else {
      console.log('✅ All order items respect MOQ');
    }
    
    // Check for orphaned cart items
    const orphanCart = await pool.query(`
      SELECT c.id FROM cart c
      LEFT JOIN products p ON c.product_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (orphanCart.rows.length > 0) {
      console.log('❌ Orphaned cart items found:', orphanCart.rows.length);
    } else {
      console.log('✅ No orphaned cart items');
    }
    
    // Check for orphaned order items
    const orphanOrders = await pool.query(`
      SELECT oi.id FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE p.id IS NULL
    `);
    
    if (orphanOrders.rows.length > 0) {
      console.log('❌ Orphaned order items found:', orphanOrders.rows.length);
    } else {
      console.log('✅ No orphaned order items');
    }
    
    console.log('\n=== Database Consistency Check Complete ===');
    
  } catch (error) {
    console.error('Database check error:', error);
  } finally {
    await pool.end();
  }
}

checkDatabaseConsistency();
