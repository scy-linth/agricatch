const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../utils/db');

async function changeCustomerPassword() {
    try {
        const newPassword = 'customercustomer';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const result = await pool.query(
            'UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username',
            [hashedPassword, 'customer']
        );

        if (result.rows.length > 0) {
            console.log(`✓ Successfully changed password for user: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
            console.log(`  New password: ${newPassword}`);
        } else {
            console.log('✗ User with username "customer" not found');
        }
    } catch (error) {
        console.error('Error changing password:', error);
    } finally {
        await pool.end();
    }
}

changeCustomerPassword();
