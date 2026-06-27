const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Simulate authenticateToken middleware
async function simulateAuthenticateToken(token) {
    console.log('\n=== Simulating authenticateToken ===');
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('JWT decoded:', decoded);
        
        const result = await pool.query(
            'SELECT id, role, email, full_name, username FROM users WHERE id = $1',
            [decoded.id]
        );
        
        if (!result.rows.length) {
            console.log('User not found in DB');
            return null;
        }
        
        const user = result.rows[0];
        const reqUser = {
            ...decoded,
            id: user.id,
            role: user.role,
            email: user.email,
            username: user.username,
            full_name: user.full_name || user.username
        };
        
        console.log('req.user after authenticateToken:');
        console.log('  ID:', reqUser.id);
        console.log('  Role:', reqUser.role);
        console.log('  Username:', reqUser.username);
        
        return reqUser;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// Simulate requireRole middleware (current implementation)
async function simulateRequireRole(token, allowedRoles) {
    console.log('\n=== Simulating requireRole (current implementation) ===');
    console.log('Allowed roles:', allowedRoles);
    
    try {
        // Current implementation: does NOT use req.user
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('JWT decoded (again):', decoded);
        
        const result = await pool.query(
            'SELECT id, role, email, full_name, username FROM users WHERE id = $1',
            [decoded.id]
        );
        
        if (!result.rows.length) {
            console.log('User not found in DB');
            return { authorized: false, reason: 'User not found' };
        }
        
        const user = result.rows[0];
        console.log('Database role:', user.role);
        console.log('Allowed roles:', allowedRoles);
        console.log('Includes check:', allowedRoles.includes(user.role));
        
        if (allowedRoles.length && !allowedRoles.includes(user.role)) {
            return { authorized: false, reason: 'Role not in allowed list' };
        }
        
        return { authorized: true, user };
    } catch (error) {
        console.error('Error:', error);
        return { authorized: false, reason: 'JWT verification failed' };
    }
}

// Simulate requireRole middleware (proposed implementation)
function simulateRequireRoleOptimized(reqUser, allowedRoles) {
    console.log('\n=== Simulating requireRole (proposed implementation) ===');
    console.log('Allowed roles:', allowedRoles);
    console.log('Using req.user directly (no JWT decode, no DB query)');
    
    console.log('req.user.role:', reqUser.role);
    console.log('Allowed roles:', allowedRoles);
    console.log('Includes check:', allowedRoles.includes(reqUser.role));
    
    if (allowedRoles.length && !allowedRoles.includes(reqUser.role)) {
        return { authorized: false, reason: 'Role not in allowed list' };
    }
    
    return { authorized: true, user: reqUser };
}

async function main() {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXNlcm5hbWUiOiJzY3lfbGludGgiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJmdWxsX25hbWUiOiJTdXBlciBBZG1pbmlzdHJhdG9yIiwiZW1haWwiOiJzY3lAbGludGgiLCJpYXQiOjE3ODI1MDMxNDgsImV4cCI6MTc4MjU4OTU0OH0.JXmiDFYkpYW081GK1_gvt1b4Ojl6-yIeBWlxq2uvhLw";
    
    console.log('=== Authentication Flow Analysis ===');
    console.log('Testing with Activity Monitor pattern: authenticateToken + requireRole');
    
    // Step 1: authenticateToken
    const reqUser = await simulateAuthenticateToken(token);
    
    if (!reqUser) {
        console.log('\n❌ Authentication failed');
        await pool.end();
        return;
    }
    
    // Step 2: requireRole (current implementation)
    const currentResult = await simulateRequireRole(token, ['admin', 'super_admin']);
    
    console.log('\n=== Current Implementation Result ===');
    console.log('Authorized:', currentResult.authorized);
    if (!currentResult.authorized) {
        console.log('Reason:', currentResult.reason);
    }
    
    // Step 3: requireRole (proposed implementation)
    const optimizedResult = simulateRequireRoleOptimized(reqUser, ['admin', 'super_admin']);
    
    console.log('\n=== Proposed Implementation Result ===');
    console.log('Authorized:', optimizedResult.authorized);
    if (!optimizedResult.authorized) {
        console.log('Reason:', optimizedResult.reason);
    }
    
    console.log('\n=== Analysis ===');
    console.log('Current implementation:');
    console.log('  - JWT decode: 2 times (authenticateToken + requireRole)');
    console.log('  - DB queries: 2 times (authenticateToken + requireRole)');
    console.log('  - Uses req.user: NO (ignores it completely)');
    console.log('');
    console.log('Proposed implementation:');
    console.log('  - JWT decode: 1 time (authenticateToken only)');
    console.log('  - DB queries: 1 time (authenticateToken only)');
    console.log('  - Uses req.user: YES (single source of truth)');
    
    await pool.end();
}

main();
