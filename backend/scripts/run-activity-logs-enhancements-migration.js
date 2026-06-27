const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    console.log('Running Activity Logs enhancements migration...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Read the migration file
        const migrationPath = path.join(__dirname, '../../database/migrations/add_activity_logs_enhancements.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute the entire migration as a single transaction
        console.log('Executing migration...');
        await client.query(migrationSQL);

        await client.query('COMMIT');
        console.log('\n✅ Migration completed successfully');

        // Verify the columns were added
        const columnsResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'activity_logs' 
            AND column_name IN ('ip_address', 'user_agent', 'request_id')
            ORDER BY column_name
        `);
        console.log('\nNew columns in activity_logs table:');
        columnsResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
