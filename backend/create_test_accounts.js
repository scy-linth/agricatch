const { pool } = require('./utils/db');
const bcrypt = require('bcryptjs');

async function createTestAccounts() {
    try {
        console.log('Creating test accounts...\n');

        const BCRYPT_ROUNDS = 10;
        const testPassword = await bcrypt.hash('Test123456', BCRYPT_ROUNDS);

        // Check if accounts already exist
        const existingAccounts = await pool.query(
            `SELECT id, email, role FROM users WHERE email IN ($1, $2, $3)`,
            ['testfarmer@agricatch.com', 'testadmin@agricatch.com', 'testsuperadmin@agricatch.com']
        );

        const existingEmails = existingAccounts.rows.map(r => r.email);
        console.log('Existing test accounts:', existingEmails);

        // Create Farmer account
        if (!existingEmails.includes('testfarmer@agricatch.com')) {
            const farmer = await pool.query(
                `INSERT INTO users (username, email, password, full_name, first_name, middle_name, last_name, role, is_disabled, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                 RETURNING id, email, role`,
                ['testfarmer', 'testfarmer@agricatch.com', testPassword, 'Test Farmer', 'Test', '', 'Farmer', 'farmer', false]
            );
            console.log('✓ Created Farmer account:', farmer.rows[0]);

            // Create farmer profile
            await pool.query(
                `INSERT INTO farmers (user_id, shop_name, phone, address, is_verified, is_approved, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [farmer.rows[0].id, 'Test Farm Shop', '9123456789', 'Test Address, Manila', true, true]
            );
            console.log('✓ Created farmer profile');
        } else {
            console.log('- Farmer account already exists');
        }

        // Create Admin account
        if (!existingEmails.includes('testadmin@agricatch.com')) {
            const admin = await pool.query(
                `INSERT INTO users (username, email, password, full_name, first_name, middle_name, last_name, role, is_disabled, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                 RETURNING id, email, role`,
                ['testadmin', 'testadmin@agricatch.com', testPassword, 'Test Admin', 'Test', '', 'Admin', 'admin', false]
            );
            console.log('✓ Created Admin account:', admin.rows[0]);

            // Create admin profile
            await pool.query(
                `INSERT INTO admin_users (user_id, email, first_name, last_name, role, is_active, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [admin.rows[0].id, 'testadmin@agricatch.com', 'Test', 'Admin', 'staff', true]
            );
            console.log('✓ Created admin profile');
        } else {
            console.log('- Admin account already exists');
        }

        // Create Super Admin account
        if (!existingEmails.includes('testsuperadmin@agricatch.com')) {
            const superAdmin = await pool.query(
                `INSERT INTO users (username, email, password, full_name, first_name, middle_name, last_name, role, is_disabled, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                 RETURNING id, email, role`,
                ['testsuperadmin', 'testsuperadmin@agricatch.com', testPassword, 'Test Super Admin', 'Test', 'Super', 'Admin', 'super_admin', false]
            );
            console.log('✓ Created Super Admin account:', superAdmin.rows[0]);

            // Create admin profile
            await pool.query(
                `INSERT INTO admin_users (user_id, email, first_name, last_name, role, is_active, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [superAdmin.rows[0].id, 'testsuperadmin@agricatch.com', 'Test', 'Super Admin', 'super_admin', true]
            );
            console.log('✓ Created super admin profile');
        } else {
            console.log('- Super Admin account already exists');
        }

        console.log('\n=== Test Accounts Summary ===');
        console.log('All test accounts password: Test123456');
        console.log('Emails:');
        console.log('  - testfarmer@agricatch.com (Farmer)');
        console.log('  - testadmin@agricatch.com (Admin)');
        console.log('  - testsuperadmin@agricatch.com (Super Admin)');
        console.log('  - testcustomer@test.com (Customer - already exists)');

    } catch (error) {
        console.error('Error creating test accounts:', error);
    } finally {
        await pool.end();
    }
}

createTestAccounts();
