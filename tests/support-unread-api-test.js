// Simple API test to debug unread counter
const fetch = require('node-fetch');

async function testUnreadCounter() {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000/api';
    
    // Test credentials - replace with actual test user credentials
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    
    try {
        // Step 1: Login as admin to get token
        console.log('Step 1: Logging in as admin...');
        const loginResponse = await fetch(`${baseURL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: adminEmail, password: adminPassword })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('Login successful, token obtained');
        
        // Step 2: Get unread count
        console.log('\nStep 2: Getting unread count...');
        const unreadResponse = await fetch(`${baseURL}/support-tickets/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!unreadResponse.ok) {
            throw new Error(`Get unread count failed: ${unreadResponse.status}`);
        }
        
        const unreadData = await unreadResponse.json();
        console.log('Unread count:', unreadData);
        
        // Step 3: Get all support tickets
        console.log('\nStep 3: Getting all support tickets...');
        const ticketsResponse = await fetch(`${baseURL}/support-tickets`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!ticketsResponse.ok) {
            throw new Error(`Get tickets failed: ${ticketsResponse.status}`);
        }
        
        const ticketsData = await ticketsResponse.json();
        console.log('Total tickets:', ticketsData.total);
        console.log('Tickets:', ticketsData.tickets?.map(t => ({ id: t.id, status: t.status, farmer_id: t.farmer_id })));
        
        // Step 4: Get all support messages
        console.log('\nStep 4: Getting all support messages...');
        // This requires direct DB access or a different endpoint
        // For now, let's check the first ticket's messages
        if (ticketsData.tickets && ticketsData.tickets.length > 0) {
            const firstTicketId = ticketsData.tickets[0].id;
            const messagesResponse = await fetch(`${baseURL}/support-tickets/${firstTicketId}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (messagesResponse.ok) {
                const messagesData = await messagesResponse.json();
                console.log(`Messages for ticket ${firstTicketId}:`, messagesData.messages?.map(m => ({
                    id: m.id,
                    sender_id: m.sender_id,
                    is_read: m.is_read,
                    message: m.message?.substring(0, 50)
                })));
            }
        }
        
        console.log('\n=== Test Complete ===');
        
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

testUnreadCounter();
