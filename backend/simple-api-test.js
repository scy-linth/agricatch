const { Pool } = require('pg');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function simpleAPITest() {
  console.log('=== Simple Support Ticket API Test ===\n');

  try {
    // Get a test farmer user
    const farmerResult = await pool.query(
      "SELECT id, username FROM users WHERE role = 'farmer' LIMIT 1"
    );
    
    if (farmerResult.rows.length === 0) {
      console.error('❌ No farmer user found in database');
      return;
    }

    const farmer = farmerResult.rows[0];
    console.log(`✓ Found farmer user: ${farmer.username} (ID: ${farmer.id})`);

    // Get a test admin user
    const adminResult = await pool.query(
      "SELECT id, username, role FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1"
    );
    
    if (adminResult.rows.length === 0) {
      console.error('❌ No admin user found in database');
      return;
    }

    const admin = adminResult.rows[0];
    console.log(`✓ Found admin user: ${admin.username} (ID: ${admin.id}, Role: ${admin.role})`);

    // Generate tokens
    const farmerToken = jwt.sign(
      { id: farmer.id, username: farmer.username, role: 'farmer' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    const adminToken = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('✓ Generated test tokens');

    // Test 1: Create a support ticket as farmer
    console.log('\n--- Test 1: Create Support Ticket ---');
    const createResponse = await fetch('http://localhost:3000/api/support-tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        subject: 'Test Support Ticket',
        description: 'This is a test support ticket for smoke testing.',
        priority: 'medium'
      })
    });

    if (createResponse.ok) {
      const data = await createResponse.json();
      console.log('✓ Support ticket created successfully');
      console.log(`  Ticket ID: ${data.ticket_id}`);
      console.log(`  Status: ${data.status}`);
    } else {
      console.error('❌ Failed to create support ticket');
      console.error(`  Status: ${createResponse.status}`);
      const error = await createResponse.json();
      console.error(`  Error: ${error.message}`);
    }

    // Test 2: Get farmer's tickets
    console.log('\n--- Test 2: Get Farmer Tickets ---');
    let farmerData = null;
    const farmerTicketsResponse = await fetch('http://localhost:3000/api/support-tickets/my?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${farmerToken}`
      }
    });

    if (farmerTicketsResponse.ok) {
      farmerData = await farmerTicketsResponse.json();
      console.log('✓ Retrieved farmer tickets successfully');
      console.log(`  Total tickets: ${farmerData.total}`);
      console.log(`  Tickets returned: ${farmerData.tickets.length}`);
      
      if (farmerData.tickets.length > 0) {
        const firstTicket = farmerData.tickets[0];
        console.log(`  First ticket ID: ${firstTicket.id}`);
        console.log(`  First ticket subject: ${firstTicket.subject}`);
      }
    } else {
      console.error('❌ Failed to get farmer tickets');
      console.error(`  Status: ${farmerTicketsResponse.status}`);
      const error = await farmerTicketsResponse.json();
      console.error(`  Error: ${error.message}`);
    }

    // Test 3: Get all tickets as admin
    console.log('\n--- Test 3: Get All Tickets (Admin) ---');
    const adminTicketsResponse = await fetch('http://localhost:3000/api/support-tickets?status=open&page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (adminTicketsResponse.ok) {
      const data = await adminTicketsResponse.json();
      console.log('✓ Retrieved all tickets successfully');
      console.log(`  Total tickets: ${data.total}`);
      console.log(`  Tickets returned: ${data.tickets.length}`);
    } else {
      console.error('❌ Failed to get all tickets');
      console.error(`  Status: ${adminTicketsResponse.status}`);
      const error = await adminTicketsResponse.json();
      console.error(`  Error: ${error.message}`);
    }

    // Test 4: Get ticket details
    console.log('\n--- Test 4: Get Ticket Details ---');
    if (farmerData && farmerData.tickets.length > 0) {
      const ticketId = farmerData.tickets[0].id;
      const detailResponse = await fetch(`http://localhost:3000/api/support-tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${farmerToken}`
        }
      });

      if (detailResponse.ok) {
        const data = await detailResponse.json();
        console.log('✓ Retrieved ticket details successfully');
        console.log(`  Subject: ${data.ticket.subject}`);
        console.log(`  Status: ${data.ticket.status}`);
        console.log(`  Messages: ${data.messages.length}`);
      } else {
        console.error('❌ Failed to get ticket details');
        console.error(`  Status: ${detailResponse.status}`);
        const error = await detailResponse.json();
        console.error(`  Error: ${error.message}`);
      }
    }

    // Test 5: Send a message to a ticket
    console.log('\n--- Test 5: Send Message to Ticket ---');
    if (farmerData && farmerData.tickets.length > 0) {
      const ticketId = farmerData.tickets[0].id;
      const messageResponse = await fetch(`http://localhost:3000/api/support-tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${farmerToken}`
        },
        body: JSON.stringify({
          message: 'Test message from smoke test'
        })
      });

      if (messageResponse.ok) {
        console.log('✓ Message sent successfully');
      } else {
        console.error('❌ Failed to send message');
        console.error(`  Status: ${messageResponse.status}`);
        const error = await messageResponse.json();
        console.error(`  Error: ${error.message}`);
      }
    }

    // Test 6: Update ticket status (admin only)
    console.log('\n--- Test 6: Update Ticket Status (Admin) ---');
    if (farmerData && farmerData.tickets.length > 0) {
      const ticketId = farmerData.tickets[0].id;
      const updateResponse = await fetch(`http://localhost:3000/api/support-tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'in_progress'
        })
      });

      if (updateResponse.ok) {
        console.log('✓ Ticket status updated successfully');
      } else {
        console.error('❌ Failed to update ticket status');
        console.error(`  Status: ${updateResponse.status}`);
        const error = await updateResponse.json();
        console.error(`  Error: ${error.message}`);
      }
    }

    // Test 7: Get ticket messages
    console.log('\n--- Test 7: Get Ticket Messages ---');
    if (farmerData && farmerData.tickets.length > 0) {
      const ticketId = farmerData.tickets[0].id;
      const messagesResponse = await fetch(`http://localhost:3000/api/support-tickets/${ticketId}/messages?page=1&limit=50`, {
        headers: {
          'Authorization': `Bearer ${farmerToken}`
        }
      });

      if (messagesResponse.ok) {
        const data = await messagesResponse.json();
        console.log('✓ Retrieved ticket messages successfully');
        console.log(`  Total messages: ${data.total}`);
        console.log(`  Messages returned: ${data.messages.length}`);
      } else {
        console.error('❌ Failed to get ticket messages');
        console.error(`  Status: ${messagesResponse.status}`);
        const error = await messagesResponse.json();
        console.error(`  Error: ${error.message}`);
      }
    }

    console.log('\n=== API Test Complete ===');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

simpleAPITest();
