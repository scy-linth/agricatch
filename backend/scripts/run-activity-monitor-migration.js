const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    console.log('Running Activity Monitor settings migration...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Read the migration file
        const migrationPath = path.join(__dirname, '../../database/migrations/create_activity_monitor_settings.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute the entire migration as a single transaction
        console.log('Executing migration...');
        await client.query(migrationSQL);

        await client.query('COMMIT');
        console.log('\n✅ Migration completed successfully');

        // Verify the settings were inserted
        const result = await client.query('SELECT setting_key, setting_value FROM activity_monitor_settings ORDER BY setting_key');
        console.log('\nSettings in database:');
        result.rows.forEach(row => {
            console.log(`  ${row.setting_key}: ${row.setting_value}`);
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
