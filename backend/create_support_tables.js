const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'agricatch',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      ssl: { rejectUnauthorized: false },
    });

async function createSupportTables() {
  try {
    console.log('Creating support ticket tables...');
    
    // Create support_tickets table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        farmer_id INTEGER REFERENCES users(id),
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        priority VARCHAR(20) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Support tickets table created/verified');
    
    // Create support_messages table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id),
        message TEXT NOT NULL CHECK (LENGTH(message) <= 500),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Support messages table created/verified');
    
    // Create indexes for support tickets
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_farmer_id 
      ON support_tickets(farmer_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
      ON support_tickets(status)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id 
      ON support_messages(ticket_id)
    `);
    console.log('✓ Support ticket indexes created/verified');
    
    console.log('\nSupport ticket tables have been created!');
    
  } catch (error) {
    console.error('Error creating tables:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

createSupportTables();
