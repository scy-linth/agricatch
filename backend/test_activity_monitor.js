require('dotenv').config();
const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 3000,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = data ? JSON.parse(data) : null;
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        data: jsonData
                    });
                } catch (e) {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

async function testActivityMonitor() {
    console.log('Testing Activity Monitor API Endpoints...\n');

    // First, login as super_admin to get a token
    console.log('1. Testing login...');
    try {
        const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'amtest@agricatch.com',
                password: 'test123'
            })
        });

        if (!loginResponse.ok) {
            console.error('❌ Login failed:', loginResponse.status);
            console.error('Response:', loginResponse.data);
            return;
        }

        const token = loginResponse.data.token;
        console.log('✓ Login successful, token obtained');
        console.log('User data:', loginResponse.data.user);
        
        // Decode JWT to see what's in the token
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            console.log('JWT payload:', JSON.stringify(payload, null, 2));
        }
        
        console.log();

        // Test Dashboard Summary
        console.log('2. Testing GET /api/activity-monitor/dashboard');
        const dashboardResponse = await makeRequest(`${API_BASE}/activity-monitor/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Status: ${dashboardResponse.status}`);
        if (dashboardResponse.ok) {
            console.log('✓ Dashboard summary:', JSON.stringify(dashboardResponse.data, null, 2));
        } else {
            console.error('❌ Dashboard summary failed');
            console.error('Response:', dashboardResponse.data);
        }
        console.log();

        // Test Activities List
        console.log('3. Testing GET /api/activity-monitor/activities');
        const activitiesResponse = await makeRequest(`${API_BASE}/activity-monitor/activities?page=1&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Status: ${activitiesResponse.status}`);
        if (activitiesResponse.ok) {
            console.log('✓ Activities list:', JSON.stringify(activitiesResponse.data, null, 2));
        } else {
            console.error('❌ Activities list failed');
        }
        console.log();

        // Test Settings (super_admin only)
        console.log('4. Testing GET /api/activity-monitor/settings');
        const settingsResponse = await makeRequest(`${API_BASE}/activity-monitor/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Status: ${settingsResponse.status}`);
        if (settingsResponse.ok) {
            console.log('✓ Settings:', JSON.stringify(settingsResponse.data, null, 2));
        } else {
            console.error('❌ Settings failed');
        }
        console.log();

        // Test Online Users
        console.log('5. Testing GET /api/activity-monitor/online-users');
        const onlineResponse = await makeRequest(`${API_BASE}/activity-monitor/online-users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Status: ${onlineResponse.status}`);
        if (onlineResponse.ok) {
            console.log('✓ Online users:', JSON.stringify(onlineResponse.data, null, 2));
        } else {
            console.error('❌ Online users failed');
        }
        console.log();

        // Test Errors Today
        console.log('6. Testing GET /api/activity-monitor/errors-today');
        const errorsResponse = await makeRequest(`${API_BASE}/activity-monitor/errors-today`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Status: ${errorsResponse.status}`);
        if (errorsResponse.ok) {
            console.log('✓ Errors today:', JSON.stringify(errorsResponse.data, null, 2));
        } else {
            console.error('❌ Errors today failed');
        }
        console.log();

        console.log('\n=== Test Complete ===');

    } catch (error) {
        console.error('Error during testing:', error);
    }
}

testActivityMonitor();
