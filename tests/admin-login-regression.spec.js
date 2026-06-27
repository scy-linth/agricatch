const { test, expect } = require('@playwright/test');

test.describe('Admin Login Regression Test', () => {
  test('Backend API login verification for Super Admin', async ({ context }) => {
    // Verify backend API login works for Super Admin
    const response = await context.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'scy@linth',
        password: 'etitsmwa'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    console.log('✓ Super Admin API login successful');
    console.log('User:', data.user);
    console.log('Role:', data.user.role);
    expect(data.user.role).toBe('super_admin');
  });

  test('Backend API login verification for Test Admin', async ({ context }) => {
    // Verify backend API login works for Test Admin
    const response = await context.request.post('http://localhost:3000/api/auth/login', {
      data: {
        email: 'testadmin@test.com',
        password: 'Test123456'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    console.log('✓ Test Admin API login successful');
    console.log('User:', data.user);
    console.log('Role:', data.user.role);
    expect(data.user.role).toBe('admin');
  });
});
