require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../utils/db');

(async () => {
  try {
    const res = await pool.query(`
      SELECT p.id, p.name, p.is_preorder, p.is_available, p.stock_quantity, 
             p.max_preorder_quantity, p.reserved_quantity, p.reservations_disabled,
             p.expiry_date, p.harvest_date, p.status, p.is_admin_disabled,
             u.username AS farmer_username
      FROM products p
      LEFT JOIN users u ON p.farmer_id = u.id
      WHERE p.is_preorder = true
      ORDER BY p.id
      LIMIT 20
    `);
    
    console.log('Preorder products:');
    console.log('Total:', res.rows.length);
    console.log('');
    
    if (res.rows.length === 0) {
      console.log('No preorder products found');
    } else {
      res.rows.forEach(row => {
        const isAvailable = row.is_available === true || row.is_available === 't' || row.is_available === 'true' || row.is_available === 1 || row.is_available === '1';
        const isAdminDisabled = row.is_admin_disabled === true || row.is_admin_disabled === 't' || row.is_admin_disabled === 'true' || row.is_admin_disabled === 1 || row.is_admin_disabled === '1';
        const reserved = Number(row.reserved_quantity ?? 0);
        const max = Number(row.max_preorder_quantity ?? 0);
        const remaining = max > 0 ? max - reserved : 0;
        const isPurchasable = isAvailable && !isAdminDisabled && remaining > 0;
        
        console.log(`ID: ${row.id}, Name: ${row.name}`);
        console.log(`  is_available: ${row.is_available}, is_admin_disabled: ${row.is_admin_disabled}`);
        console.log(`  max_preorder_quantity: ${max}, reserved_quantity: ${reserved}, remaining: ${remaining}`);
        console.log(`  reservations_disabled: ${row.reservations_disabled}`);
        console.log(`  isPurchasable: ${isPurchasable}`);
        console.log('');
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
})();
