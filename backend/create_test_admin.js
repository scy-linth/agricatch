require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        const password = 'test123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await pool.query(
            `INSERT INTO users (email, username, password, role, full_name, is_verified) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             ON CONFLICT (email) DO UPDATE SET password = $3, role = $4
             RETURNING id, email, username, role`,
            ['amtest@agricatch.com', 'amtest', hashedPassword, 'super_admin', 'AM Test Admin', true]
        );
        
        console.log('✓ Test admin user created/updated:');
        console.log(`  Email: amtest@agricatch.com`);
        console.log(`  Password: ${password}`);
        console.log(`  Role: super_admin`);
        console.log(`  ID: ${result.rows[0].id}`);
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
})();
