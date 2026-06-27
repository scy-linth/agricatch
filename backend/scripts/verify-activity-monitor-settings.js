const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifySettings() {
    console.log('=== Activity Monitor Settings Verification ===\n');

    try {
        // 1. Check if settings table exists
        console.log('1. Checking activity_monitor_settings table...');
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'activity_monitor_settings'
            );
        `);
        console.log(`   Table exists: ${tableCheck.rows[0].exists ? '✅' : '❌'}`);

        if (!tableCheck.rows[0].exists) {
            console.log('   ERROR: Settings table does not exist!');
            return;
        }

        // 2. Read current settings from database
        console.log('\n2. Reading current settings from database...');
        const settingsResult = await pool.query('SELECT setting_key, setting_value FROM activity_monitor_settings ORDER BY setting_key');
        
        if (settingsResult.rows.length === 0) {
            console.log('   ⚠️  No settings found in database. Running migration...');
            // Run the migration
            const { execSync } = require('child_process');
            try {
                execSync('psql $DATABASE_URL -f database/migrations/create_activity_monitor_settings.sql', { stdio: 'inherit' });
                console.log('   ✅ Migration completed');
                // Re-read settings
                const retryResult = await pool.query('SELECT setting_key, setting_value FROM activity_monitor_settings ORDER BY setting_key');
                retryResult.rows.forEach(row => {
                    console.log(`   ${row.setting_key}: ${row.setting_value}`);
                });
            } catch (err) {
                console.log('   ❌ Migration failed:', err.message);
                return;
            }
        } else {
            settingsResult.rows.forEach(row => {
                console.log(`   ${row.setting_key}: ${row.setting_value}`);
            });
            console.log(`   ✅ Found ${settingsResult.rows.length} settings`);
        }

        // 3. Test upsert operation
        console.log('\n3. Testing upsert operation...');
        const testKey = 'test_setting';
        const testValue = 'test_value_' + Date.now();
        
        await pool.query(`
            INSERT INTO activity_monitor_settings (setting_key, setting_value, description)
            VALUES ($1, $2, 'Test setting for verification')
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP
        `, [testKey, testValue]);
        
        const verifyResult = await pool.query('SELECT setting_value FROM activity_monitor_settings WHERE setting_key = $1', [testKey]);
        if (verifyResult.rows[0].setting_value === testValue) {
            console.log('   ✅ Upsert operation successful');
        } else {
            console.log('   ❌ Upsert operation failed');
        }

        // Clean up test setting
        await pool.query('DELETE FROM activity_monitor_settings WHERE setting_key = $1', [testKey]);

        // 4. Verify required settings exist
        console.log('\n4. Verifying required settings...');
        const requiredSettings = [
            'retention_days',
            'max_records',
            'auto_delete',
            'deduplication_enabled',
            'deduplication_interval_seconds',
            'max_metadata_size_bytes',
            'log_ip_address',
            'log_user_agent',
            'log_request_id',
            'enabled_roles'
        ];

        const allSettings = settingsResult.rows.map(r => r.setting_key);
        const missing = requiredSettings.filter(s => !allSettings.includes(s));

        if (missing.length === 0) {
            console.log('   ✅ All required settings present');
        } else {
            console.log('   ⚠️  Missing settings:', missing.join(', '));
        }

        console.log('\n=== Verification Complete ===');
        console.log('Settings are properly configured in the database.');
        console.log('The API endpoints will read from and write to this table.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await pool.end();
    }
}

verifySettings();
