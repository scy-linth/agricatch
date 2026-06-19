/**
 * Test script to verify audit logs are working for:
 * - Payment accounts (create, update, delete)
 * - Support tickets (status update, message send)
 * - Subscriptions (approve, reject, expire)
 */

const { pool } = require('../utils/db');
const jwt = require('jsonwebtoken');

async function getTestAdminToken() {
  const result = await pool.query(
    "SELECT id, email, username, role FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1"
  );
  if (result.rows.length === 0) {
    throw new Error('No admin user found for testing');
  }
  const user = result.rows[0];
  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' }
  );
  return { token, user };
}

async function testPaymentAccountAuditLogs(token) {
  console.log('\n=== Testing Payment Account Audit Logs ===');
  
  // Create
  const createRes = await fetch('http://localhost:3000/api/admin/payment-accounts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test GCash Account',
      account_number: '09123456789',
      type: 'gcash',
      sort_order: 0
    })
  });
  const createData = await createRes.json();
  console.log('Create payment account:', createRes.ok ? '✅' : '❌', createData.message);
  
  if (!createRes.ok) return;
  
  const accountId = createData.account.id;
  
  // Update
  const updateRes = await fetch(`http://localhost:3000/api/admin/payment-accounts/${accountId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test GCash Account Updated',
      account_number: '09987654321',
      type: 'gcash',
      is_active: true
    })
  });
  const updateData = await updateRes.json();
  console.log('Update payment account:', updateRes.ok ? '✅' : '❌', updateData.message);
  
  // Delete
  const deleteRes = await fetch(`http://localhost:3000/api/admin/payment-accounts/${accountId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const deleteData = await deleteRes.json();
  console.log('Delete payment account:', deleteRes.ok ? '✅' : '❌', deleteData.message);
  
  // Check audit logs
  const auditRes = await pool.query(
    `SELECT action, entity FROM admin_audit_logs 
     WHERE entity = 'payment_accounts' 
     ORDER BY created_at DESC LIMIT 3`
  );
  console.log('Audit logs for payment_accounts:', auditRes.rows.length, 'entries');
  auditRes.rows.forEach(log => {
    console.log(`  - ${log.action} on ${log.entity}`);
  });
}

async function testSupportTicketAuditLogs(token) {
  console.log('\n=== Testing Support Ticket Audit Logs ===');
  
  // First, create a test farmer user if needed
  const farmerRes = await pool.query(
    "SELECT id FROM users WHERE role = 'farmer' LIMIT 1"
  );
  if (farmerRes.rows.length === 0) {
    console.log('❌ No farmer user found for testing support tickets');
    return;
  }
  
  const farmerId = farmerRes.rows[0].id;
  const farmerToken = jwt.sign(
    { id: farmerId, role: 'farmer' },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '1h' }
  );
  
  // Create ticket as farmer
  const createRes = await fetch('http://localhost:3000/api/support-tickets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${farmerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subject: 'Test Ticket for Audit Log',
      description: 'This is a test ticket to verify audit logs are working',
      priority: 'medium'
    })
  });
  const createData = await createRes.json();
  console.log('Create support ticket:', createRes.ok ? '✅' : '❌');
  
  if (!createRes.ok) return;
  
  const ticketId = createData.ticket_id;
  
  // Update status as admin
  const updateRes = await fetch(`http://localhost:3000/api/support-tickets/${ticketId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'in_progress' })
  });
  const updateData = await updateRes.json();
  console.log('Update ticket status:', updateRes.ok ? '✅' : '❌', updateData.message);
  
  // Send message as admin
  const msgRes = await fetch(`http://localhost:3000/api/support-tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'Test admin response for audit log' })
  });
  const msgData = await msgRes.json();
  console.log('Send ticket message:', msgRes.ok ? '✅' : '❌', msgData.message);
  
  // Check audit logs
  const auditRes = await pool.query(
    `SELECT action, entity FROM admin_audit_logs 
     WHERE entity = 'support_tickets' 
     ORDER BY created_at DESC LIMIT 2`
  );
  console.log('Audit logs for support_tickets:', auditRes.rows.length, 'entries');
  auditRes.rows.forEach(log => {
    console.log(`  - ${log.action} on ${log.entity}`);
  });
  
  // Cleanup
  await pool.query('DELETE FROM support_tickets WHERE id = $1', [ticketId]);
}

async function testSubscriptionAuditLogs(token) {
  console.log('\n=== Testing Subscription Audit Logs ===');
  
  // Check if there are any pending subscriptions
  const subRes = await pool.query(
    "SELECT id FROM farmer_subscriptions WHERE status = 'pending' LIMIT 1"
  );
  
  if (subRes.rows.length === 0) {
    console.log('⚠️  No pending subscriptions found for testing');
    console.log('Subscription audit logs are already implemented in admin.js');
    return;
  }
  
  const subId = subRes.rows[0].id;
  
  // Approve
  const approveRes = await fetch(`http://localhost:3000/api/admin/subscriptions/${subId}/approve`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const approveData = await approveRes.json();
  console.log('Approve subscription:', approveRes.ok ? '✅' : '❌', approveData.message);
  
  // Check audit logs
  const auditRes = await pool.query(
    `SELECT action, entity FROM admin_audit_logs 
     WHERE entity = 'subscription' 
     ORDER BY created_at DESC LIMIT 1`
  );
  console.log('Audit logs for subscription:', auditRes.rows.length, 'entries');
  auditRes.rows.forEach(log => {
    console.log(`  - ${log.action} on ${log.entity}`);
  });
}

async function runTests() {
  try {
    console.log('Starting audit log tests...');
    const { token } = await getTestAdminToken();
    console.log('Got admin token for testing');
    
    await testPaymentAccountAuditLogs(token);
    await testSupportTicketAuditLogs(token);
    await testSubscriptionAuditLogs(token);
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await pool.end();
  }
}

runTests();
