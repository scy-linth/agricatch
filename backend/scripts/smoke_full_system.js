const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../utils/db');

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3010/api';

async function jfetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function assertStep(results, name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  if (!condition) {
    const err = new Error(`FAILED: ${name}`);
    err.step = { name, detail };
    throw err;
  }
}

(async () => {
  const results = [];
  const now = Date.now();
  const customer = {
    username: `cust_${now}`,
    email: `cust_${now}@example.com`,
    password: 'plain123'
  };
  const farmer = {
    username: `farm_${now}`,
    email: `farm_${now}@example.com`,
    password: 'plain123'
  };

  try {
    // 1) Health-ish check via products route
    const productsResp = await jfetch(`${BASE}/products?limit=5`);
    assertStep(results, 'products.list', productsResp.ok, productsResp);

    // 2) Superadmin bypass login
    const superLogin = await jfetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'scy@linth', password: '1234' })
    });
    assertStep(results, 'auth.login.superadmin-bypass', superLogin.ok && superLogin.body?.token, superLogin);

    // 3) OTP bypass verify for customer register
    const otpVerifyCustomer = await jfetch(`${BASE}/otp/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: customer.email, otp: '789878', purpose: 'register' })
    });
    assertStep(results, 'otp.verify.secret.customer', otpVerifyCustomer.ok && otpVerifyCustomer.body?.verified === true, otpVerifyCustomer);

    // 4) Register customer
    const registerCustomer = await jfetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: customer.username,
        email: customer.email,
        password: customer.password,
        full_name: 'Smoke Customer',
        role: 'customer'
      })
    });
    assertStep(results, 'auth.register.customer', registerCustomer.ok && registerCustomer.body?.token, registerCustomer);

    // 5) Login customer
    const loginCustomer = await jfetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: customer.email, password: customer.password, requestedRole: 'customer' })
    });
    assertStep(results, 'auth.login.customer.plaintext', loginCustomer.ok && loginCustomer.body?.token, loginCustomer);
    const customerToken = loginCustomer.body.token;

    // 6) OTP bypass verify for farmer register
    const otpVerifyFarmer = await jfetch(`${BASE}/otp/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: farmer.email, otp: '789878', purpose: 'register' })
    });
    assertStep(results, 'otp.verify.secret.farmer', otpVerifyFarmer.ok && otpVerifyFarmer.body?.verified === true, otpVerifyFarmer);

    // 7) Register farmer
    const registerFarmer = await jfetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: farmer.username,
        email: farmer.email,
        password: farmer.password,
        full_name: 'Smoke Farmer',
        role: 'farmer'
      })
    });
    assertStep(results, 'auth.register.farmer', registerFarmer.ok && registerFarmer.body?.token, registerFarmer);

    // 8) Login farmer
    const loginFarmer = await jfetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: farmer.email, password: farmer.password, requestedRole: 'farmer' })
    });
    assertStep(results, 'auth.login.farmer.plaintext', loginFarmer.ok && loginFarmer.body?.token, loginFarmer);
    const farmerToken = loginFarmer.body.token;
    const farmerId = loginFarmer.body?.user?.id;

    // 9) Confirm plaintext is actually stored for customer (DB check)
    const storedPw = await pool.query('SELECT password FROM users WHERE email = $1', [customer.email]);
    assertStep(
      results,
      'db.password.plaintext.customer',
      storedPw.rows.length > 0 && String(storedPw.rows[0].password || '') === customer.password,
      storedPw.rows[0] || null
    );

    // 10) Get categories and create product as farmer
    const categories = await jfetch(`${BASE}/products/categories`);
    assertStep(results, 'products.categories', categories.ok && Array.isArray(categories.body?.categories), categories);
    const firstCategoryId = categories.body.categories?.[0]?.id;
    assertStep(results, 'products.categories.non-empty', !!firstCategoryId, categories.body?.categories?.slice(0, 3));

    const createProduct = await jfetch(`${BASE}/products`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        name: `Smoke Product ${now}`,
        description: 'Smoke test product',
        price: 99,
        category_id: firstCategoryId,
        stock_quantity: 10,
        unit: 'kg'
      })
    });
    assertStep(results, 'products.create.farmer', createProduct.ok && createProduct.body?.product?.id, createProduct);
    const productId = createProduct.body.product.id;

    // 11) Add to cart as customer
    const addToCart = await jfetch(`${BASE}/cart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ productId, quantity: 2 })
    });
    assertStep(results, 'cart.add', addToCart.ok, addToCart);

    const getCart = await jfetch(`${BASE}/cart`, {
      headers: { authorization: `Bearer ${customerToken}` }
    });
    assertStep(results, 'cart.get', getCart.ok && (getCart.body?.cartItems || []).length > 0, getCart);

    // 12) Place order as customer
    const createOrder = await jfetch(`${BASE}/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        delivery_address: 'Smoke Address',
        delivery_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        special_instructions: 'none'
      })
    });
    assertStep(results, 'orders.create', createOrder.ok && Array.isArray(createOrder.body?.orderIds) && createOrder.body.orderIds.length > 0, createOrder);
    const orderId = createOrder.body.orderIds[0];

    // 13) Farmer sees order and progresses workflow to delivered
    const farmerOrders = await jfetch(`${BASE}/orders/farmer/${farmerId}`, {
      headers: { authorization: `Bearer ${farmerToken}` }
    });
    assertStep(results, 'orders.farmer.list', farmerOrders.ok && Array.isArray(farmerOrders.body?.orders), farmerOrders);

    const flow = ['confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    for (const status of flow) {
      const update = await jfetch(`${BASE}/orders/${orderId}/items/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${farmerToken}`
        },
        body: JSON.stringify({ status })
      });
      assertStep(results, `orders.status.${status}`, update.ok, update);
    }

    // 14) Best-selling/featured should include sales_count > 0 products
    const featured = await jfetch(`${BASE}/products/featured?limit=12`);
    assertStep(results, 'products.featured', featured.ok && Array.isArray(featured.body?.products), featured);

    // 15) Farmer metrics/dashboard endpoints
    const farmerStats = await jfetch(`${BASE}/farmers/me/stats`, {
      headers: { authorization: `Bearer ${farmerToken}` }
    });
    assertStep(results, 'farmers.me.stats', farmerStats.ok, farmerStats);

    const farmerMetrics = await jfetch(`${BASE}/farmers/me/metrics?rangeDays=30`, {
      headers: { authorization: `Bearer ${farmerToken}` }
    });
    assertStep(results, 'farmers.me.metrics', farmerMetrics.ok, farmerMetrics);

    // 16) OTP send endpoint responds (auth OTP flow alive)
    const otpSend = await jfetch(`${BASE}/otp/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `otp_${now}@example.com`, purpose: 'register' })
    });
    assertStep(results, 'otp.send', otpSend.ok || otpSend.status === 429, otpSend);

    console.log(JSON.stringify({ success: true, steps: results }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ success: false, failedStep: error.step || null, steps: results, error: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
