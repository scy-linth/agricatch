const { pool } = require('../server');

async function checkReservationsDisabled() {
    try {
        const result = await pool.query(`
            SELECT id, name, is_preorder, reservations_disabled, stock_kg, max_preorder_quantity, reserved_quantity
            FROM products
            WHERE is_preorder = true
            ORDER BY id
        `);

        console.log('Preorder products and reservations_disabled status:');
        console.log('=====================================================');
        result.rows.forEach(p => {
            console.log(`ID: ${p.id}, Name: ${p.name}`);
            console.log(`  is_preorder: ${p.is_preorder}`);
            console.log(`  reservations_disabled: ${p.reservations_disabled}`);
            console.log(`  stock_kg: ${p.stock_kg}`);
            console.log(`  max_preorder_quantity: ${p.max_preorder_quantity}`);
            console.log(`  reserved_quantity: ${p.reserved_quantity}`);
            console.log('---');
        });

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkReservationsDisabled();
