const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    console.log('Running Activity Logs base migration...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Read the migration file
        const migrationPath = path.join(__dirname, '../../database/migrations/create_activity_logs.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute the entire migration as a single transaction
        console.log('Executing migration...');
        await client.query(migrationSQL);

        await client.query('COMMIT');
        console.log('\n✅ Migration completed successfully');

        // Verify the table was created
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'activity_logs'
            );
        `);
        console.log(`\nactivity_logs table exists: ${tableCheck.rows[0].exists ? '✅' : '❌'}`);

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
