const { test, expect } = require('@playwright/test');
const http = require('http');

// Test credentials
const CUSTOMER_CREDS = { email: 'testcustomer@test.com', password: 'Test123456' };
const FARMER_CREDS = { email: 'testfarmer@test.com', password: 'Test123456' };
const ADMIN_CREDS = { email: 'admin@agricatch.com', password: 'Admin123456' };

// Helper function for API requests
async function makeAPIRequest(path, method, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
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

test.describe('Order Management System - Complete QA Suite', () => {
  let customerToken, farmerToken, adminToken;
  let testProductId;

  // Setup: Login and get tokens
  test.beforeAll(async () => {
    // Customer login
    const customerRes = await makeAPIRequest('/auth/login', 'POST', CUSTOMER_CREDS);
    if (customerRes.status === 200) {
      customerToken = customerRes.data.token;
    }

    // Farmer login
    const farmerRes = await makeAPIRequest('/auth/login', 'POST', FARMER_CREDS);
    if (farmerRes.status === 200) {
      farmerToken = farmerRes.data.token;
    }

    // Admin login
    const adminRes = await makeAPIRequest('/auth/login', 'POST', ADMIN_CREDS);
    if (adminRes.status === 200) {
      adminToken = adminRes.data.token;
    }

    // Use existing product ID 162 for testing (has image already)
    testProductId = 162;
    
    // Set MOQ=5 on existing product
    await makeAPIRequest('/products/162', 'PUT', {
      minimum_order_quantity: 5,
      stock_quantity: 100,
      is_available: true
    }, farmerToken);
  });

  // TEST SUITE 4: MOQ Validation (API Level)
  test.describe('Suite 4: MOQ Validation', () => {
    test('MOQ = 1 should be accepted', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 1
      }, farmerToken);
      expect(res.status).toBe(200);
    });

    test('MOQ = 2 should be accepted', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 2
      }, farmerToken);
      expect(res.status).toBe(200);
    });

    test('MOQ = 5 should be accepted', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 5
      }, farmerToken);
      expect(res.status).toBe(200);
    });

    test('MOQ = 10 should be accepted', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 10
      }, farmerToken);
      expect(res.status).toBe(200);
    });

    test('MOQ = 0 should be rejected', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 0
      }, farmerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('must be a positive whole number');
    });

    test('MOQ = -5 should be rejected', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: -5
      }, farmerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('must be a positive whole number');
    });

    test('MOQ = 1.5 (decimal) should be rejected', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 1.5
      }, farmerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('must be a positive whole number');
    });

    test('MOQ = 999999 should be rejected (upper bound)', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 999999
      }, farmerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('must not exceed');
    });
  });

  // TEST SUITE 4: Cart MOQ Validation
  test.describe('Suite 4: Cart MOQ Validation', () => {
    test.beforeEach(async () => {
      // Reset MOQ to 5 before each cart test
      await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 5,
        stock_quantity: 100,
        is_available: true
      }, farmerToken);
    });

    test('Add to cart below MOQ should be rejected', async () => {
      if (!testProductId) test.skip();
      
      const res = await makeAPIRequest('/cart', 'POST', {
        productId: testProductId,
        quantity: 4 // Below MOQ=5
      }, customerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('Minimum order');
    });

    test('Add to cart at MOQ should succeed', async () => {
      if (!testProductId) test.skip();
      
      const res = await makeAPIRequest('/cart', 'POST', {
        productId: testProductId,
        quantity: 5 // At MOQ=5
      }, customerToken);
      expect(res.status).toBe(200);
    });

    test('Add to cart above MOQ should succeed', async () => {
      if (!testProductId) test.skip();
      
      const res = await makeAPIRequest('/cart', 'POST', {
        productId: testProductId,
        quantity: 10 // Above MOQ=5
      }, customerToken);
      expect(res.status).toBe(200);
    });

    test('Update cart below MOQ should be rejected', async () => {
      if (!testProductId) test.skip();
      
      // First add at MOQ
      await makeAPIRequest('/cart', 'POST', {
        productId: testProductId,
        quantity: 5
      }, customerToken);
      
      // Get cart to find item ID
      const cartRes = await makeAPIRequest('/cart', 'GET', null, customerToken);
      const cartItem = cartRes.data.cartItems.find(item => item.product_id === testProductId);
      
      if (cartItem) {
        const updateRes = await makeAPIRequest(`/cart/${cartItem.id}`, 'PUT', {
          quantity: 4 // Below MOQ
        }, customerToken);
        expect(updateRes.status).toBe(400);
        expect(updateRes.data.message).toContain('Minimum order');
      }
    });
  });

  // TEST SUITE 4: Upper Bound Validation
  test.describe('Suite 4: Upper Bound Validation (99999)', () => {
    test('Price = 100000 should be rejected', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        price: 100000
      }, farmerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('must not exceed');
    });

    test('Stock quantity = 100000 should be rejected', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        stock_quantity: 100000
      }, farmerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('must not exceed');
    });

    test('MOQ = 100000 should be rejected', async () => {
      const res = await makeAPIRequest('/products/162', 'PUT', {
        minimum_order_quantity: 100000
      }, farmerToken);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain('must not exceed');
    });
  });

  // Cleanup
  test.afterAll(async () => {
    // Reset product to default state
    await makeAPIRequest('/products/162', 'PUT', {
      minimum_order_quantity: 1,
      stock_quantity: 100,
      is_available: true
    }, farmerToken);
  });
});
