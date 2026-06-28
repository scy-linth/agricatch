// Test script to verify selective checkout with cart_item_ids
const http = require('http');

// Test credentials
const TEST_EMAIL = 'testcustomer@test.com';
const TEST_PASSWORD = 'Test123456';

// Login to get token
function login() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.token) {
                        resolve(response.token);
                    } else {
                        reject(new Error('No token in response'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Get cart items
function getCart(token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/cart',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Add item to cart
function addToCart(token, productId, quantity = 1) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            product_id: productId,
            quantity: quantity
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/cart',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Test order creation with cart_item_ids
function testOrderWithCartIds(token, cartItemIds) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            recipient_firstname: 'Test',
            recipient_lastname: 'Customer',
            recipient_phone: '9123456789',
            delivery_address: 'Trabajo Market, M. Dela Fuente St., Sampaloc, Manila, Metro Manila',
            delivery_date: '2026-07-01',
            cart_item_ids: cartItemIds
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/orders',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Main test flow
async function runTest() {
    try {
        console.log('[Test] Logging in...');
        const token = await login();
        console.log('[Test] Login successful');

        console.log('[Test] Getting cart...');
        const cartResponse = await getCart(token);
        console.log('[Test] Cart items:', cartResponse.cartItems?.length || 0);

        if (!cartResponse.cartItems || cartResponse.cartItems.length === 0) {
            console.log('[Test] Cart is empty. Adding test items...');
            // Add Chico (product ID 8) and Mangga (product ID 97)
            await addToCart(token, 8, 1);  // Chico
            await addToCart(token, 97, 1); // Mangga
            console.log('[Test] Added Chico and Mangga to cart');

            console.log('[Test] Getting cart again...');
            const cartResponse2 = await getCart(token);
            console.log('[Test] Cart items:', cartResponse2.cartItems?.length || 0);
            
            if (!cartResponse2.cartItems || cartResponse2.cartItems.length === 0) {
                console.log('[Test] Still no items in cart. Test cannot proceed.');
                return;
            }
            
            cartResponse.cartItems = cartResponse2.cartItems;
        }

        // Select first 2 items for testing
        const selectedIds = cartResponse.cartItems.slice(0, 2).map(item => item.id);
        console.log('[Test] Selected cart item IDs:', selectedIds);
        console.log('[Test] Selected items:', cartResponse.cartItems.slice(0, 2).map(i => `${i.name} (ID: ${i.id})`));

        console.log('[Test] Creating order with cart_item_ids...');
        const orderResponse = await testOrderWithCartIds(token, selectedIds);
        console.log('[Test] Order response status:', orderResponse.status);
        console.log('[Test] Order response:', JSON.stringify(orderResponse.data, null, 2));

        if (orderResponse.status === 201 || orderResponse.status === 200) {
            console.log('[Test] ✓ Order created successfully with cart_item_ids');
        } else {
            console.log('[Test] ✗ Order creation failed');
        }

        // Check cart after order
        console.log('[Test] Checking cart after order...');
        const cartAfter = await getCart(token);
        console.log('[Test] Cart items after order:', cartAfter.cartItems?.length || 0);
        console.log('[Test] Remaining items:', cartAfter.cartItems?.map(i => `${i.name} (ID: ${i.id})`));

    } catch (error) {
        console.error('[Test] Error:', error.message);
    }
}

runTest();
