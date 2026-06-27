require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        const result = await pool.query(
            "SELECT id, email, username, role, length(role) as role_length FROM users WHERE email = $1",
            ['amtest@agricatch.com']
        );
        
        console.log('User in database:', JSON.stringify(result.rows, null, 2));
        
        // Also check the actual bytes
        const user = result.rows[0];
        if (user) {
            console.log('Role bytes:', Buffer.from(user.role).toString('hex'));
            console.log('Role length:', user.role_length);
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
})();
