const { test, expect } = require('@playwright/test');

test.describe('Backend Authorization API Regression Test', () => {
  test('Super Admin can access admin endpoints', async ({ context }) => {
    const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email: 'scy@linth', password: 'etitsmwa' }
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    const response = await context.request.get('http://localhost:3000/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Super Admin accessing /api/admin/users:', response.status());
    expect(response.ok()).toBeTruthy();
  });

  test('Admin can access admin endpoints', async ({ context }) => {
    const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email: 'testadmin@test.com', password: 'Test123456' }
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    const response = await context.request.get('http://localhost:3000/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Admin accessing /api/admin/users:', response.status());
    expect(response.ok()).toBeTruthy();
  });

  test('Farmer cannot access admin endpoints', async ({ context }) => {
    const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email: 'testfarmer@test.com', password: 'Test123456' }
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    const response = await context.request.get('http://localhost:3000/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Farmer accessing /api/admin/users:', response.status());
    expect(response.status()).toBe(403);
  });

  test('Customer cannot access admin endpoints', async ({ context }) => {
    const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email: 'testcustomer@test.com', password: 'Test123456' }
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    const response = await context.request.get('http://localhost:3000/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Customer accessing /api/admin/users:', response.status());
    expect(response.status()).toBe(403);
  });

  test('Farmer can access farmer endpoints', async ({ context }) => {
    const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email: 'testfarmer@test.com', password: 'Test123456' }
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    const response = await context.request.get('http://localhost:3000/api/farmers/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Farmer accessing /api/farmers/products:', response.status());
    expect(response.ok()).toBeTruthy();
  });

  test('Customer cannot access farmer endpoints', async ({ context }) => {
    const loginResponse = await context.request.post('http://localhost:3000/api/auth/login', {
      data: { email: 'testcustomer@test.com', password: 'Test123456' }
    });
    const loginData = await loginResponse.json();
    const token = loginData.token;

    const response = await context.request.get('http://localhost:3000/api/farmers/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Customer accessing /api/farmers/products:', response.status());
    expect(response.status()).toBe(403);
  });
});
