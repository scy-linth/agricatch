# AgriCatch Architecture
Version: 2.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document defines the technical architecture of AgriCatch based on the
actual repository implementation.

Repository implementation is the source of truth.

==============================================================================
SYSTEM OVERVIEW
==============================================================================

AgriCatch is a production-ready agricultural e-commerce platform connecting
customers with verified farmers.

Architecture Layers:

Client (Frontend)
        ↓
REST API (Backend)
        ↓
Business Logic
        ↓
PostgreSQL (Supabase)
        ↓
Cloudinary Storage

==============================================================================
TECH STACK
==============================================================================

Frontend
- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Bootstrap 5.3.3
- Bootstrap Icons 1.11.3
- Font Awesome 6.5.2
- Simple DataTables

Backend
- Node.js
- Express.js 4.18.2
- JWT (jsonwebtoken 9.0.2)
- bcryptjs 2.4.3
- Multer 1.4.5-lts.1
- express-rate-limit 8.5.2
- node-cron 4.5.0
- nodemailer 6.10.1
- resend 3.5.0

Database
- PostgreSQL (Supabase)
- pg 8.11.3

Storage
- Cloudinary 2.9.0

Deployment
- Frontend: Vercel
- Backend: Render

Development
- Nodemon 3.0.2
- Playwright 1.60.0

==============================================================================
BACKEND ARCHITECTURE
==============================================================================

Entry Point
- backend/server.js

Routes (backend/routes/)
- auth.js - Authentication, registration, password reset
- products.js - Product CRUD, approval workflow
- orders.js - Order management, status transitions
- cart.js - Shopping cart operations
- wishlist.js - Wishlist management
- reviews.js - Product reviews
- notifications.js - User notifications
- messages.js - Messaging system
- addresses.js - User address management
- admin.js - Admin operations
- superadmin.js - Super admin operations
- farmers.js - Farmer-specific operations
- subscriptions.js - Subscription management
- support-tickets.js - Support ticket system
- psgc.js - PSGC location data
- upload.js - File upload handling
- contact.js - Contact form
- otp.js - OTP verification
- activityMonitor.js - Activity monitoring
- settings.js - Platform settings
- payment-accounts.js - Payment account management
- health.js - Health check endpoint
- debug.js - Debug utilities

Middleware (backend/middleware/)
- authenticateToken.js - JWT authentication
- requireRole.js - Role-based authorization
- featureFlags.js - Feature flag management
- logActivity.js - Activity logging
- upload.js - File upload configuration

Utilities (backend/utils/)
- db.js - Database connection and platform settings
- cloudinary.js - Cloudinary integration
- emailService.js - Email sending (Resend, Nodemailer)
- auditLog.js - Admin audit logging
- adminCache.js - Admin data caching
- fileUtils.js - File operations
- orderBusinessLogic.js - Order business rules
- orderTransitions.js - Order status transition matrix
- realtime.js - Server-sent events
- recaptcha.js - reCAPTCHA verification

Services (backend/services/)
- activityLogger.js - Activity logging service
- browserParser.js - Browser detection
- ipGeolocation.js - IP geolocation

==============================================================================
FRONTEND ARCHITECTURE
==============================================================================

Pages (frontend/)
- index.html - Customer landing page
- admin.html - Admin dashboard
- farmer.html - Farmer dashboard
- checkout.html - Checkout flow
- orders.html - Customer orders
- wishlist.html - Customer wishlist
- chat.html - Messaging interface
- customer-account.html - Customer account management
- notifications.html - Notifications page
- request-product.html - Product request form
- product.html - Product details
- farmers.html - Farmers listing
- 404.html - Error page
- admin-backup.html - Admin backup

JavaScript (frontend/js/)
- app.js - Main customer application logic
- admin.js - Admin dashboard logic
- farmer.js - Farmer dashboard logic
- checkout.js - Checkout logic
- orders.js - Orders management
- wishlist.js - Wishlist management
- chat.js - Messaging logic
- customer-account.js - Customer account logic
- addresses.js - Address management
- admin-charts.js - Admin charts
- notifications-page.js - Notifications logic
- product.js - Product details logic
- psgc.js - PSGC location data
- support-ticket-chat.js - Support ticket chat
- format.js - Formatting utilities
- nicemain.js - NiceAdmin base logic
- farmers.js - Farmers listing logic
- config.js - Configuration

CSS (frontend/css/)
- styles.css - Main customer styles
- nicemain.css - NiceAdmin base template
- agricatch-admin.css - Admin/farmer dashboard overrides
- admin.css - Admin-specific styles

==============================================================================
DATABASE ARCHITECTURE
==============================================================================

Core Tables
- users - User accounts and profiles
- categories - Product categories
- products - Product listings
- cart - Shopping cart
- orders - Per-item orders
- order_items - Order line items
- reviews - Product reviews
- customer_ratings - Farmer ratings of customers
- wishlist - Customer wishlist
- notifications - User notifications
- conversations - Chat conversations
- messages - Chat messages
- user_addresses - User delivery addresses

Authentication Tables
- otps - OTP verification
- password_resets - Password reset tokens

Admin Tables
- admin_audit_logs - Admin action audit trail
- activity_logs - User activity logs
- activity_monitor_settings - Activity monitoring configuration
- announcements - Platform announcements
- feature_flags - Feature flag management
- platform_settings - Platform configuration
- settings - Legacy settings table

Business Tables
- farmer_subscriptions - Farmer subscription tiers
- payment_accounts - Payment account management
- featured_products - Featured product management

==============================================================================
AUTHENTICATION & AUTHORIZATION
==============================================================================

Authentication
- JWT-based authentication
- Token stored in localStorage
- Token includes: id, role, email, username
- Password hashing with bcryptjs
- OTP-based verification for login
- Password reset via OTP

Authorization
- Role-based access control (RBAC)
- Roles: customer, farmer, admin, super_admin
- Middleware: authenticateToken, requireRole
- Account disable functionality
- Maintenance mode (blocks non-super_admin)

==============================================================================
ORDER STATUS WORKFLOW
==============================================================================

Valid Statuses
- pending - Initial order state
- preorder_reserved - Pre-order reservation
- confirmed - Order confirmed
- preparing - Order being prepared
- scheduled - Order scheduled for delivery
- out_for_delivery - Order in transit
- delivered - Order delivered
- completed - Order completed
- cancelled - Order cancelled

Transition Matrix
- pending → confirmed, cancelled
- preorder_reserved → confirmed, cancelled
- confirmed → preparing, cancelled
- preparing → scheduled, cancelled
- scheduled → out_for_delivery, cancelled
- out_for_delivery → delivered, cancelled
- delivered → completed
- completed → (terminal)
- cancelled → (terminal)

Cancellation Rules by Role
- customer: pending, preorder_reserved
- farmer: pending, confirmed, preparing
- admin/super_admin: all except delivered, completed, cancelled

==============================================================================
CORS CONFIGURATION
==============================================================================

Production Origins
- https://agricatch.store
- https://www.agricatch.store
- https://agricatch.onrender.com
- https://api.agricatch.store
- https://agricatch.page.dev

Development Origins
- http://localhost:3000
- http://127.0.0.1:3000
- http://localhost:7242
- http://127.0.0.1:7242
- http://localhost:5173
- http://127.0.0.1:5173

Trusted agricatch domains allow HTTPS-only access.

==============================================================================
RATE LIMITING
==============================================================================

Dynamic rate limits controlled by platform settings:
- auth_rate_limit_local (default: 100)
- auth_rate_limit_production (default: 20)
- otp_rate_limit_local (default: 50)
- otp_rate_limit_production (default: 10)

Window: 15 minutes
Key generator: IP-based

==============================================================================
FEATURE FLAGS
==============================================================================

Managed via feature_flags table:
- price_drop_alerts - Notify wishlist price drops
- platform_announce - Platform-wide announcements
- maintenance_mode - Maintenance mode
- allow_registrations - New user registrations
- require_product_approval - Product approval workflow

==============================================================================
PROTECTED ARCHITECTURE
==============================================================================

The following modules are considered core architecture.

Do not redesign without explicit approval.

- Authentication (JWT, OTP)
- Authorization (RBAC)
- Order Status Transitions (orderTransitions.js)
- Order Business Logic (orderBusinessLogic.js)
- Hybrid Pre-order
- Cart
- Checkout
- Messaging
- Notifications
- Platform Settings

==============================================================================
PSGC API INTEGRATION
==============================================================================

Purpose: Provide Philippine geographic location data for addresses

Route: /api/psgc
Route File: backend/routes/psgc.js

Endpoints:
- GET /api/psgc/provinces?zone=<zone> - Get provinces by zone (metro, northluzon, southluzon)
- GET /api/psgc/cities?zone=<zone> - Get cities/municipalities by zone

Frontend Integration:
- File: frontend/js/psgc.js
- API Base URL Resolution:
  - Production (agricatch.store, www.agricatch.store): https://agricatch.onrender.com/api/psgc
  - Other environments: /api/psgc

Usage:
- Address forms in registration and checkout
- City and province dropdowns
- PSGC code storage for delivery addresses

==============================================================================
API BASE URL RESOLUTION
==============================================================================

Frontend API base URL logic:
- Custom frontend hosts (agricatch.store): https://agricatch.onrender.com/api
- Render host (agricatch.onrender.com): /api
- Local development: http://localhost:3000/api

==============================================================================
TESTING STRATEGY
==============================================================================

Preferred verification order:

1. Chrome DevTools MCP
2. Browser MCP
3. Existing Tests
4. Playwright
5. Manual Verification

Test Location: tests/
Test Helpers: tests/helpers/

==============================================================================
ARCHITECTURE PRINCIPLES
==============================================================================

Prefer:

- Reuse existing modules
- Maintainability
- Consistency
- Simplicity
- Separation of Concerns
- Business logic in backend
- Additive schema changes
- Backward compatibility

Avoid:

- Duplicate implementations
- Tight coupling
- Breaking existing workflows
- Unnecessary refactoring
- Business logic in frontend
- Destructive migrations

==============================================================================
END
==============================================================================