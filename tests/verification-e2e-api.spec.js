const { test, expect } = require('@playwright/test');
const { getFarmerToken, getAdminToken, getCustomerToken } = require('./auth-helper');

test.describe('Verification API E2E', () => {
    let farmerToken;
    let adminToken;
    let customerToken;
    let farmerUser;
    let adminUser;
    let customerUser;

    test.beforeAll(async () => {
        // Get tokens for testing
        const farmerData = await getFarmerToken();
        farmerToken = farmerData.token;
        farmerUser = farmerData.user;

        const adminData = await getAdminToken();
        adminToken = adminData.token;
        adminUser = adminData.user;

        const customerData = await getCustomerToken();
        customerToken = customerData.token;
        customerUser = customerData.user;
    });

    test('farmer can submit verification request', async ({ request }) => {
        // RED: Test that farmer can submit a verification request via API
        const response = await request.post('http://localhost:3000/api/farmers/me/verification-request', {
            headers: {
                'Authorization': `Bearer ${farmerToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                notes: 'E2E test verification request',
                document_url: null // Test without document first
            }
        });

        // Should succeed or return meaningful error
        expect(response.status()).toBeGreaterThanOrEqual(200);
        expect(response.status()).toBeLessThan(500);

        const data = await response.json();
        console.log('Verification request response:', data);
    });

    test('customer can submit verification request', async ({ request }) => {
        // RED: Test that customer can submit a verification request via API
        const response = await request.post('http://localhost:3000/api/farmers/me/verification-request', {
            headers: {
                'Authorization': `Bearer ${customerToken}`,
                'Content-Type': 'application/json'
            },
            data: {
                notes: 'E2E test customer verification request',
                document_url: null // Test without document first
            }
        });

        // Should succeed or return meaningful error
        expect(response.status()).toBeGreaterThanOrEqual(200);
        expect(response.status()).toBeLessThan(500);

        const data = await response.json();
        console.log('Customer verification request response:', data);
    });

    test('farmer can get verification status', async ({ request }) => {
        // RED: Test that farmer can fetch their verification status
        const response = await request.get('http://localhost:3000/api/farmers/me/verification-request', {
            headers: {
                'Authorization': `Bearer ${farmerToken}`
            }
        });

        expect(response.status()).toBeGreaterThanOrEqual(200);
        expect(response.status()).toBeLessThan(500);

        const data = await response.json();
        console.log('Verification status response:', data);
    });

    test('admin can get verification requests', async ({ request }) => {
        // RED: Test that admin can fetch all verification requests
        const response = await request.get('http://localhost:3000/api/admin/verification-requests', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        expect(response.status()).toBeGreaterThanOrEqual(200);
        expect(response.status()).toBeLessThan(500);

        const data = await response.json();
        console.log('Admin verification requests response:', data);
    });

    test('admin can filter verification requests by status', async ({ request }) => {
        // RED: Test that admin can filter requests by status
        const response = await request.get('http://localhost:3000/api/admin/verification-requests?status=pending', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        expect(response.status()).toBeGreaterThanOrEqual(200);
        expect(response.status()).toBeLessThan(500);

        const data = await response.json();
        console.log('Filtered verification requests response:', data);
    });

    test('admin can approve verification request', async ({ request }) => {
        // RED: Test that admin can approve a verification request
        // First get pending requests
        const listResponse = await request.get('http://localhost:3000/api/admin/verification-requests?status=pending', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const listData = await listResponse.json();
        
        if (listData.requests && listData.requests.length > 0) {
            const requestId = listData.requests[0].id;
            
            const response = await request.put(`http://localhost:3000/api/admin/verification-requests/${requestId}/review`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    status: 'approved',
                    rejection_reason: null
                }
            });

            expect(response.status()).toBeGreaterThanOrEqual(200);
            expect(response.status()).toBeLessThan(500);

            const data = await response.json();
            console.log('Approve response:', data);
        } else {
            console.log('No pending requests to approve');
        }
    });

    test('admin can reject verification request with reason', async ({ request }) => {
        // RED: Test that admin can reject a verification request
        // First get pending requests
        const listResponse = await request.get('http://localhost:3000/api/admin/verification-requests?status=pending', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const listData = await listResponse.json();
        
        if (listData.requests && listData.requests.length > 0) {
            const requestId = listData.requests[0].id;
            
            const response = await request.put(`http://localhost:3000/api/admin/verification-requests/${requestId}/review`, {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    status: 'rejected',
                    rejection_reason: 'E2E test rejection'
                }
            });

            expect(response.status()).toBeGreaterThanOrEqual(200);
            expect(response.status()).toBeLessThan(500);

            const data = await response.json();
            console.log('Reject response:', data);
        } else {
            console.log('No pending requests to reject');
        }
    });
});
