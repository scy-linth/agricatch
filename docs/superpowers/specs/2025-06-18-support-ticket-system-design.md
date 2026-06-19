# Support Ticket System Design

**Date:** 2025-06-18  
**Status:** Design Approved  
**Related:** Farmer Support, Admin Dashboard

## Overview

A dedicated support ticket system allowing farmers to submit platform issues and admin to respond via threaded conversations. Separate from the existing farmer-customer chat system to maintain clear separation of concerns (platform support vs business communication).

## Database Schema

### support_tickets Table

```sql
CREATE TABLE support_tickets (
  id SERIAL PRIMARY KEY,
  farmer_id INTEGER REFERENCES users(id),
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved, closed
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### support_messages Table

```sql
CREATE TABLE support_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL CHECK (LENGTH(message) <= 500),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

- Index on `support_tickets.farmer_id` for efficient farmer ticket queries
- Index on `support_tickets.status` for filtering by status
- Index on `support_messages.ticket_id` for message thread loading

## Backend API

### New File: `backend/routes/support-tickets.js`

**POST /api/support-tickets**
- Auth: farmer role required
- Body: `{ subject, description, priority }`
- Creates ticket with status='open'
- Returns: `{ ticket_id, status }`

**GET /api/support-tickets**
- Auth: admin/super_admin required
- Query: `?status=open&page=1&limit=10` (status and pagination optional)
- Returns: list with farmer info, status, priority, date, message count, total count
- ORDER BY updated_at DESC

**GET /api/support-tickets/my**
- Auth: farmer role required
- Query: `?page=1&limit=10` (pagination optional)
- Returns: list of farmer's tickets with status, total count
- ORDER BY updated_at DESC

**GET /api/support-tickets/:id**
- Auth: farmer (own tickets) or admin (all)
- Returns: full ticket with messages

**PUT /api/support-tickets/:id**
- Auth: admin/super_admin required
- Body: `{ status }` (open, in_progress, resolved, closed)
- Updates status and updated_at timestamp

**POST /api/support-tickets/:id/messages**
- Auth: farmer (own tickets) or admin (all)
- Body: `{ message }`
- Adds message to support_messages table
- Updates ticket updated_at

**GET /api/support-tickets/:id/messages**
- Auth: farmer (own tickets) or admin (all)
- Query: `?page=1&limit=50` (pagination optional)
- Returns: list of messages with sender info, total count
- ORDER BY created_at ASC

## Frontend Farmer UI

### Access Point
- Add "Support Tickets" option in the top profile dropdown menu
- Icon: bi bi-ticket-perforated
- Located after "Notifications", before "Logout"
- Add divider line before "Logout"

### Modal: Support Tickets List
- Bootstrap modal with `.modal.open` class
- Close button (X icon) in modal header
- Pagination (entries per page dropdown: 10, 25, 50)
- Table columns: Subject, Status, Priority, Date, Last Message, Unread indicator
- Status badges: Open (bg-primary), In Progress (bg-warning), Resolved (bg-success), Closed (bg-secondary)
- Priority badges: Low (bg-info), Medium (bg-warning), High (bg-danger)
- Unread indicator: Dot icon when admin has sent unread messages
- "View" button to open ticket detail
- "Create New Ticket" button (ac-btn-primary style)
- Search/filter by subject (optional)
- Empty state when farmer has no tickets: "No support tickets yet. Click 'Create New Ticket' to get help."
- Loading state during list fetch (spinner overlay)

### Modal: Create Ticket
- Bootstrap modal with `.modal.open` class (consistent with customer-rating-modal)
- `data-bs-backdrop="static"` to prevent accidental close
- Close button (X icon) in modal header
- Fields: Subject (input, required, 1-200 chars), Description (textarea, required, 1-500 chars), Priority (select: Low/Medium/High)
- Character counter below description field: "X/500 characters" (red when >450)
- Submit button (ac-btn-primary) with loading spinner state
- Cancel button (btn-secondary)
- Form validation: check empty fields, max length before submit
- Error handling for API failures with user-friendly messages
- Auto-focus on subject field when modal opens

### Modal: Ticket Detail & Chat
- Bootstrap modal with `.modal.open` class
- `data-bs-backdrop="static"` to prevent accidental close
- Close button (X icon) in modal header
- Shows ticket info at top (subject, status, priority, dates)
- Message thread below (separate UI from customer chat)
- Messages styled with different colors for farmer vs admin
- Unread indicator on messages from admin (not yet read by farmer)
- Mark messages as read when farmer views them
- Timestamps using `toLocaleDateString('en-PH')` format
- Input field at bottom to send message (max 500 chars)
- Character counter below input: "X/500 characters" (red when >450)
- Real-time polling for new messages (every 5 seconds)
- **Critical:** Clear polling interval when modal closes to prevent memory leak
- Polling error handling: stop after 3 consecutive failures, show error message
- Auto-scroll to bottom when new message arrives
- Auto-focus on message input when modal opens
- admin can change status via dropdown
- Loading states for message sending
- Error handling with retry logic for failed sends
- Empty state when no messages exist: "No messages yet. Start the conversation."

### Styling
- Uses existing agricatch-admin.css classes
- Consistent with subscription modal and other modals
- ac-btn-primary for primary actions
- Card-based layout for message thread

## Frontend Admin UI

### Access Point
- Add "Support Tickets" as a new sidebar section
- Icon: bi bi-life-preserver (or bi bi-headset)
- Located after "Subscription Requests", before "People" section
- Badge showing count of open tickets

### Section: Support Tickets
- Uses `.admin-section-card` class
- Hero section with icon (bi bi-life-preserver) and title (ac-section-hero style)
- Tab navigation: Open, In Progress, Resolved, Closed (verification-tabs class)
- Pagination (entries per page dropdown: 10, 25, 50)
- Table columns: Farmer, Subject, Status, Priority, Date, Last Message, Actions
- Status badges same as farmer UI
- Priority badges same as farmer UI
- "View" button to open ticket detail modal
- Badge count in sidebar for open tickets
- Search/filter by farmer name or subject (optional)
- Loading state during list fetch (spinner overlay)
- Empty state when no tickets exist: "No support tickets in this status."

### Modal: Ticket Detail & Chat
- Same modal structure as farmer but with admin controls
- `data-bs-backdrop="static"` to prevent accidental close
- Close button (X icon) in modal header
- Shows ticket info at top
- Message thread below
- Status dropdown (admin can change status) with confirmation before closing
- Input field to send message (max 500 chars)
- Character counter below input: "X/500 characters" (red when >450)
- Real-time polling for new messages (every 5 seconds)
- **Critical:** Clear polling interval when modal closes to prevent memory leak
- Polling error handling: stop after 3 consecutive failures, show error message
- Auto-scroll to bottom when new message arrives
- Auto-focus on message input when modal opens
- Loading states for message sending
- Error handling with retry logic

### Additional Features
- Badge count polling every 60s
- Filter by status via tabs
- Search/filter functionality (optional future enhancement)

### Styling
- Consistent with verification-requests and subscription-requests sections
- Uses existing agricatch-admin.css classes
- ac-section-hero for header
- verification-tabs for status tabs
- Table styling consistent with other admin tables

## Implementation Notes

### Database Migration
- Add table creation to `database/create_missing_tables.js`
- Run migration script to create tables

### Backend Integration
- Create new route file `backend/routes/support-tickets.js`
- Register routes in `backend/server.js`:
  ```javascript
  const supportTicketsRouter = require('./routes/support-tickets');
  app.use('/api/support-tickets', supportTicketsRouter);
  ```

### Frontend Integration
- Add modals to `farmer.html` and `admin.html`
- Add support ticket methods to `farmer.js` and `admin.js`
- Add profile dropdown option in farmer.html
- Add sidebar section in admin.html

### Real-time Updates
- Implement polling for new messages (every 5 seconds, similar to existing chat)
- **Critical:** Store polling interval reference and clear on modal close
- Implement polling error handling with exponential backoff or stop after 3 failures
- Implement badge count polling for admin sidebar (every 60 seconds)
- Mark messages as read when farmer opens ticket detail modal
- Insert notification into `notifications` table when admin sends message to farmer
- Broadcast notification event for real-time updates

## Design Decisions

### Separate System vs Reusing Chat
**Decision:** Separate ticket system with dedicated tables
**Rationale:**
- Industry standard (Shopify, Amazon, Stripe all separate support from messaging)
- Clear separation: platform support vs business communication
- Different workflows (status tracking, priority) vs conversational chat
- Cleaner UX for farmers (support issues separate from customer conversations)

### Farmer Access
**Decision:** Profile dropdown access
**Rationale:**
- Less prominent than sidebar section (support is occasional, not primary)
- Consistent with Notifications placement
- Easy to access when needed

### admin Access
**Decision:** Dedicated sidebar section
**Rationale:**
- admin need frequent access to manage tickets
- Consistent with Verification Requests, Subscription Requests
- Badge count provides visibility of pending tickets

### All admin Can Respond
**Decision:** No ticket assignment
**Rationale:**
- Simpler implementation
- Faster response times (any available admin can pick up)
- Appropriate for small-to-medium teams
- Can add assignment later if needed

## Future Enhancements

- Ticket assignment to specific admin members
- File attachments for tickets
- Ticket categories/labels
- SLA tracking (response time metrics)
- Email notifications for ticket updates
- Bulk actions (close multiple tickets)
- Ticket analytics dashboard
- "Reopen" button for farmers on closed tickets
- Rich text editor for messages
