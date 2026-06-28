const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        const result = await pool.query('SELECT id, ip_address, current_page, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 5');
        console.log('Recent activity logs:');
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}, IP: ${row.ip_address}, Page: ${row.current_page}, Time: ${row.created_at}`);
        });
        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
