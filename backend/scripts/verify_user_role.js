const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function verifyUserRole() {
    try {
        console.log('=== User Role Verification ===\n');
        
        // Query user ID 5 from database
        const result = await pool.query(
            'SELECT id, username, email, role, full_name FROM users WHERE id = $1',
            [5]
        );
        
        if (result.rows.length === 0) {
            console.log('❌ User ID 5 not found in database');
            return;
        }
        
        const dbUser = result.rows[0];
        console.log('Database User Record:');
        console.log('  ID:', dbUser.id);
        console.log('  Username:', dbUser.username);
        console.log('  Email:', dbUser.email);
        console.log('  Role:', dbUser.role);
        console.log('  Full Name:', dbUser.full_name);
        console.log('  Role Type:', typeof dbUser.role);
        console.log('  Role Length:', dbUser.role.length);
        
        // JWT payload from previous investigation
        const jwtPayload = {
            id: 5,
            username: "scy_linth",
            role: "super_admin",
            full_name: "Super Administrator",
            email: "scy@linth",
            iat: 1782503148,
            exp: 1782589548
        };
        
        console.log('\nJWT Payload:');
        console.log('  ID:', jwtPayload.id);
        console.log('  Username:', jwtPayload.username);
        console.log('  Email:', jwtPayload.email);
        console.log('  Role:', jwtPayload.role);
        console.log('  Role Type:', typeof jwtPayload.role);
        console.log('  Role Length:', jwtPayload.role.length);
        
        console.log('\n=== Comparison ===');
        console.log('JWT Role === DB Role:', jwtPayload.role === dbUser.role ? '✅ MATCH' : '❌ MISMATCH');
        console.log('JWT Role:', JSON.stringify(jwtPayload.role));
        console.log('DB Role:', JSON.stringify(dbUser.role));
        
        if (jwtPayload.role !== dbUser.role) {
            console.log('\n⚠️  ROLE MISMATCH DETECTED');
            console.log('This is likely the root cause of the 403 error.');
            console.log('requireRole middleware compares database role against allowed roles.');
            console.log('If database role differs from JWT role, authorization fails.');
        } else {
            console.log('\n✅ Roles match. The issue is elsewhere.');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

verifyUserRole();
