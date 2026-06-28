# AgriCatch Business Rules
Version: 2.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document documents the actual business rules in AgriCatch based on the
repository implementation.

Repository implementation is the source of truth.

==============================================================================
GENERAL PRINCIPLES
==============================================================================

- Business logic belongs in the backend
- Frontend performs presentation and validation only
- Backend is the source of truth
- Never bypass approval workflows
- Never bypass authorization rules
- Maintain data integrity across all operations

==============================================================================
USER ROLES
==============================================================================

Roles
- customer - Basic purchasing access
- farmer - Product and order management
- admin - User and product approval
- super_admin - Full platform access

Role Hierarchy
- super_admin > admin > farmer > customer

==============================================================================
CUSTOMER RULES
==============================================================================

Customers can:
- Register with username, email, password
- Login with email, password, and optional OTP
- Browse products (approved and available only)
- Search and filter products
- Add products to wishlist
- Add products to cart (guest or logged-in)
- Checkout with delivery address
- Track orders
- Cancel orders in pending or preorder_reserved status
- Receive notifications
- Message farmers
- Submit reviews for delivered orders
- Manage delivery addresses
- Update profile
- Change password

Customers cannot:
- Purchase unapproved products (status != approved)
- Purchase unavailable products (is_available = false)
- Review undelivered orders
- Modify completed or cancelled orders
- Access administrative features
- Approve products
- Verify farmers

==============================================================================
FARMER RULES
==============================================================================

Farmers can:
- Create products with status 'pending' and is_available=false
- Update their own products
- Delete their own products
- Toggle product availability
- Manage inventory (stock_quantity)
- Create pre-order products
- View customer orders
- Update order status (pending → confirmed → preparing → scheduled)
- Cancel orders in pending, confirmed, or preparing status
- View analytics (sales, revenue, ratings)
- Respond to customer messages
- Rate customers on delivered orders
- Manage shop profile (shop_name, shop_description, shop_banner_url, shop_avatar_url)
- Subscribe to subscription tiers
- Manage payment accounts

Farmers cannot:
- Approve their own products
- Verify their own accounts
- Access admin modules
- Cancel orders in out_for_delivery, delivered, or completed status
- Access super admin features

==============================================================================
ADMIN RULES
==============================================================================

Admins can:
- View all users
- Create users
- Verify farmers
- Unverify farmers
- Approve products (set status to approved)
- Reject products (set status to rejected)
- View all products
- View all orders
- Update any order status (except delivered, completed, cancelled)
- Cancel any order (except delivered, completed, cancelled)
- Manage categories (create, update, delete, disable)
- View admin audit logs
- View activity logs
- Manage support tickets

Admins cannot:
- Bypass super admin permissions
- Modify protected platform configuration
- Access super admin settings
- Disable super admin accounts

==============================================================================
SUPER ADMIN RULES
==============================================================================

Super Admin has full platform access.

Super Admin can:
- All admin capabilities
- Modify platform settings
- Manage feature flags
- Disable any user account
- Access activity monitor settings
- Full system maintenance

==============================================================================
PRODUCT RULES
==============================================================================

Product Creation
- Must belong to a valid category
- Must have valid pricing (DECIMAL(10,2))
- Must have unit (default: kg)
- New products start with status='pending' and is_available=false
- Name fields limited to 40 characters (shop_name, first_name, middle_name, last_name)

Product Approval Workflow
- Products require admin approval before customer visibility
- Status values: pending, approved, rejected
- Admin can approve or reject pending products
- Approved products are visible to customers
- Rejected products are not visible

Product Availability
- is_available controls customer visibility
- is_admin_disabled for admin-controlled disabling
- Admin-disabled products are not visible
- Disabled at timestamp tracks when disabled

Product Inventory
- stock_quantity tracks available stock
- reserved_quantity tracks pre-order reservations
- stock_quantity restored on order cancellation
- reserved_quantity released on pre-order cancellation

Product Deletion
- Soft delete via is_disabled
- disabled_at timestamp
- disabled_reason for audit trail

==============================================================================
HYBRID PRE-ORDER RULES
==============================================================================

Pre-order Fields
- is_preorder: Boolean flag
- preorder_availability_date: When product becomes available
- reserved_quantity: Quantity reserved by pre-orders
- max_preorder_quantity: Maximum pre-order limit
- preorder_converted_at: When pre-order converted to regular order
- preorder_fulfilled_quantity: Quantity fulfilled after conversion
- preorder_reserved_quantity: Quantity reserved for this order

Pre-order Workflow
- Customer places pre-order (status: preorder_reserved)
- Inventory: reserved_quantity incremented
- On availability date: preorder_converted_at set
- After conversion: preorder_fulfilled_quantity tracked
- On cancellation: reserved_quantity released

Protected Architecture
- Reservation workflow must remain intact
- Inventory synchronization must remain accurate
- Checkout validation must remain consistent
- Customer, Farmer, and Admin workflows must remain compatible

Do not redesign without explicit approval.

==============================================================================
ORDER RULES
==============================================================================

Order Status Workflow
- pending → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
- preorder_reserved → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
- Any status → cancelled (with role-based restrictions)

Cancellation Rules by Role
- customer: pending, preorder_reserved
- farmer: pending, confirmed, preparing
- admin/super_admin: all except delivered, completed, cancelled

Order Business Logic (orderBusinessLogic.js)
- restoreInventoryOnCancel: Restores stock on cancellation
  - Regular orders: restores stock_quantity
  - Pre-orders (not converted): releases reserved_quantity
  - Pre-orders (converted): restores preorder_fulfilled_quantity
- updateStatisticsOnDeliver: Updates statistics on delivery
  - products.sales_count incremented
  - users.total_sales incremented
  - users.total_revenue incremented

Order Transition Matrix (orderTransitions.js)
- Single source of truth for status transitions
- Role-based cancellation permissions
- Terminal states: completed, cancelled

Order History
- Never silently modify order history
- cancelled_at timestamp
- cancellation_reason stored
- cancelled_by stored

==============================================================================
WISHLIST RULES
==============================================================================

Wishlist is customer-specific.

Rules:
- Users manage only their own wishlist
- Wishlist does not affect inventory
- Wishlist does not reserve products
- Price drop alerts notify wishlist users (if feature flag enabled)

==============================================================================
CART RULES
==============================================================================

Cart supports guest and logged-in users.

Guest Cart
- Uses session_id for identification
- Migrated to user cart on login

User Cart
- Uses user_id for identification
- Merged with guest cart on login

Cart Items
- Track product_id, quantity
- is_preorder flag for pre-order items
- Added_at timestamp

==============================================================================
MESSAGING RULES==============================================================================

Messaging is role-aware.

Conversations
- Unique per farmer-customer pair
- conversation_id generated
- last_message_at timestamp

Messages
- sender_id and receiver_id
- is_read flag
- product_id optional reference

Users may communicate only through authorized conversations.

==============================================================================
NOTIFICATION RULES
==============================================================================

Notifications must:
- Be user-specific
- Reflect meaningful events
- Never expose private information

Notification Types
- Order status changes
- Product approval/rejection
- Price drops (if feature flag enabled)
- Platform announcements (if feature flag enabled)

==============================================================================
REVIEW RULES
==============================================================================

Product Reviews
- Only for delivered orders
- One review per product per user
- Rating: 1-5 stars
- Comment optional

Customer Ratings
- Farmers rate customers on delivered orders
- One rating per order per farmer
- Rating: 1-5 stars
- Affects customer_total_ratings and customer_average_rating

==============================================================================
ADDRESS RULES
==============================================================================

User Addresses
- Multiple addresses per user
- is_default flag for primary address
- Name fields limited to 40 characters
- PSGC location fields (city, province)

Address Fields
- label (e.g., Home, Office)
- full_name, first_name, middle_name, last_name
- phone
- address_line1, address_line2
- city, province, postal_code

==============================================================================
FEATURE FLAGS
==============================================================================

Feature flags control platform behavior:

price_drop_alerts
- Notify wishlist users when wishlist products drop in price

platform_announce
- Display platform-wide announcements

maintenance_mode
- Block non-super_admin access
- Display maintenance message

allow_registrations
- Enable/disable new user registrations

require_product_approval
- Enable/disable product approval workflow
- When disabled: products auto-approved

==============================================================================
SUPPORT TICKETS
==============================================================================

Purpose: Customer and farmer support cases with admin response

Tables
- support_tickets - Support ticket records
- support_messages - Ticket chat messages

Workflow
- Customer/farmer creates support ticket with subject
- Admin responds via support messages
- Ticket status: open, in_progress, resolved, closed
- Priority levels: low, normal, high, urgent

Rules
- Any authenticated user can create support tickets
- Admin can view and respond to all tickets
- Ticket creator can view their own tickets
- Admin responses trigger notifications to ticket owner
- Support ticket chat is separate from marketplace chat

==============================================================================
RATE LIMITING
==============================================================================

Dynamic rate limits controlled by platform settings:

auth_rate_limit_local
- Default: 100 requests per 15 minutes
- Applied to localhost

auth_rate_limit_production
- Default: 20 requests per 15 minutes
- Applied to production

otp_rate_limit_local
- Default: 50 requests per 15 minutes
- Applied to localhost

otp_rate_limit_production
- Default: 10 requests per 15 minutes
- Applied to production

Key generator: IP-based

==============================================================================
SECURITY RULES
==============================================================================

Never:
- Expose credentials
- Expose tokens
- Bypass authorization
- Trust client-side validation alone

Always:
- Validate server-side
- Hash passwords with bcryptjs
- Use JWT for authentication
- Enforce role-based access control
- Log admin actions in admin_audit_logs

==============================================================================
DATA INTEGRITY
==============================================================================

Maintain:
- Referential integrity via foreign keys
- Inventory accuracy
- Order consistency
- User ownership
- Approval integrity
- Transaction consistency for multi-step operations

==============================================================================
END
==============================================================================