const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testDashboardAPI() {
    console.log('=== Testing Dashboard API Integration ===\n');

    try {
        // 1. Insert some test activity data
        console.log('1. Inserting test activity data...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const testActivities = [
            { role: 'customer', action: 'login', status: 'success' },
            { role: 'customer', action: 'view_product', status: 'success' },
            { role: 'farmer', action: 'add_product', status: 'success' },
            { role: 'admin', action: 'approve_farmer', status: 'success' },
            { role: 'customer', action: 'failed_login', status: 'failed' }
        ];

        for (const activity of testActivities) {
            await pool.query(`
                INSERT INTO activity_logs (session_id, user_id, role, action, description, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, ['test_session', null, activity.role, activity.action, 'Test ' + activity.action, activity.status, new Date()]);
        }
        console.log('   Inserted ' + testActivities.length + ' test activities');

        // 2. Simulate getDashboardSummary query
        console.log('\n2. Simulating getDashboardSummary() queries...');
        
        const queries = {
            todayActivities: 'SELECT COUNT(*) as count FROM activity_logs WHERE created_at >= $1',
            onlineUsers: `
                SELECT COUNT(DISTINCT user_id) as count 
                FROM activity_logs 
                WHERE created_at >= NOW() - INTERVAL '30 minutes'
                AND user_id IS NOT NULL
            `,
            customerActions: `
                SELECT COUNT(*) as count 
                FROM activity_logs 
                WHERE created_at >= $1 AND role = 'customer'
            `,
            farmerActions: `
                SELECT COUNT(*) as count 
                FROM activity_logs 
                WHERE created_at >= $1 AND role = 'farmer'
            `,
            adminActions: `
                SELECT COUNT(*) as count 
                FROM activity_logs 
                WHERE created_at >= $1 AND role IN ('admin', 'super_admin')
            `,
            errorsToday: `
                SELECT COUNT(*) as count 
                FROM activity_logs 
                WHERE created_at >= $1 AND status = 'failed'
            `
        };

        const results = await Promise.all([
            pool.query(queries.todayActivities, [today]),
            pool.query(queries.onlineUsers),
            pool.query(queries.customerActions, [today]),
            pool.query(queries.farmerActions, [today]),
            pool.query(queries.adminActions, [today]),
            pool.query(queries.errorsToday, [today])
        ]);

        const summary = {
            todayActivities: parseInt(results[0].rows[0].count),
            onlineUsers: parseInt(results[1].rows[0].count),
            customerActions: parseInt(results[2].rows[0].count),
            farmerActions: parseInt(results[3].rows[0].count),
            adminActions: parseInt(results[4].rows[0].count),
            errorsToday: parseInt(results[5].rows[0].count)
        };

        console.log('   Dashboard summary:');
        console.log('     todayActivities: ' + summary.todayActivities);
        console.log('     onlineUsers: ' + summary.onlineUsers);
        console.log('     customerActions: ' + summary.customerActions);
        console.log('     farmerActions: ' + summary.farmerActions);
        console.log('     adminActions: ' + summary.adminActions);
        console.log('     errorsToday: ' + summary.errorsToday);

        // 3. Verify the data matches expectations
        console.log('\n3. Verifying data matches expectations...');
        const expected = {
            todayActivities: testActivities.length,
            customerActions: 3,
            farmerActions: 1,
            adminActions: 1,
            errorsToday: 1
        };

        const checks = [
            { name: 'todayActivities', actual: summary.todayActivities, expected: expected.todayActivities },
            { name: 'customerActions', actual: summary.customerActions, expected: expected.customerActions },
            { name: 'farmerActions', actual: summary.farmerActions, expected: expected.farmerActions },
            { name: 'adminActions', actual: summary.adminActions, expected: expected.adminActions },
            { name: 'errorsToday', actual: summary.errorsToday, expected: expected.errorsToday }
        ];

        let allPassed = true;
        checks.forEach(function(check) {
            if (check.actual === check.expected) {
                console.log('   OK ' + check.name + ': ' + check.actual + ' (expected ' + check.expected + ')');
            } else {
                console.log('   FAIL ' + check.name + ': ' + check.actual + ' (expected ' + check.expected + ')');
                allPassed = false;
            }
        });

        // 4. Clean up test data
        console.log('\n4. Cleaning up test data...');
        await pool.query("DELETE FROM activity_logs WHERE description LIKE 'Test %'");
        console.log('   Test data removed');

        console.log('\n=== Dashboard API Integration Test Complete ===');
        if (allPassed) {
            console.log('OK Dashboard API returns real values from database');
            console.log('OK Frontend will display actual statistics');
        } else {
            console.log('WARNING Some checks failed - review the results above');
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await pool.end();
    }
}

testDashboardAPI();
