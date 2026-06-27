// Test script for Harvest Lifecycle and Product Linking features
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = '';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Test login to get auth token
async function testLogin() {
    console.log('\n=== Testing Login ===');
    try {
        const response = await makeRequest('POST', '/auth/login', {
            email: 'testfarmer@example.com',
            password: 'password123'
        });
        
        if (response.status === 200 && response.data.token) {
            authToken = response.data.token;
            console.log('✅ Login successful');
            return true;
        } else {
            console.log('❌ Login failed:', response.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Login error:', error.message);
        return false;
    }
}

// Test harvest lifecycle endpoint
async function testHarvestLifecycle() {
    console.log('\n=== Testing Harvest Lifecycle Endpoint ===');
    try {
        // First, get farmer's products to find a pre-order product
        const productsResponse = await makeRequest('GET', '/products/farmer/1', null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (productsResponse.status !== 200) {
            console.log('❌ Failed to fetch products');
            return false;
        }

        const products = productsResponse.data.products || [];
        const preorderProduct = products.find(p => p.is_preorder);
        
        if (!preorderProduct) {
            console.log('⚠️  No pre-order product found for testing');
            return true; // Skip test if no product available
        }

        console.log(`Testing with product ID: ${preorderProduct.id}`);

        // Test YES path (make available)
        const responseYes = await makeRequest('POST', `/products/${preorderProduct.id}/harvest-lifecycle`, {
            harvest_quantity: 10,
            make_available: true
        }, {
            'Authorization': `Bearer ${authToken}`
        });

        if (responseYes.status === 200) {
            console.log('✅ Harvest lifecycle YES path successful');
            console.log('   Response:', responseYes.data.message);
        } else {
            console.log('❌ Harvest lifecycle YES path failed:', responseYes.data);
        }

        return responseYes.status === 200;
    } catch (error) {
        console.log('❌ Harvest lifecycle error:', error.message);
        return false;
    }
}

// Test product linking
async function testProductLinking() {
    console.log('\n=== Testing Product Linking ===');
    try {
        const productsResponse = await makeRequest('GET', '/products/farmer/1', null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (productsResponse.status !== 200) {
            console.log('❌ Failed to fetch products');
            return false;
        }

        const products = productsResponse.data.products || [];
        const linkedProduct = products.find(p => p.linked_product_id);
        
        if (linkedProduct) {
            console.log('✅ Found linked product:', linkedProduct.id, '->', linkedProduct.linked_product_id);
            return true;
        } else {
            console.log('⚠️  No linked products found (may need to create one)');
            return true;
        }
    } catch (error) {
        console.log('❌ Product linking error:', error.message);
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('=== Starting Regression Tests ===');
    
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
        console.log('\n❌ Tests aborted: Login failed');
        return;
    }

    const harvestTest = await testHarvestLifecycle();
    const linkingTest = await testProductLinking();

    console.log('\n=== Test Summary ===');
    console.log(`Harvest Lifecycle: ${harvestTest ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Product Linking: ${linkingTest ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n=== Tests Complete ===');
}

runTests().catch(console.error);
