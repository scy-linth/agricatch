# AgriCatch AI Project Handbook
Version: 2.0 Enterprise
Status: Active

==============================================================================
AI ONBOARDING
==============================================================================

Before starting work:

1. Read AGENTS.md.
2. Read .windsurfrules.
3. Inspect the repository.
4. Verify assumptions using the implementation.
5. Begin work.

Repository evidence is always the source of truth.

==============================================================================
PROJECT OVERVIEW
==============================================================================

AgriCatch is a production-ready agricultural e-commerce platform that
connects customers directly with verified farmers.

The platform supports both Available Now and Hybrid Pre-order products,
while maintaining a secure, scalable, and maintainable architecture.

Primary goals:

- Connect customers with farmers
- Support agricultural commerce
- Maintain production-quality code
- Preserve architecture consistency
- Protect existing business workflows

==============================================================================
TECH STACK
==============================================================================

Frontend

- HTML
- CSS
- JavaScript

Backend

- Node.js
- Express.js

Database

- PostgreSQL (Supabase)

Storage

- Cloudinary

Deployment

- Frontend: Vercel
- Backend: Render

Development Tooling

- Context7
- Chrome DevTools MCP
- Browser MCP
- Playwright
- Superpowers

==============================================================================
SYSTEM ARCHITECTURE
==============================================================================

Frontend

Responsible for:

- User Interface
- Client Validation
- State Management
- API Communication

Backend

Responsible for:

- Business Logic
- Authentication
- Authorization
- Validation
- API Endpoints
- Database Operations

Database

Responsible for:

- Data Integrity
- Constraints
- Relationships
- Persistent Storage

Business logic belongs in the backend whenever applicable.

==============================================================================
PRIMARY USER ROLES
==============================================================================

Customer

- Browse products
- Wishlist
- Cart
- Checkout
- Orders
- Reviews
- Messaging
- Notifications

Farmer

- Product Management
- Hybrid Pre-order
- Inventory
- Analytics
- Orders
- Messaging

Admin

- Product Approval
- Farmer Verification
- Subscription Approval
- User Management
- Reports

Super Admin

- Platform Settings
- System Maintenance
- Full Administrative Control

==============================================================================
CORE MODULES
==============================================================================

Authentication

Authorization

Products

Categories

Wishlist

Cart

Checkout

Orders

Hybrid Pre-order

Inventory

Addresses

Messaging

Notifications

Reviews

Subscriptions

Analytics

Reports

Platform Settings

==============================================================================
PROTECTED MODULES
==============================================================================

The following modules are considered core architecture.

Do not redesign without explicit approval.

- Authentication
- Authorization
- Hybrid Pre-order
- Wishlist
- Cart
- Checkout
- Orders
- Messaging
- Notifications
- Farmer Dashboard
- Admin Dashboard
- Platform Settings

==============================================================================
HYBRID PRE-ORDER
==============================================================================

Hybrid Pre-order is a protected business workflow.

Protect:

- reservation logic
- inventory synchronization
- checkout validation
- farmer workflow
- admin workflow
- customer workflow

Avoid architectural redesigns.

==============================================================================
APPROVAL WORKFLOWS
==============================================================================

Several workflows depend on administrative approval.

Examples:

- Farmer Verification
- Product Approval
- Subscription Approval

Inspect approval status before debugging.

==============================================================================
FEATURE FLAGS & PLATFORM SETTINGS
==============================================================================

Some system behavior is controlled through:

- Feature Flags
- Platform Settings

Always inspect configuration before assuming defects.

==============================================================================
AUTHENTICATION
==============================================================================

Authentication uses JWT.

Authorization is role-based.

Never bypass permission boundaries.

Prefer existing accounts for testing.

==============================================================================
DATABASE
==============================================================================

Database Provider:

PostgreSQL (Supabase)

Guidelines:

- Prefer additive schema changes
- Preserve backwards compatibility
- Avoid destructive migrations
- Protect production data

==============================================================================
DEPLOYMENT
==============================================================================

Production Environment

Frontend

Vercel

Backend

Render

Database

Supabase

Storage

Cloudinary

Always maintain production compatibility.

==============================================================================
TESTING STRATEGY
==============================================================================

Preferred verification order:

1. Chrome DevTools MCP
2. Browser MCP
3. Existing automated tests
4. Playwright
5. Manual reasoning

Use Context7 whenever official documentation is required.

==============================================================================
COMMON DEBUGGING CHECKLIST
==============================================================================

Before assuming a bug, verify:

- Configuration
- Environment Variables
- Feature Flags
- Platform Settings
- User Role
- Account Status
- Approval Status
- Browser Console
- Network Requests
- Backend Logs
- Database Constraints

==============================================================================
PROJECT PRINCIPLES
==============================================================================

Prefer:

- Reuse
- Maintainability
- Consistency
- Simplicity
- Backwards Compatibility

Avoid:

- Duplicate Implementations
- Unnecessary Files
- Unnecessary Refactors
- Breaking Existing Workflows

==============================================================================
AI COMPLETION STANDARD
==============================================================================

A task should only be considered complete when:

- Requested functionality works
- Existing functionality remains intact
- No obvious regressions exist
- Architecture remains consistent
- Verification has been completed
- Code is production-ready

==============================================================================
END
==============================================================================