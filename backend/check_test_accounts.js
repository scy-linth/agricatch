const { pool } = require('./utils/db');

async function checkTestAccounts() {
    try {
        console.log('Checking for existing test accounts...\n');

        // Check customers
        const customers = await pool.query(
            `SELECT id, email, first_name, last_name, is_verified, created_at 
             FROM customers 
             WHERE email LIKE '%test%' OR first_name LIKE '%test%' OR last_name LIKE '%test%'
             ORDER BY created_at DESC`
        );
        console.log('CUSTOMERS with test-related data:');
        console.log(`Found ${customers.rows.length} test customer(s)`);
        customers.rows.forEach(c => {
            console.log(`  - ID: ${c.id}, Email: ${c.email}, Name: ${c.first_name} ${c.last_name}, Verified: ${c.is_verified}`);
        });

        // Check farmers
        const farmers = await pool.query(
            `SELECT id, email, shop_name, is_verified, is_approved, created_at 
             FROM farmers 
             WHERE email LIKE '%test%' OR shop_name LIKE '%test%'
             ORDER BY created_at DESC`
        );
        console.log('\nFARMERS with test-related data:');
        console.log(`Found ${farmers.rows.length} test farmer(s)`);
        farmers.rows.forEach(f => {
            console.log(`  - ID: ${f.id}, Email: ${f.email}, Shop: ${f.shop_name}, Verified: ${f.is_verified}, Approved: ${f.is_approved}`);
        });

        // Check admins
        const admins = await pool.query(
            `SELECT id, email, first_name, last_name, role, is_active, created_at 
             FROM admin_users 
             WHERE email LIKE '%test%' OR first_name LIKE '%test%' OR last_name LIKE '%test%'
             ORDER BY created_at DESC`
        );
        console.log('\nADMINS with test-related data:');
        console.log(`Found ${admins.rows.length} test admin(s)`);
        admins.rows.forEach(a => {
            console.log(`  - ID: ${a.id}, Email: ${a.email}, Name: ${a.first_name} ${a.last_name}, Role: ${a.role}, Active: ${a.is_active}`);
        });

        // Check for specific test emails we might use
        const testEmails = [
            'testcustomer@agricatch.com',
            'testfarmer@agricatch.com',
            'testadmin@agricatch.com',
            'testsuperadmin@agricatch.com'
        ];

        console.log('\nChecking for specific test email addresses:');
        for (const email of testEmails) {
            const customer = await pool.query('SELECT id FROM customers WHERE email = $1', [email]);
            const farmer = await pool.query('SELECT id FROM farmers WHERE email = $1', [email]);
            const admin = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
            
            if (customer.rows.length > 0) {
                console.log(`  ${email} - EXISTS (Customer)`);
            } else if (farmer.rows.length > 0) {
                console.log(`  ${email} - EXISTS (Farmer)`);
            } else if (admin.rows.length > 0) {
                console.log(`  ${email} - EXISTS (Admin)`);
            } else {
                console.log(`  ${email} - AVAILABLE`);
            }
        }

    } catch (error) {
        console.error('Error checking test accounts:', error);
    } finally {
        await pool.end();
    }
}

checkTestAccounts();
