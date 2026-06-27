const { pool } = require('./utils/db');
const bcrypt = require('bcryptjs');

async function fixTestFarmer() {
    try {
        console.log('Resetting test farmer password...\n');

        const newPassword = 'Test123456';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Check if testfarmer@test.com exists in users table
        const userCheck = await pool.query(
            'SELECT id, email, username, role FROM users WHERE email = $1 OR username = $2',
            ['testfarmer@test.com', 'testfarmer']
        );

        if (userCheck.rows.length === 0) {
            console.log('ERROR: testfarmer@test.com not found in users table');
            console.log('Attempting to create test farmer account...');
            
            // Create the test farmer in users table
            const insertResult = await pool.query(
                `INSERT INTO users (email, username, password, role, is_active, is_verified, created_at)
                 VALUES ($1, $2, $3, 'farmer', true, true, NOW())
                 RETURNING id, email, username, role`,
                ['testfarmer@test.com', 'testfarmer', hashedPassword]
            );
            
            console.log('Created test farmer account:');
            console.log(JSON.stringify(insertResult.rows[0], null, 2));
        } else {
            console.log('Found existing test farmer account:');
            console.log(JSON.stringify(userCheck.rows[0], null, 2));

            // Update the password
            await pool.query(
                'UPDATE users SET password = $1 WHERE email = $2',
                [hashedPassword, 'testfarmer@test.com']
            );
            console.log('\nPassword updated successfully to: Test123456');
        }

        // Also check farmers table
        const farmerCheck = await pool.query(
            'SELECT id, email, shop_name FROM farmers WHERE email = $1',
            ['testfarmer@test.com']
        );

        if (farmerCheck.rows.length > 0) {
            console.log('\nFarmer profile exists in farmers table:');
            console.log(JSON.stringify(farmerCheck.rows[0], null, 2));
        } else {
            console.log('\nWARNING: No farmer profile found in farmers table');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

fixTestFarmer();
