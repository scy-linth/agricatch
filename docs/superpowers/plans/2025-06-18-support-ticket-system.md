# Support Ticket System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dedicated support ticket system allowing farmers to submit platform issues and admin to respond via threaded conversations, separate from the existing farmer-customer chat system.

**Architecture:** Separate database tables (support_tickets, support_messages) with dedicated API routes. Frontend uses Bootstrap modals for farmer access (profile dropdown) and admin access (sidebar section). Real-time polling for message updates, notification integration for admin responses.

**Tech Stack:** PostgreSQL, Node.js/Express, Bootstrap 5.3.3, Bootstrap Icons, existing agricatch-admin.css styling

## Global Constraints

- Use existing agricatch-admin.css classes (ac-btn-primary, ac-section-hero, verification-tabs, admin-section-card)
- Modal pattern: `.modal.open` class (consistent with customer-rating-modal)
- Character limit: 500 chars for messages (consistent with existing chat)
- Timestamp format: `toLocaleDateString('en-PH')`
- API base: Use existing apiBase pattern from farmer.js/admin.js
- Auth: Use existing getUserFromToken helper from backend routes
- Polling: 5 seconds for messages, 60 seconds for badge counts
- Status values: open, in_progress, resolved, closed
- Priority values: low, medium, high

---

## File Structure

**New files:**
- `backend/routes/support-tickets.js` - Support ticket API endpoints

**Modified files:**
- `database/create_missing_tables.js` - Add support_tickets and support_messages tables
- `backend/server.js` - Register support-tickets routes
- `frontend/farmer.html` - Add support ticket modals and profile dropdown option
- `frontend/admin.html` - Add support ticket section and modal
- `frontend/js/farmer.js` - Add support ticket methods
- `frontend/js/admin.js` - Add support ticket methods

---

### Task 1: Add Database Tables

**Files:**
- Modify: `database/create_missing_tables.js`

**Interfaces:**
- Produces: support_tickets table, support_messages table with proper constraints and indexes

- [ ] **Step 1: Add support_tickets table creation**

Find the line after the messages table creation (around line 87) and add:

```javascript
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
```

- [ ] **Step 2: Add support_messages table creation**

After the support_tickets table creation, add:

```javascript
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
```

- [ ] **Step 3: Add indexes for performance**

After the support_messages table creation, add:

```javascript
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
```

- [ ] **Step 4: Run migration to create tables**

Run: `node database/create_missing_tables.js`
Expected: Success messages for support_tickets and support_messages tables

- [ ] **Step 5: Commit**

```bash
git add database/create_missing_tables.js
git commit -m "feat: add support_tickets and support_messages tables"
```

---

### Task 2: Create Support Ticket API Routes

**Files:**
- Create: `backend/routes/support-tickets.js`

**Interfaces:**
- Consumes: getUserFromToken helper, pool database connection
- Produces: POST /api/support-tickets, GET /api/support-tickets, GET /api/support-tickets/my, GET /api/support-tickets/:id, PUT /api/support-tickets/:id, POST /api/support-tickets/:id/messages, GET /api/support-tickets/:id/messages

- [ ] **Step 1: Create route file with imports and setup**

Create `backend/routes/support-tickets.js`:

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

function getUserFromToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded;
  } catch (err) {
    return null;
  }
}

const MAX_MESSAGE_LENGTH = 500;
```

- [ ] **Step 2: Add POST /api/support-tickets endpoint**

```javascript
router.post('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (user.role !== 'farmer') return res.status(403).json({ message: 'Only farmers can create tickets' });

    const { subject, description, priority } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ message: 'Subject and description are required' });
    }
    if (subject.length > 200) {
      return res.status(400).json({ message: 'Subject exceeds maximum length of 200 characters' });
    }
    if (description.length > 500) {
      return res.status(400).json({ message: 'Description exceeds maximum length of 500 characters' });
    }
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ message: 'Priority must be low, medium, or high' });
    }

    const result = await pool.query(
      `INSERT INTO support_tickets (farmer_id, subject, description, priority, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING id, status`,
      [user.id, subject.trim(), description.trim(), priority || 'medium']
    );

    res.status(201).json({ ticket_id: result.rows[0].id, status: result.rows[0].status });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] **Step 3: Add GET /api/support-tickets endpoint (admin)**

```javascript
router.get('/', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'admin access required' });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE st.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM support_tickets st ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT st.*, u.full_name as farmer_name, u.email as farmer_email,
              (SELECT COUNT(*) FROM support_messages sm WHERE sm.ticket_id = st.id) as message_count
       FROM support_tickets st
       JOIN users u ON st.farmer_id = u.id
       ${whereClause}
       ORDER BY st.updated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      tickets: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] **Step 4: Add GET /api/support-tickets/my endpoint (farmer)**

```javascript
router.get('/my', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (user.role !== 'farmer') return res.status(403).json({ message: 'Farmer access required' });

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM support_tickets WHERE farmer_id = $1',
      [user.id]
    );

    const result = await pool.query(
      `SELECT st.*,
              (SELECT COUNT(*) FROM support_messages sm WHERE sm.ticket_id = st.id AND sm.is_read = false AND sm.sender_id != $1) as unread_count
       FROM support_tickets st
       WHERE st.farmer_id = $1
       ORDER BY st.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    res.json({
      tickets: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] **Step 5: Add GET /api/support-tickets/:id endpoint**

```javascript
router.get('/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM support_tickets WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const ticket = result.rows[0];

    // Check access: farmer can only see own tickets, admin can see all
    if (user.role === 'farmer' && ticket.farmer_id !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark messages as read if farmer is viewing
    if (user.role === 'farmer') {
      await pool.query(
        'UPDATE support_messages SET is_read = true WHERE ticket_id = $1 AND sender_id != $2',
        [id, user.id]
      );
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT sm.*, u.full_name as sender_name, u.role as sender_role
       FROM support_messages sm
       JOIN users u ON sm.sender_id = u.id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC`,
      [id]
    );

    res.json({
      ticket,
      messages: messagesResult.rows
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] **Step 6: Add PUT /api/support-tickets/:id endpoint**

```javascript
router.put('/:id', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'admin access required' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const result = await pool.query(
      'UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json({ message: 'Ticket status updated', ticket: result.rows[0] });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] **Step 7: Add POST /api/support-tickets/:id/messages endpoint**

```javascript
router.post('/:id/messages', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
    }

    // Check ticket exists and user has access
    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    const ticket = ticketResult.rows[0];

    if (user.role === 'farmer' && ticket.farmer_id !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Insert message
    await pool.query(
      `INSERT INTO support_messages (ticket_id, sender_id, message)
       VALUES ($1, $2, $3)`,
      [id, user.id, message.trim()]
    );

    // Update ticket updated_at
    await pool.query(
      'UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // If admin sends message, create notification for farmer
    if (['admin', 'super_admin'].includes(user.role)) {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
         VALUES ($1, 'support_ticket', 'New Support Message', $2, false, CURRENT_TIMESTAMP)`,
        [ticket.farmer_id, `admin responded to your support ticket: ${ticket.subject}`]
      );
    }

    res.status(201).json({ message: 'Message sent' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] **Step 8: Add GET /api/support-tickets/:id/messages endpoint**

```javascript
router.get('/:id/messages', async (req, res) => {
  try {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ message: 'Authentication required' });

    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Check ticket exists and user has access
    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    const ticket = ticketResult.rows[0];

    if (user.role === 'farmer' && ticket.farmer_id !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM support_messages WHERE ticket_id = $1',
      [id]
    );

    const result = await pool.query(
      `SELECT sm.*, u.full_name as sender_name, u.role as sender_role
       FROM support_messages sm
       JOIN users u ON sm.sender_id = u.id
       WHERE sm.ticket_id = $1
       ORDER BY sm.created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
```

- [ ] **Step 9: Export router**

```javascript
module.exports = router;
```

- [ ] **Step 10: Commit**

```bash
git add backend/routes/support-tickets.js
git commit -m "feat: add support ticket API routes"
```

---

### Task 3: Register Support Ticket Routes

**Files:**
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: backend/routes/support-tickets.js
- Produces: Registered /api/support-tickets routes

- [ ] **Step 1: Add support tickets router import**

Find the other route imports (around line 20-30) and add:

```javascript
const supportTicketsRouter = require('./routes/support-tickets');
```

- [ ] **Step 2: Register support tickets routes**

Find the app.use statements for other routes and add:

```javascript
app.use('/api/support-tickets', supportTicketsRouter);
```

- [ ] **Step 3: Commit**

```bash
git add backend/server.js
git commit -m "feat: register support ticket routes"
```

---

### Task 4: Add Support Ticket Modals to Farmer HTML

**Files:**
- Modify: `frontend/farmer.html`

**Interfaces:**
- Produces: Support Tickets List modal, Create Ticket modal, Ticket Detail & Chat modal

- [ ] **Step 1: Add Support Tickets List modal**

Find the modals section (near the end of the file, after other modals) and add:

```html
<!-- Support Tickets List Modal -->
<div class="modal fade" id="support-tickets-modal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Support Tickets</h5>
                <button class="modal-close-btn" data-bs-dismiss="modal" aria-label="Close">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm" id="support-tickets-entries" style="width: auto;">
                            <option value="10">10 per page</option>
                            <option value="25">25 per page</option>
                            <option value="50">50 per page</option>
                        </select>
                    </div>
                    <button class="btn ac-btn-primary btn-sm" id="btn-create-support-ticket">
                        <i class="bi bi-plus-lg me-1"></i>Create New Ticket
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="table" id="support-tickets-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Date</th>
                                <th>Last Message</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                <div id="support-tickets-pagination" class="d-flex justify-content-center mt-3"></div>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Add Create Ticket modal**

After the Support Tickets List modal, add:

```html
<!-- Create Support Ticket Modal -->
<div class="modal fade" id="create-support-ticket-modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Create Support Ticket</h5>
                <button class="modal-close-btn" data-bs-dismiss="modal" aria-label="Close">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="create-support-ticket-form">
                    <div class="mb-3">
                        <label class="form-label">Subject <span class="text-danger">*</span></label>
                        <input type="text" class="form-control" id="support-ticket-subject" maxlength="200" required>
                        <small class="text-muted" id="subject-char-count">0/200 characters</small>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Description <span class="text-danger">*</span></label>
                        <textarea class="form-control" id="support-ticket-description" rows="4" maxlength="500" required></textarea>
                        <small class="text-muted" id="description-char-count">0/500 characters</small>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Priority</label>
                        <select class="form-select" id="support-ticket-priority">
                            <option value="low">Low</option>
                            <option value="medium" selected>Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn ac-btn-primary" id="btn-submit-support-ticket">Submit Ticket</button>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Add Ticket Detail & Chat modal**

After the Create Ticket modal, add:

```html
<!-- Ticket Detail & Chat Modal -->
<div class="modal fade" id="ticket-detail-modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Support Ticket</h5>
                <button class="modal-close-btn" data-bs-dismiss="modal" aria-label="Close">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="card mb-3">
                    <div class="card-body">
                        <h6 id="ticket-detail-subject"></h6>
                        <div class="d-flex gap-2 mb-2">
                            <span class="badge" id="ticket-detail-status"></span>
                            <span class="badge" id="ticket-detail-priority"></span>
                        </div>
                        <small class="text-muted">Created: <span id="ticket-detail-created"></span></small>
                    </div>
                </div>
                <div id="ticket-messages-container" style="max-height: 400px; overflow-y: auto;" class="mb-3 p-3 bg-light rounded">
                    <!-- Messages will be loaded here -->
                </div>
                <div class="input-group">
                    <input type="text" class="form-control" id="ticket-message-input" maxlength="500" placeholder="Type your message...">
                    <button class="btn ac-btn-primary" id="btn-send-ticket-message">Send</button>
                </div>
                <small class="text-muted" id="ticket-message-char-count">0/500 characters</small>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 4: Add Support Tickets option to profile dropdown**

Find the profile dropdown menu (search for "My Profile" or "Notifications") and add after Notifications:

```html
<a class="dropdown-item" href="#" id="dropdown-support-tickets">
    <i class="bi bi-ticket-perforated me-2"></i>Support Tickets
</a>
<div class="dropdown-divider"></div>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/farmer.html
git commit -m "feat: add support ticket modals to farmer.html"
```

---

### Task 5: Add Support Ticket Section to Admin HTML

**Files:**
- Modify: `frontend/admin.html`

**Interfaces:**
- Produces: Support Tickets section, Ticket Detail & Chat modal

- [ ] **Step 1: Add Support Tickets sidebar link**

Find the sidebar section (after Subscription Requests) and add:

```html
<li class="nav-item">
    <a class="nav-link collapsed sidebar-link" href="#support-tickets" data-section="support-tickets">
        <i class="bi bi-life-preserver"></i>
        <span>Support Tickets</span>
        <span id="support-tickets-badge" class="sidebar-badge" style="display:none">0</span>
    </a>
</li>
```

- [ ] **Step 2: Add Support Tickets section**

Find the sections area (after Subscription Requests section) and add:

```html
<!-- ════════════════════════════════════════════════════════════════
     § Support Tickets Section
══════════════════════════════════════════════════════════════════ -->
<section id="support-tickets" class="admin-section-card">
    <div class="ac-section-hero ac-section-hero--primary mb-4">
        <div class="ac-section-hero__icon"><i class="bi bi-life-preserver"></i></div>
        <div class="ac-section-hero__body">
            <h4 class="ac-section-hero__title">Support Tickets</h4>
            <p class="ac-section-hero__sub">Manage and respond to farmer support requests.</p>
        </div>
    </div>

    <div class="card">
        <div class="card-body">
            <div class="verification-tabs support-tabs mb-3">
                <button class="tab-btn active" data-status="open">Open</button>
                <button class="tab-btn" data-status="in_progress">In Progress</button>
                <button class="tab-btn" data-status="resolved">Resolved</button>
                <button class="tab-btn" data-status="closed">Closed</button>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex gap-2">
                    <select class="form-select form-select-sm" id="support-tickets-entries" style="width: auto;">
                        <option value="10">10 per page</option>
                        <option value="25">25 per page</option>
                        <option value="50">50 per page</option>
                    </select>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table" id="admin-support-tickets-table">
                    <thead>
                        <tr>
                            <th>Farmer</th>
                            <th>Subject</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Date</th>
                            <th>Last Message</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <div id="admin-support-tickets-pagination" class="d-flex justify-content-center mt-3"></div>
        </div>
    </div>
</section>
```

- [ ] **Step 3: Add Ticket Detail & Chat modal for admin**

Find the modals section and add:

```html
<!-- Admin Ticket Detail & Chat Modal -->
<div class="modal fade" id="admin-ticket-detail-modal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Support Ticket</h5>
                <button class="modal-close-btn" data-bs-dismiss="modal" aria-label="Close">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="card mb-3">
                    <div class="card-body">
                        <h6 id="admin-ticket-detail-subject"></h6>
                        <div class="d-flex gap-2 mb-2">
                            <span class="badge" id="admin-ticket-detail-status"></span>
                            <span class="badge" id="admin-ticket-detail-priority"></span>
                        </div>
                        <div class="d-flex gap-2 align-items-center">
                            <small class="text-muted">Created: <span id="admin-ticket-detail-created"></span></small>
                            <div class="ms-auto">
                                <select class="form-select form-select-sm" id="admin-ticket-status-select" style="width: auto;">
                                    <option value="open">Open</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="admin-ticket-messages-container" style="max-height: 400px; overflow-y: auto;" class="mb-3 p-3 bg-light rounded">
                    <!-- Messages will be loaded here -->
                </div>
                <div class="input-group">
                    <input type="text" class="form-control" id="admin-ticket-message-input" maxlength="500" placeholder="Type your message...">
                    <button class="btn ac-btn-primary" id="btn-admin-send-ticket-message">Send</button>
                </div>
                <small class="text-muted" id="admin-ticket-message-char-count">0/500 characters</small>
            </div>
        </div>
    </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/admin.html
git commit -m "feat: add support ticket section to admin.html"
```

---

### Task 6: Add Support Ticket Methods to Farmer JS

**Files:**
- Modify: `frontend/js/farmer.js`

**Interfaces:**
- Consumes: API endpoints from backend/routes/support-tickets.js
- Produces: Support ticket UI methods, polling, event handlers

- [ ] **Step 1: Add support ticket properties to constructor**

Find the constructor (around line 50) and add:

```javascript
// Support tickets
this.supportTickets = [];
this.supportTicketsCurrentPage = 1;
this.supportTicketsPerPage = 10;
this.supportTicketsTotal = 0;
this.currentTicketId = null;
this.ticketPollInterval = null;
this.ticketPollFailures = 0;
```

- [ ] **Step 2: Add support ticket event listeners**

Find the event listeners section and add:

```javascript
// Support tickets
document.getElementById('dropdown-support-tickets')?.addEventListener('click', (e) => {
    e.preventDefault();
    this.openSupportTicketsModal();
});

document.getElementById('btn-create-support-ticket')?.addEventListener('click', () => {
    this.openCreateTicketModal();
});

document.getElementById('btn-submit-support-ticket')?.addEventListener('click', () => {
    this.submitSupportTicket();
});

document.getElementById('support-ticket-subject')?.addEventListener('input', (e) => {
    document.getElementById('subject-char-count').textContent = `${e.target.value.length}/200 characters`;
});

document.getElementById('support-ticket-description')?.addEventListener('input', (e) => {
    const count = e.target.value.length;
    const counterEl = document.getElementById('description-char-count');
    counterEl.textContent = `${count}/500 characters`;
    counterEl.style.color = count > 450 ? 'red' : '';
});

document.getElementById('support-tickets-entries')?.addEventListener('change', (e) => {
    this.supportTicketsPerPage = parseInt(e.target.value);
    this.supportTicketsCurrentPage = 1;
    this.loadSupportTickets();
});

document.getElementById('btn-send-ticket-message')?.addEventListener('click', () => {
    this.sendTicketMessage();
});

document.getElementById('ticket-message-input')?.addEventListener('input', (e) => {
    const count = e.target.value.length;
    const counterEl = document.getElementById('ticket-message-char-count');
    counterEl.textContent = `${count}/500 characters`;
    counterEl.style.color = count > 450 ? 'red' : '';
});
```

- [ ] **Step 3: Add openSupportTicketsModal method**

```javascript
openSupportTicketsModal() {
    this.supportTicketsCurrentPage = 1;
    this.loadSupportTickets();
    new bootstrap.Modal(document.getElementById('support-tickets-modal')).show();
}
```

- [ ] **Step 4: Add loadSupportTickets method**

```javascript
async loadSupportTickets() {
    try {
        const response = await fetch(`${this.apiBase}/support-tickets/my?page=${this.supportTicketsCurrentPage}&limit=${this.supportTicketsPerPage}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) throw new Error('Failed to load tickets');

        const data = await response.json();
        this.supportTickets = data.tickets;
        this.supportTicketsTotal = data.total;
        this.renderSupportTicketsTable();
        this.renderSupportTicketsPagination();
    } catch (error) {
        console.error('Load support tickets error:', error);
        this.showError('Failed to load support tickets');
    }
}
```

- [ ] **Step 5: Add renderSupportTicketsTable method**

```javascript
renderSupportTicketsTable() {
    const tbody = document.querySelector('#support-tickets-table tbody');
    if (!tbody) return;

    if (this.supportTickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No support tickets yet. Click "Create New Ticket" to get help.</td></tr>';
        return;
    }

    tbody.innerHTML = this.supportTickets.map(ticket => {
        const statusColors = {
            open: 'bg-primary',
            in_progress: 'bg-warning',
            resolved: 'bg-success',
            closed: 'bg-secondary'
        };
        const priorityColors = {
            low: 'bg-info',
            medium: 'bg-warning',
            high: 'bg-danger'
        };

        return `
            <tr>
                <td>${this.escapeHtml(ticket.subject)}</td>
                <td><span class="badge ${statusColors[ticket.status]}">${ticket.status.replace('_', ' ')}</span></td>
                <td><span class="badge ${priorityColors[ticket.priority]}">${ticket.priority}</span></td>
                <td>${new Date(ticket.created_at).toLocaleDateString('en-PH')}</td>
                <td>${ticket.updated_at ? new Date(ticket.updated_at).toLocaleDateString('en-PH') : '—'}</td>
                <td>
                    ${ticket.unread_count > 0 ? '<i class="bi bi-dot text-danger"></i>' : ''}
                    <button class="btn btn-sm btn-outline-primary view-ticket-btn" data-id="${ticket.id}">View</button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.view-ticket-btn').forEach(btn => {
        btn.addEventListener('click', () => this.openTicketDetail(btn.dataset.id));
    });
}
```

- [ ] **Step 6: Add renderSupportTicketsPagination method**

```javascript
renderSupportTicketsPagination() {
    const container = document.getElementById('support-tickets-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.supportTicketsTotal / this.supportTicketsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<nav><ul class="pagination">';
    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === this.supportTicketsCurrentPage ? 'active' : ''}">
            <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>`;
    }
    html += '</ul></nav>';
    container.innerHTML = html;

    container.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            this.supportTicketsCurrentPage = parseInt(e.target.dataset.page);
            this.loadSupportTickets();
        });
    });
}
```

- [ ] **Step 7: Add openCreateTicketModal method**

```javascript
openCreateTicketModal() {
    document.getElementById('create-support-ticket-form').reset();
    document.getElementById('subject-char-count').textContent = '0/200 characters';
    document.getElementById('description-char-count').textContent = '0/500 characters';
    new bootstrap.Modal(document.getElementById('create-support-ticket-modal')).show();
    setTimeout(() => document.getElementById('support-ticket-subject').focus(), 100);
}
```

- [ ] **Step 8: Add submitSupportTicket method**

```javascript
async submitSupportTicket() {
    const subject = document.getElementById('support-ticket-subject').value.trim();
    const description = document.getElementById('support-ticket-description').value.trim();
    const priority = document.getElementById('support-ticket-priority').value;

    if (!subject || !description) {
        this.showError('Subject and description are required');
        return;
    }

    const submitBtn = document.getElementById('btn-submit-support-ticket');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Submitting...';

    try {
        const response = await fetch(`${this.apiBase}/support-tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ subject, description, priority })
        });

        const data = await response.json();
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('create-support-ticket-modal')).hide();
            this.showMessage('Support ticket created successfully', 'success');
            this.loadSupportTickets();
        } else {
            this.showError(data.message || 'Failed to create ticket');
        }
    } catch (error) {
        console.error('Submit ticket error:', error);
        this.showError('Failed to create ticket');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}
```

- [ ] **Step 9: Add openTicketDetail method**

```javascript
async openTicketDetail(ticketId) {
    this.currentTicketId = ticketId;
    this.loadTicketDetail(ticketId);
    new bootstrap.Modal(document.getElementById('ticket-detail-modal')).show();
    this.startTicketPolling();
}
```

- [ ] **Step 10: Add loadTicketDetail method**

```javascript
async loadTicketDetail(ticketId) {
    try {
        const response = await fetch(`${this.apiBase}/support-tickets/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) throw new Error('Failed to load ticket');

        const data = await response.json();
        this.renderTicketDetail(data.ticket, data.messages);
    } catch (error) {
        console.error('Load ticket detail error:', error);
        this.showError('Failed to load ticket');
    }
}
```

- [ ] **Step 11: Add renderTicketDetail method**

```javascript
renderTicketDetail(ticket, messages) {
    document.getElementById('ticket-detail-subject').textContent = ticket.subject;
    
    const statusColors = {
        open: 'bg-primary',
        in_progress: 'bg-warning',
        resolved: 'bg-success',
        closed: 'bg-secondary'
    };
    const priorityColors = {
        low: 'bg-info',
        medium: 'bg-warning',
        high: 'bg-danger'
    };

    const statusEl = document.getElementById('ticket-detail-status');
    statusEl.textContent = ticket.status.replace('_', ' ');
    statusEl.className = `badge ${statusColors[ticket.status]}`;

    const priorityEl = document.getElementById('ticket-detail-priority');
    priorityEl.textContent = ticket.priority;
    priorityEl.className = `badge ${priorityColors[ticket.priority]}`;

    document.getElementById('ticket-detail-created').textContent = new Date(ticket.created_at).toLocaleDateString('en-PH');

    this.renderTicketMessages(messages);
}
```

- [ ] **Step 12: Add renderTicketMessages method**

```javascript
renderTicketMessages(messages) {
    const container = document.getElementById('ticket-messages-container');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No messages yet. Start the conversation.</p>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isOwn = msg.sender_id === this.currentUserId;
        const alignment = isOwn ? 'text-end' : 'text-start';
        const bgColor = isOwn ? 'bg-primary text-white' : 'bg-white';
        const senderName = msg.sender_role === 'admin' ? 'Support admin' : msg.sender_name;

        return `
            <div class="d-flex ${alignment} mb-2">
                <div class="${bgColor} p-2 rounded" style="max-width: 70%;">
                    <small class="d-block text-muted" style="${isOwn ? 'color: rgba(255,255,255,0.7) !important;' : ''}">${senderName}</small>
                    <p class="mb-0">${this.escapeHtml(msg.message)}</p>
                    <small class="d-block" style="${isOwn ? 'color: rgba(255,255,255,0.7) !important;' : 'color: #6c757d;'}">${new Date(msg.created_at).toLocaleString('en-PH')}</small>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}
```

- [ ] **Step 13: Add startTicketPolling method**

```javascript
startTicketPolling() {
    this.stopTicketPolling();
    this.ticketPollFailures = 0;
    this.ticketPollInterval = setInterval(() => {
        this.pollTicketMessages();
    }, 5000);
}
```

- [ ] **Step 14: Add stopTicketPolling method**

```javascript
stopTicketPolling() {
    if (this.ticketPollInterval) {
        clearInterval(this.ticketPollInterval);
        this.ticketPollInterval = null;
    }
}
```

- [ ] **Step 15: Add pollTicketMessages method**

```javascript
async pollTicketMessages() {
    if (!this.currentTicketId) return;

    try {
        const response = await fetch(`${this.apiBase}/support-tickets/${this.currentTicketId}/messages?page=1&limit=50`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) throw new Error('Polling failed');

        const data = await response.json();
        this.renderTicketMessages(data.messages);
        this.ticketPollFailures = 0;
    } catch (error) {
        console.error('Poll ticket messages error:', error);
        this.ticketPollFailures++;
        if (this.ticketPollFailures >= 3) {
            this.stopTicketPolling();
            this.showError('Connection lost. Please refresh to see new messages.');
        }
    }
}
```

- [ ] **Step 16: Add sendTicketMessage method**

```javascript
async sendTicketMessage() {
    const input = document.getElementById('ticket-message-input');
    const message = input.value.trim();
    if (!message) return;

    if (message.length > 500) {
        this.showError('Message exceeds maximum length of 500 characters');
        return;
    }

    const sendBtn = document.getElementById('btn-send-ticket-message');
    const originalText = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';

    try {
        const response = await fetch(`${this.apiBase}/support-tickets/${this.currentTicketId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ message })
        });

        if (response.ok) {
            input.value = '';
            document.getElementById('ticket-message-char-count').textContent = '0/500 characters';
            this.loadTicketDetail(this.currentTicketId);
        } else {
            const data = await response.json();
            this.showError(data.message || 'Failed to send message');
        }
    } catch (error) {
        console.error('Send ticket message error:', error);
        this.showError('Failed to send message');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
    }
}
```

- [ ] **Step 17: Add modal close event listener to stop polling**

Add to the event listeners section:

```javascript
// Stop ticket polling when modal closes
document.getElementById('ticket-detail-modal')?.addEventListener('hidden.bs.modal', () => {
    this.stopTicketPolling();
    this.currentTicketId = null;
});
```

- [ ] **Step 18: Commit**

```bash
git add frontend/js/farmer.js
git commit -m "feat: add support ticket methods to farmer.js"
```

---

### Task 7: Add Support Ticket Methods to Admin JS

**Files:**
- Modify: `frontend/js/admin.js`

**Interfaces:**
- Consumes: API endpoints from backend/routes/support-tickets.js
- Produces: Support ticket UI methods, polling, badge count, event handlers

- [ ] **Step 1: Add support ticket properties to constructor**

Find the constructor and add:

```javascript
// Support tickets
this.supportTickets = [];
this.supportTicketsCurrentPage = 1;
this.supportTicketsPerPage = 10;
this.supportTicketsTotal = 0;
this.supportTicketsCurrentStatus = 'open';
this.currentTicketId = null;
this.ticketPollInterval = null;
this.ticketPollFailures = 0;
```

- [ ] **Step 2: Add support ticket badge loading to init**

Find the init method and add:

```javascript
this.loadSupportTicketsBadge();
```

- [ ] **Step 3: Add support ticket section loading to showSection**

Find the showSection method and add:

```javascript
if (sectionId === 'support-tickets') {
    this.loadSupportTickets('open');
}
```

- [ ] **Step 4: Add section title mapping**

Find the section titles object and add:

```javascript
'support-tickets': 'Support Tickets',
```

- [ ] **Step 5: Add breadcrumb mapping**

Find the breadcrumb labels object and add:

```javascript
'support-tickets': 'Support Tickets',
```

- [ ] **Step 6: Add support ticket event listeners**

Add to the event listeners section:

```javascript
// Support ticket tabs
document.addEventListener('click', (e) => {
    if (e.target.matches('.support-tabs .tab-btn')) {
        document.querySelectorAll('.support-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.loadSupportTickets(e.target.dataset.status);
    }
});

// Support ticket entries per page
document.getElementById('support-tickets-entries')?.addEventListener('change', (e) => {
    this.supportTicketsPerPage = parseInt(e.target.value);
    this.supportTicketsCurrentPage = 1;
    this.loadSupportTickets(this.supportTicketsCurrentStatus);
});

// Admin send ticket message
document.getElementById('btn-admin-send-ticket-message')?.addEventListener('click', () => {
    this.sendAdminTicketMessage();
});

// Admin ticket message input
document.getElementById('admin-ticket-message-input')?.addEventListener('input', (e) => {
    const count = e.target.value.length;
    const counterEl = document.getElementById('admin-ticket-message-char-count');
    counterEl.textContent = `${count}/500 characters`;
    counterEl.style.color = count > 450 ? 'red' : '';
});

// Admin ticket status change
document.getElementById('admin-ticket-status-select')?.addEventListener('change', (e) => {
    this.updateTicketStatus(this.currentTicketId, e.target.value);
});
```

- [ ] **Step 7: Add loadSupportTicketsBadge method**

```javascript
async loadSupportTicketsBadge() {
    try {
        const response = await fetch(`${this.apiBase}/support-tickets?status=open&limit=1`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        const count = data.total || 0;
        const badge = document.getElementById('support-tickets-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    } catch (error) {
        console.error('Load support tickets badge error:', error);
    }
}
```

- [ ] **Step 8: Add loadSupportTickets method**

```javascript
async loadSupportTickets(status = 'open') {
    this.supportTicketsCurrentStatus = status;
    this.supportTicketsCurrentPage = 1;

    try {
        const response = await fetch(`${this.apiBase}/support-tickets?status=${status}&page=${this.supportTicketsCurrentPage}&limit=${this.supportTicketsPerPage}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) throw new Error('Failed to load tickets');

        const data = await response.json();
        this.supportTickets = data.tickets;
        this.supportTicketsTotal = data.total;
        this.renderAdminSupportTicketsTable();
        this.renderAdminSupportTicketsPagination();
    } catch (error) {
        console.error('Load support tickets error:', error);
        this.showError('Failed to load support tickets');
    }
}
```

- [ ] **Step 9: Add renderAdminSupportTicketsTable method**

```javascript
renderAdminSupportTicketsTable() {
    const tbody = document.querySelector('#admin-support-tickets-table tbody');
    if (!tbody) return;

    if (this.supportTickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No support tickets in this status.</td></tr>';
        return;
    }

    tbody.innerHTML = this.supportTickets.map(ticket => {
        const statusColors = {
            open: 'bg-primary',
            in_progress: 'bg-warning',
            resolved: 'bg-success',
            closed: 'bg-secondary'
        };
        const priorityColors = {
            low: 'bg-info',
            medium: 'bg-warning',
            high: 'bg-danger'
        };

        return `
            <tr>
                <td>${this.escapeHtml(ticket.farmer_name || 'Unknown')}</td>
                <td>${this.escapeHtml(ticket.subject)}</td>
                <td><span class="badge ${statusColors[ticket.status]}">${ticket.status.replace('_', ' ')}</span></td>
                <td><span class="badge ${priorityColors[ticket.priority]}">${ticket.priority}</span></td>
                <td>${new Date(ticket.created_at).toLocaleDateString('en-PH')}</td>
                <td>${ticket.updated_at ? new Date(ticket.updated_at).toLocaleDateString('en-PH') : '—'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary view-admin-ticket-btn" data-id="${ticket.id}">View</button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.view-admin-ticket-btn').forEach(btn => {
        btn.addEventListener('click', () => this.openAdminTicketDetail(btn.dataset.id));
    });
}
```

- [ ] **Step 10: Add renderAdminSupportTicketsPagination method**

```javascript
renderAdminSupportTicketsPagination() {
    const container = document.getElementById('admin-support-tickets-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.supportTicketsTotal / this.supportTicketsPerPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<nav><ul class="pagination">';
    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === this.supportTicketsCurrentPage ? 'active' : ''}">
            <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>`;
    }
    html += '</ul></nav>';
    container.innerHTML = html;

    container.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            this.supportTicketsCurrentPage = parseInt(e.target.dataset.page);
            this.loadSupportTickets(this.supportTicketsCurrentStatus);
        });
    });
}
```

- [ ] **Step 11: Add openAdminTicketDetail method**

```javascript
async openAdminTicketDetail(ticketId) {
    this.currentTicketId = ticketId;
    this.loadAdminTicketDetail(ticketId);
    new bootstrap.Modal(document.getElementById('admin-ticket-detail-modal')).show();
    this.startAdminTicketPolling();
}
```

- [ ] **Step 12: Add loadAdminTicketDetail method**

```javascript
async loadAdminTicketDetail(ticketId) {
    try {
        const response = await fetch(`${this.apiBase}/support-tickets/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) throw new Error('Failed to load ticket');

        const data = await response.json();
        this.renderAdminTicketDetail(data.ticket, data.messages);
    } catch (error) {
        console.error('Load ticket detail error:', error);
        this.showError('Failed to load ticket');
    }
}
```

- [ ] **Step 13: Add renderAdminTicketDetail method**

```javascript
renderAdminTicketDetail(ticket, messages) {
    document.getElementById('admin-ticket-detail-subject').textContent = ticket.subject;
    
    const statusColors = {
        open: 'bg-primary',
        in_progress: 'bg-warning',
        resolved: 'bg-success',
        closed: 'bg-secondary'
    };
    const priorityColors = {
        low: 'bg-info',
        medium: 'bg-warning',
        high: 'bg-danger'
    };

    const statusEl = document.getElementById('admin-ticket-detail-status');
    statusEl.textContent = ticket.status.replace('_', ' ');
    statusEl.className = `badge ${statusColors[ticket.status]}`;

    const priorityEl = document.getElementById('admin-ticket-detail-priority');
    priorityEl.textContent = ticket.priority;
    priorityEl.className = `badge ${priorityColors[ticket.priority]}`;

    document.getElementById('admin-ticket-detail-created').textContent = new Date(ticket.created_at).toLocaleDateString('en-PH');
    document.getElementById('admin-ticket-status-select').value = ticket.status;

    this.renderAdminTicketMessages(messages);
}
```

- [ ] **Step 14: Add renderAdminTicketMessages method**

```javascript
renderAdminTicketMessages(messages) {
    const container = document.getElementById('admin-ticket-messages-container');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No messages yet. Start the conversation.</p>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isOwn = msg.sender_id === this.currentUserId;
        const alignment = isOwn ? 'text-end' : 'text-start';
        const bgColor = isOwn ? 'bg-primary text-white' : 'bg-white';
        const senderName = msg.sender_role === 'admin' ? 'Support admin' : msg.sender_name;

        return `
            <div class="d-flex ${alignment} mb-2">
                <div class="${bgColor} p-2 rounded" style="max-width: 70%;">
                    <small class="d-block text-muted" style="${isOwn ? 'color: rgba(255,255,255,0.7) !important;' : ''}">${senderName}</small>
                    <p class="mb-0">${this.escapeHtml(msg.message)}</p>
                    <small class="d-block" style="${isOwn ? 'color: rgba(255,255,255,0.7) !important;' : 'color: #6c757d;'}">${new Date(msg.created_at).toLocaleString('en-PH')}</small>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}
```

- [ ] **Step 15: Add startAdminTicketPolling method**

```javascript
startAdminTicketPolling() {
    this.stopAdminTicketPolling();
    this.ticketPollFailures = 0;
    this.ticketPollInterval = setInterval(() => {
        this.pollAdminTicketMessages();
    }, 5000);
}
```

- [ ] **Step 16: Add stopAdminTicketPolling method**

```javascript
stopAdminTicketPolling() {
    if (this.ticketPollInterval) {
        clearInterval(this.ticketPollInterval);
        this.ticketPollInterval = null;
    }
}
```

- [ ] **Step 17: Add pollAdminTicketMessages method**

```javascript
async pollAdminTicketMessages() {
    if (!this.currentTicketId) return;

    try {
        const response = await fetch(`${this.apiBase}/support-tickets/${this.currentTicketId}/messages?page=1&limit=50`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        if (!response.ok) throw new Error('Polling failed');

        const data = await response.json();
        this.renderAdminTicketMessages(data.messages);
        this.ticketPollFailures = 0;
    } catch (error) {
        console.error('Poll ticket messages error:', error);
        this.ticketPollFailures++;
        if (this.ticketPollFailures >= 3) {
            this.stopAdminTicketPolling();
            this.showError('Connection lost. Please refresh to see new messages.');
        }
    }
}
```

- [ ] **Step 18: Add sendAdminTicketMessage method**

```javascript
async sendAdminTicketMessage() {
    const input = document.getElementById('admin-ticket-message-input');
    const message = input.value.trim();
    if (!message) return;

    if (message.length > 500) {
        this.showError('Message exceeds maximum length of 500 characters');
        return;
    }

    const sendBtn = document.getElementById('btn-admin-send-ticket-message');
    const originalText = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';

    try {
        const response = await fetch(`${this.apiBase}/support-tickets/${this.currentTicketId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ message })
        });

        if (response.ok) {
            input.value = '';
            document.getElementById('admin-ticket-message-char-count').textContent = '0/500 characters';
            this.loadAdminTicketDetail(this.currentTicketId);
        } else {
            const data = await response.json();
            this.showError(data.message || 'Failed to send message');
        }
    } catch (error) {
        console.error('Send ticket message error:', error);
        this.showError('Failed to send message');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
    }
}
```

- [ ] **Step 19: Add updateTicketStatus method**

```javascript
async updateTicketStatus(ticketId, status) {
    if (status === 'closed') {
        if (!confirm('Are you sure you want to close this ticket?')) {
            document.getElementById('admin-ticket-status-select').value = this.supportTickets.find(t => t.id === ticketId)?.status || 'open';
            return;
        }
    }

    try {
        const response = await fetch(`${this.apiBase}/support-tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            this.showToast('Ticket status updated', 'success');
            this.loadAdminTicketDetail(ticketId);
            this.loadSupportTickets(this.supportTicketsCurrentStatus);
            this.loadSupportTicketsBadge();
        } else {
            const data = await response.json();
            this.showError(data.message || 'Failed to update status');
        }
    } catch (error) {
        console.error('Update ticket status error:', error);
        this.showError('Failed to update status');
    }
}
```

- [ ] **Step 20: Add badge polling interval**

Find the init method and add:

```javascript
// Poll support tickets badge every 60s
const loadSupportBadge = () => this.loadSupportTicketsBadge();
loadSupportBadge();
this._supportBadgeInterval = setInterval(loadSupportBadge, 60000);
```

- [ ] **Step 21: Add modal close event listener to stop polling**

Add to the event listeners section:

```javascript
// Stop ticket polling when modal closes
document.getElementById('admin-ticket-detail-modal')?.addEventListener('hidden.bs.modal', () => {
    this.stopAdminTicketPolling();
    this.currentTicketId = null;
});
```

- [ ] **Step 22: Commit**

```bash
git add frontend/js/admin.js
git commit -m "feat: add support ticket methods to admin.js"
```

---

### Task 8: Test Support Ticket System

**Files:**
- Test: Manual testing in browser

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working support ticket system

- [ ] **Step 1: Start backend server**

Run: `node backend/server.js`
Expected: Server starts successfully on port 3000

- [ ] **Step 2: Test farmer creates ticket**

1. Login as farmer
2. Click profile dropdown
3. Click "Support Tickets"
4. Click "Create New Ticket"
5. Fill subject, description, priority
6. Submit
Expected: Ticket created successfully, appears in list

- [ ] **Step 3: Test admin views tickets**

1. Login as admin
2. Click "Support Tickets" in sidebar
3. View ticket list
Expected: All tickets visible with correct status

- [ ] **Step 4: Test admin responds to ticket**

1. Click "View" on a ticket
2. Send message
3. Change status
Expected: Message sent, status updated

- [ ] **Step 5: Test farmer receives response**

1. Login as farmer
2. Open support tickets
3. View ticket
Expected: admin message visible, unread indicator cleared

- [ ] **Step 6: Test polling**

1. Open ticket detail in both farmer and admin
2. Send message from one side
3. Wait 5 seconds
Expected: Message appears on other side automatically

- [ ] **Step 7: Test pagination**

1. Create 15+ tickets
2. Change entries per page
3. Navigate pages
Expected: Pagination works correctly

- [ ] **Step 8: Test validation**

1. Try empty subject/description
2. Try >200 char subject
3. Try >500 char message
Expected: Validation errors shown

- [ ] **Step 9: Test badge count**

1. Create open ticket as farmer
2. Check admin sidebar badge
Expected: Badge shows count

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "test: verify support ticket system functionality"
```

---

## Self-Review

**Spec coverage:**
- ✅ Database tables with constraints and indexes
- ✅ All API endpoints with pagination and auth
- ✅ Farmer UI (modals, profile dropdown, polling)
- ✅ Admin UI (sidebar section, modal, badge polling)
- ✅ Real-time updates with memory leak prevention
- ✅ Notification integration
- ✅ Character limits and validation
- ✅ Pagination and ordering

**Placeholder scan:**
- ✅ No placeholders found
- ✅ All code blocks complete
- ✅ All file paths exact
- ✅ All commands with expected output

**Type consistency:**
- ✅ Status values consistent (open, in_progress, resolved, closed)
- ✅ Priority values consistent (low, medium, high)
- ✅ API endpoint paths consistent
- ✅ Modal IDs consistent
- ✅ Method names consistent
