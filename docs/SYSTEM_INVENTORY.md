# AgriCatch System Inventory

**Purpose:** Technical inventory and discovery document for the AgriCatch codebase.

This document provides a detailed read-only inventory of the system architecture, including file locations, dependencies, and implementation details. It serves as a technical reference for understanding the codebase structure.

**Note:** For primary documentation on business rules, architecture, database schema, and APIs, refer to the dedicated documentation files in the docs/ directory. This inventory complements those documents with implementation-specific details.

# 1. User Roles

## Guest

- **Pages**
  - `D:/Codings/AgriCatch/frontend/index.html:45-210`
  - `D:/Codings/AgriCatch/frontend/product.html:41-71`
  - `D:/Codings/AgriCatch/frontend/farmers.html:1`
  - `D:/Codings/AgriCatch/frontend/chat.html:1`
  - `D:/Codings/AgriCatch/frontend/checkout.html:526-543`
  - `D:/Codings/AgriCatch/frontend/404.html:1`

- **Features**
  - Browse landing page sections: Home, Featured, Products, About, Contact.
  - Browse/search/filter products.
  - View product details and farmer/shop details.
  - Guest cart supported by `session_id`.
  - Login/register via auth modal.

- **Permissions**
  - Can read public product/category/farmer data.
  - Can use guest cart.
  - Cannot place order without authentication.
  - Cannot use wishlist, reviews, orders, notifications, or chat without login.

- **Actions**
  - Search products.
  - Filter by category/preorder/availability.
  - Add available products to cart as guest.
  - Register as customer/farmer.
  - Login.

## Customer

- **Pages**
  - `D:/Codings/AgriCatch/frontend/index.html:45-417`
  - `D:/Codings/AgriCatch/frontend/customer-account.html:640-1058`
  - `D:/Codings/AgriCatch/frontend/orders.html:526-772`
  - `D:/Codings/AgriCatch/frontend/checkout.html:526-543`
  - `D:/Codings/AgriCatch/frontend/wishlist.html:33-59`
  - `D:/Codings/AgriCatch/frontend/notifications.html:1`
  - `D:/Codings/AgriCatch/frontend/chat.html:1`
  - `D:/Codings/AgriCatch/frontend/product.html:41-71`

- **Features**
  - Customer profile, edit profile, password change.
  - Verification request UI exists in customer account.
  - Orders page with status tabs.
  - Checkout with delivery info and payment summary.
  - Wishlist.
  - Notifications dropdown/page.
  - Customer-to-farmer chat.
  - Support tickets.
  - Product reviews after delivery.

- **Permissions**
  - Can place orders.
  - Can rate products only after delivered order.
  - Can chat only with farmers.
  - Can create support tickets.
  - Cannot manage products/admin data.
  - Superadmin is explicitly blocked from cart/order flows; customers are allowed.

- **Actions**
  - Add/update/remove cart items.
  - Checkout and create orders.
  - Cancel eligible orders.
  - Mark notifications read.
  - Send/read chat messages.
  - Submit product review.
  - Create support ticket.

## Farmer

- **Pages**
  - `D:/Codings/AgriCatch/frontend/farmer.html:826-876`
  - `D:/Codings/AgriCatch/frontend/request-product.html:11-36`
  - `D:/Codings/AgriCatch/frontend/chat.html:1`
  - `D:/Codings/AgriCatch/frontend/notifications.html:1`

- **Features**
  - Farmer dashboard.
  - Product management.
  - Product approval tracking.
  - Order management.
  - Customer messages.
  - Notifications.
  - Reviews.
  - Subscription management.
  - Shop profile.
  - Profile management.
  - Verification/subscription workflows.

- **Permissions**
  - Can create/edit own products.
  - New farmer-created products use approval workflow.
  - Can only update orders for their own products.
  - Can chat with customers and admin.
  - Can rate customers after delivered orders.
  - Premium tier unlocks custom product-name requests and advanced analytics constraints are enforced in farmer metrics.

- **Actions**
  - Add products.
  - Submit catalog/product name requests.
  - Update product availability/stock/preorder fields.
  - Confirm/prepare/dispatch/deliver/cancel orders.
  - Request premium subscription.
  - Upload shop images/product images/verification documents.
  - Reply in chat.
  - Submit support tickets.

## Admin

- **Pages**
  - `D:/Codings/AgriCatch/frontend/admin.html:165-363`

- **Features**
  - Dashboard overview.
  - Orders.
  - Listings.
  - Product catalog management.
  - Categories.
  - Pending product approvals.
  - Farmer verification requests.
  - Catalog requests.
  - Subscription requests.
  - Customer/farmer/admin user management.
  - Support center.
  - Notifications.
  - Audit logging access through admin route.
  - Disable/enable users and products.
  - Manage verification/subscription/product approval workflows.

- **Permissions**
  - Admin routes require `admin` or `super_admin`.
  - Can manage customers, farmers, admin users within allowed role scope.
  - Can review farmer verification requests.
  - Can approve/reject products.
  - Can approve/reject subscription requests.
  - Can disable users/products.
  - Can update orders.

- **Actions**
  - Review requests.
  - Manage categories/product catalog.
  - Moderate users.
  - View reports/KPIs.
  - Respond to support tickets.
  - Review logs.

## Superadmin

- **Pages**
  - `D:/Codings/AgriCatch/frontend/admin.html:276-363`

- **Features**
  - All admin features.
  - All Users.
  - Suspicious Patterns.
  - Flagged Users.
  - Security Log.
  - Audit Logs.
  - Platform Settings.
  - Feature Flags.
  - Broadcast.
  - Database Data Backup.
  - Image Manager.
  - Service/configuration status.

- **Permissions**
  - Superadmin-only endpoints require `super_admin`.
  - Can create/edit/disable any role, including admin/superadmin.
  - Can toggle feature flags.
  - Can update platform settings.
  - Can broadcast announcements.
  - Can access service status/security logs.
  - Cannot place orders or add cart items.

- **Actions**
  - Create/edit users.
  - Broadcast platform announcements.
  - Configure feature flags/settings.
  - Review security/audit data.
  - Monitor external service status.

# 2. Frontend Structure

## All Pages

- **Public/marketplace**
  - `D:/Codings/AgriCatch/frontend/index.html:45-417`
  - `D:/Codings/AgriCatch/frontend/product.html:41-71`
  - `D:/Codings/AgriCatch/frontend/farmers.html:1`
  - `D:/Codings/AgriCatch/frontend/404.html:1`

- **Customer**
  - `D:/Codings/AgriCatch/frontend/customer-account.html:640-1058`
  - `D:/Codings/AgriCatch/frontend/orders.html:526-772`
  - `D:/Codings/AgriCatch/frontend/checkout.html:526-543`
  - `D:/Codings/AgriCatch/frontend/wishlist.html:33-59`
  - `D:/Codings/AgriCatch/frontend/notifications.html:1`
  - `D:/Codings/AgriCatch/frontend/chat.html:1`

- **Farmer**
  - `D:/Codings/AgriCatch/frontend/farmer.html:826-876`
  - `D:/Codings/AgriCatch/frontend/request-product.html:11-36`

- **Admin/Superadmin**
  - `D:/Codings/AgriCatch/frontend/admin.html:165-363`
  - `D:/Codings/AgriCatch/frontend/admin-backup.html:1`

- **Utility/debug**
  - `D:/Codings/AgriCatch/frontend/clear_cache.html:1`
  - `D:/Codings/AgriCatch/frontend/clear_ui_orders.html:1`

## Dashboards

- **Admin dashboard**
  - Main dashboard shell: `D:/Codings/AgriCatch/frontend/admin.html:372-390`
  - Sidebar modules: `D:/Codings/AgriCatch/frontend/admin.html:165-363`

- **Farmer dashboard**
  - Sidebar shell: `D:/Codings/AgriCatch/frontend/farmer.html:826-876`
  - Dashboard overview section: `D:/Codings/AgriCatch/frontend/farmer.html:895-1163`

- **Customer account dashboard**
  - Profile/account sections: `D:/Codings/AgriCatch/frontend/customer-account.html:640-930`
  - Support sections: `D:/Codings/AgriCatch/frontend/customer-account.html:932-1058`

## Tabs / Sections By Role

- **Guest/public**
  - Home, Featured, Products, About, Contact: `D:/Codings/AgriCatch/frontend/index.html:59-80`
  - Product category tabs: `D:/Codings/AgriCatch/frontend/index.html:281-283`

- **Customer**
  - Profile Overview: `D:/Codings/AgriCatch/frontend/customer-account.html:640-692`
  - Edit Profile: `D:/Codings/AgriCatch/frontend/customer-account.html:694-764`
  - Change Password: `D:/Codings/AgriCatch/frontend/customer-account.html:767-813`
  - Verification: `D:/Codings/AgriCatch/frontend/customer-account.html:815-930`
  - Support Tickets: `D:/Codings/AgriCatch/frontend/customer-account.html:932-965`
  - Support Ticket Chat: `D:/Codings/AgriCatch/frontend/customer-account.html:967-1055`
  - Orders page status tabs: pending, confirmed, preparing, out_for_delivery, delivered, cancelled via order status UI classes `D:/Codings/AgriCatch/frontend/orders.html:209-227`

- **Farmer**
  - Overview, Orders, My Products, Messages, Notifications, Reviews, Subscription, Shop Profile, My Profile: `D:/Codings/AgriCatch/frontend/farmer.html:826-876`
  - Product tabs: My Products, Approval: `D:/Codings/AgriCatch/frontend/farmer.html:1243-1254`
  - Order status tabs: `D:/Codings/AgriCatch/frontend/farmer.html:1468-1469`

- **Admin**
  - Dashboard, Orders, Listings: `D:/Codings/AgriCatch/frontend/admin.html:169-193`
  - Product Management: Products, Categories: `D:/Codings/AgriCatch/frontend/admin.html:198-215`
  - Requests: Product Approvals, Verification Requests, Catalog Requests, Subscription Requests: `D:/Codings/AgriCatch/frontend/admin.html:218-248`
  - People: Customers, Farmers, Admin: `D:/Codings/AgriCatch/frontend/admin.html:249-274`
  - Communication: Support Center, Notifications: `D:/Codings/AgriCatch/frontend/admin.html:283-299`

- **Superadmin**
  - All Users: `D:/Codings/AgriCatch/frontend/admin.html:276-281`
  - Security: Suspicious Patterns, Flagged Users, Security Log, Audit Logs: `D:/Codings/AgriCatch/frontend/admin.html:301-328`
  - Platform: Platform Settings, Feature Flags, Broadcast, Database Data Backup, Image Manager: `D:/Codings/AgriCatch/frontend/admin.html:330-363`

## Major Modals / UI Components

- **Marketplace**
  - Product Details floating modal: `D:/Codings/AgriCatch/frontend/index.html:288-380`
  - Shop Details modal: `D:/Codings/AgriCatch/frontend/index.html:382-395`
  - Cart overlay/sidebar: `D:/Codings/AgriCatch/frontend/index.html:397-415`
  - Auth modal: `D:/Codings/AgriCatch/frontend/index.html:417-420`

- **Product detail**
  - Review form: `D:/Codings/AgriCatch/frontend/product.html:51-71`

- **Checkout**
  - Checkout form: `D:/Codings/AgriCatch/frontend/checkout.html:543-590`
  - Checkout items summary: `D:/Codings/AgriCatch/frontend/checkout.html:633-637`

- **Customer account**
  - Create support ticket modal: `D:/Codings/AgriCatch/frontend/customer-account.html:1057-1068`

- **Farmer**
  - Product forms/modals are implemented in farmer dashboard UI and JS; known core modal classes are in `D:/Codings/AgriCatch/frontend/farmer.html:63-77`
  - Customer rating stars: `D:/Codings/AgriCatch/frontend/farmer.html:346-349`

# 3. Backend Structure

## Route Mounting

Main API modules are mounted from `D:/Codings/AgriCatch/backend/server.js:768-956`.

- **Authentication**
  - `/api/auth`: `D:/Codings/AgriCatch/backend/server.js:768-769`
  - `/api/otp`: `D:/Codings/AgriCatch/backend/server.js:779-780`

- **Commerce**
  - `/api/products`: `D:/Codings/AgriCatch/backend/server.js:786-787`
  - `/api/cart`: `D:/Codings/AgriCatch/backend/server.js:809-810`
  - `/api/wishlist`: `D:/Codings/AgriCatch/backend/server.js:820-821`
  - `/api/orders`: `D:/Codings/AgriCatch/backend/server.js:831-832`
  - `/api/reviews`: `D:/Codings/AgriCatch/backend/server.js:798-799`

- **Communication**
  - `/api/notifications`: `D:/Codings/AgriCatch/backend/server.js:842-843`
  - `/api/messages`: `D:/Codings/AgriCatch/backend/server.js:853-854`
  - `/api/support-tickets`: `D:/Codings/AgriCatch/backend/server.js:955-956`

- **Accounts/address**
  - `/api/addresses`: `D:/Codings/AgriCatch/backend/server.js:864-865`
  - `/api/farmers`: `D:/Codings/AgriCatch/backend/server.js:944-945`
  - `/api/settings`: `D:/Codings/AgriCatch/backend/server.js:908-909`
  - `/api/psgc`: present as route file `D:/Codings/AgriCatch/backend/routes/psgc.js:1`

- **Admin/platform**
  - `/api/admin`: `D:/Codings/AgriCatch/backend/server.js:875-876`
  - `/api/superadmin`: `D:/Codings/AgriCatch/backend/server.js:887-888`
  - `/api/subscriptions`: `D:/Codings/AgriCatch/backend/server.js:894-895`
  - `/api/upload`: `D:/Codings/AgriCatch/backend/server.js:922-923`
  - `/api/contact`: `D:/Codings/AgriCatch/backend/server.js:933-934`

- **Realtime/system**
  - `/api/events` SSE: `D:/Codings/AgriCatch/backend/server.js:994-1019`
  - `/api/time`: `D:/Codings/AgriCatch/backend/server.js:1039-1043`
  - `/_health`: `D:/Codings/AgriCatch/backend/server.js:25-28`

## Business Domains

- **Authentication**
  - Register/login/password reset/OTP.
  - CAPTCHA protection for registration.
  - Role stored on `users.role`.
  - Disabled accounts blocked globally: `D:/Codings/AgriCatch/backend/server.js:144-167`

- **Products**
  - Public product listing with filters/search/sort/preorder.
  - Category catalog.
  - Farmer product creation/update.
  - Product approval workflow via `products.status`.
  - Product image upload/cloud storage.
  - Farmer subscription tier limits.

- **Orders**
  - Per-item order model: one order row per product item.
  - Customer order listing.
  - Farmer order listing.
  - Status transition enforcement.
  - Stock/preorder reservation mutations.

- **Cart/Checkout**
  - Guest and logged-in cart.
  - Product availability validation.
  - Checkout creates per-item orders and clears cart.

- **Messages**
  - Conversations keyed by farmer/customer pair.
  - Message send/read/unread count.
  - SSE chat events.

- **Notifications**
  - User-specific notifications table.
  - Paginated list, mark read, mark all read.
  - Notifications linked to order/product where applicable.

- **Reviews**
  - Customer product reviews.
  - Farmer-to-customer ratings.
  - Eligibility based on delivered orders and one-month edit window.

- **Addresses**
  - User address management with PSGC address fields.

- **Farmer Verification**
  - Verification request table.
  - Admin approval/rejection/unverification.
  - User `is_verified` updated.

- **Subscriptions**
  - Farmer premium requests.
  - Payment proof upload.
  - Admin approval/rejection.
  - Premium pricing/payment account settings.

- **Admin Management**
  - Users, products, orders, categories, requests, logs, settings, support, subscriptions.

- **Superadmin Management**
  - Feature flags.
  - Platform settings.
  - Announcements.
  - Service status.
  - Security logs.
  - Admin/superadmin account management.

# 4. Database Structure

## Major Tables

- **`users`**
  - **Purpose:** All accounts: customer, farmer, admin, superadmin.
  - **Relationships:** Referenced by products, orders, cart, reviews, notifications, messages, addresses, subscriptions.
  - **Roles:** All roles.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:5-37`

- **`categories`**
  - **Purpose:** Product category taxonomy.
  - **Relationships:** Referenced by `products`, `product_name_catalog`, `product_name_requests`.
  - **Roles:** Guest/customer browsing; farmer product forms; admin catalog management.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:39-47`

- **`products`**
  - **Purpose:** Marketplace product listings.
  - **Relationships:** Belongs to farmer user; category; referenced by cart, orders, reviews, wishlist, messages, notifications.
  - **Roles:** Guest/customer browse; farmer manage; admin approve/moderate.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:49-69`

- **`cart`**
  - **Purpose:** Guest and user cart items.
  - **Relationships:** References user or session and product.
  - **Roles:** Guest/customer.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:71-81`

- **`orders`**
  - **Purpose:** Per-item order rows.
  - **Relationships:** References customer user and product; linked from notifications and customer ratings.
  - **Roles:** Customer, farmer, admin.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:83-106`

- **`order_items`**
  - **Purpose:** Legacy/compatibility order item table.
  - **Relationships:** References orders/products.
  - **Roles:** Order domain.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:108-119`

- **`reviews`**
  - **Purpose:** Customer product reviews.
  - **Relationships:** References products/users.
  - **Roles:** Customer submits; farmer/admin consume.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:121-131`

- **`customer_ratings`**
  - **Purpose:** Farmer rates customer per delivered order.
  - **Relationships:** References order, farmer user, customer user.
  - **Roles:** Farmer/customer.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:133-143`

- **`wishlist`**
  - **Purpose:** Saved customer products.
  - **Relationships:** References user/product.
  - **Roles:** Customer.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:145-152`

- **`notifications`**
  - **Purpose:** User-targeted notifications.
  - **Relationships:** References user/order/product.
  - **Roles:** Customer, farmer, admin, superadmin.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:154-165`
  - Runtime ensured: `D:/Codings/AgriCatch/backend/server.js:500-516`

- **`conversations`**
  - **Purpose:** Chat thread between farmer and customer/admin-as-customer.
  - **Relationships:** References farmer/customer users.
  - **Roles:** Customer, farmer, admin.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:167-176`

- **`messages`**
  - **Purpose:** Chat messages.
  - **Relationships:** References sender/receiver users and optional product.
  - **Roles:** Customer, farmer, admin.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:178-188`

- **`user_addresses`**
  - **Purpose:** Saved delivery addresses.
  - **Relationships:** References user.
  - **Roles:** Customer primarily; account flows.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:193-211`

- **`otps`**
  - **Purpose:** Email OTP for login/register/reset flows.
  - **Relationships:** Email-based.
  - **Roles:** Guest registering/login; all users.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:215-229`

- **`password_resets`**
  - **Purpose:** Password reset OTP hash records.
  - **Relationships:** References user.
  - **Roles:** All users.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:230-249`

- **`settings`**
  - **Purpose:** App-level setting table in schema.
  - **Relationships:** None direct.
  - **Roles:** System/admin.
  - Schema base: `D:/Codings/AgriCatch/database/schema.sql:261-274`

- **`feature_flags`**
  - **Purpose:** Platform feature toggles.
  - **Relationships:** Used by middleware.
  - **Roles:** Superadmin/system.
  - Runtime schema/defaults: `D:/Codings/AgriCatch/backend/server.js:517-540`

- **`payment_accounts`**
  - **Purpose:** Active payment destinations for subscriptions.
  - **Relationships:** Referenced by farmer subscriptions.
  - **Roles:** Farmer subscription page; admin/superadmin management.
  - Migration: `D:/Codings/AgriCatch/database/migrations/add_farmer_subscriptions.sql:4-14`

- **`farmer_subscriptions`**
  - **Purpose:** Free/premium subscription requests and active plans.
  - **Relationships:** References farmer user, payment account, approving admin.
  - **Roles:** Farmer, admin.
  - Migration: `D:/Codings/AgriCatch/database/migrations/add_farmer_subscriptions.sql:20-43`

- **`platform_settings`**
  - **Purpose:** Superadmin-controlled settings, subscription pricing.
  - **Relationships:** Referenced by subscription/settings routes.
  - **Roles:** Superadmin/admin/farmer subscription.
  - Creation in superadmin route: `D:/Codings/AgriCatch/backend/routes/superadmin.js:538-544`
  - Subscription price seed: `D:/Codings/AgriCatch/database/migrations/add_farmer_subscriptions.sql:44-50`

- **`product_name_catalog`**
  - **Purpose:** Approved product-name catalog.
  - **Relationships:** References categories/users.
  - **Roles:** Farmer product forms, admin catalog.
  - Runtime schema: `D:/Codings/AgriCatch/backend/routes/products.js:187-200`
  - **Documentation:** docs/DATABASE.md

- **`product_name_requests`**
  - **Purpose:** Farmer requests for custom product names/categories.
  - **Relationships:** References categories/requesting/reviewing users.
  - **Roles:** Farmer, admin.
  - Runtime schema: `D:/Codings/AgriCatch/backend/routes/products.js:202-218`
  - **Documentation:** docs/DATABASE.md

- **`verification_requests`**
  - **Purpose:** Farmer verification workflow.
  - **Relationships:** References farmer users and reviewing admin.
  - **Roles:** Farmer, admin.
  - Creation script: `D:/Codings/AgriCatch/backend/run_verification_requests_migration.js:14-20`
  - **Documentation:** docs/DATABASE.md

- **`support_tickets`**
  - **Purpose:** Customer/farmer support cases.
  - **Relationships:** References creating user.
  - **Roles:** Customer, farmer, admin.
  - Creation script: `D:/Codings/AgriCatch/backend/create_support_tables.js:24-29`
  - **Documentation:** docs/DATABASE.md, docs/BUSINESS_RULES.md

- **`support_messages`**
  - **Purpose:** Support ticket chat messages.
  - **Relationships:** References support ticket and sender user.
  - **Roles:** Customer, farmer, admin.
  - Creation script: `D:/Codings/AgriCatch/backend/create_support_tables.js:39-44`
  - **Documentation:** docs/DATABASE.md

- **`admin_audit_logs`**
  - **Purpose:** Admin/security audit trail.
  - **Relationships:** Actor admin and entity metadata.
  - **Roles:** Admin/superadmin.
  - Migration fields/indexes: `D:/Codings/AgriCatch/database/migrations/add_audit_log_fields.sql:1-8`

# 5. Order Management System

## Current Workflow

- **Workflow**
  - `pending → confirmed → preparing → out_for_delivery → delivered`
  - Cancellation allowed before delivered.
  - Delivered and cancelled are terminal.
  - Defined in route comments and transition matrix: `D:/Codings/AgriCatch/backend/routes/orders.js:8-10`, `D:/Codings/AgriCatch/backend/routes/orders.js:271-280`

## Current Statuses

- **Statuses**
  - `pending`
  - `confirmed`
  - `preparing`
  - `out_for_delivery`
  - `delivered`
  - `cancelled`
  - Validated in `D:/Codings/AgriCatch/backend/routes/orders.js:232-235`

## Current Pages

- **Customer orders**
  - `D:/Codings/AgriCatch/frontend/orders.html:526-772`

- **Farmer orders**
  - `D:/Codings/AgriCatch/frontend/farmer.html:1388-1469`

- **Admin orders**
  - `D:/Codings/AgriCatch/frontend/admin.html:182-187`

- **Checkout**
  - `D:/Codings/AgriCatch/frontend/checkout.html:526-543`

## Current APIs

- **Customer list**
  - `GET /api/orders`: `D:/Codings/AgriCatch/backend/routes/orders.js:11-88`

- **Farmer list**
  - `GET /api/orders/farmer/:farmerId`: `D:/Codings/AgriCatch/backend/routes/orders.js:90-207`

- **Single customer order**
  - `GET /api/orders/:id`: `D:/Codings/AgriCatch/backend/routes/orders.js:376-432`

- **Create orders**
  - `POST /api/orders`: `D:/Codings/AgriCatch/backend/routes/orders.js:434-798`

- **Update item/order status**
  - `PUT /api/orders/:orderId/items/:orderItemId/status`: `D:/Codings/AgriCatch/backend/routes/orders.js:209-374`
  - `PUT /api/orders/:id/status`: `D:/Codings/AgriCatch/backend/routes/orders.js:800-879`

## Current Notifications

- **Order placed**
  - Farmer receives `order_placed`: `D:/Codings/AgriCatch/backend/routes/orders.js:699-714`

- **Order updated**
  - Customer receives `order_update`: `D:/Codings/AgriCatch/backend/routes/orders.js:333-339`

- **Low stock**
  - Farmer receives `low_stock_alert`: `D:/Codings/AgriCatch/backend/routes/orders.js:673-687`

- **Realtime**
  - `order.updated` SSE broadcast: `D:/Codings/AgriCatch/backend/routes/orders.js:342-349`

# 6. Inventory Management

## `stock_quantity`

- **Purpose**
  - Available stock for regular products.
  - Displayed in marketplace product details.
  - Used to validate cart additions and checkout.

- **Cart validation**
  - Add-to-cart rejects quantity greater than stock: `D:/Codings/AgriCatch/backend/routes/cart.js:177-179`
  - Existing cart quantity updates also validate against stock: `D:/Codings/AgriCatch/backend/routes/cart.js:198-207`

- **Checkout mutation**
  - Regular checkout atomically decrements stock: `D:/Codings/AgriCatch/backend/routes/orders.js:615-631`

- **Cancellation mutation**
  - Cancellation restores stock in status update path: `D:/Codings/AgriCatch/backend/routes/orders.js:327-331`

- **Low-stock notification**
  - Threshold is `15`: `D:/Codings/AgriCatch/backend/routes/orders.js:675-684`

## `reserved_quantity`

- **Purpose**
  - Preorder reservation counter.
  - Tracks reserved demand without decrementing regular `stock_quantity`.

- **Preorder reservation**
  - Checkout atomically increments `reserved_quantity`: `D:/Codings/AgriCatch/backend/routes/orders.js:593-613`

- **Limit enforcement**
  - Enforced against `max_preorder_quantity`: `D:/Codings/AgriCatch/backend/routes/orders.js:597-602`

- **Schema**
  - Added by preorder migration: `D:/Codings/AgriCatch/database/migrations/add_preorder_fields.sql:1-13`

## Preorder Fields

- **Product fields**
  - `is_preorder`
  - `preorder_availability_date`
  - `reserved_quantity`
  - `max_preorder_quantity`
  - Migration: `D:/Codings/AgriCatch/database/migrations/add_preorder_fields.sql:1-6`

- **Order fields**
  - `is_preorder`
  - `preorder_converted_at`
  - `preorder_reserved_quantity`
  - `preorder_fulfilled_quantity`
  - Migration: `D:/Codings/AgriCatch/database/migrations/add_preorder_fields.sql:7-13`

- **Checkout rules**
  - Cannot mix preorder and regular products in one checkout: `D:/Codings/AgriCatch/backend/routes/orders.js:549-559`
  - Preorder delivery date may be optional; regular order delivery date is required: `D:/Codings/AgriCatch/backend/routes/orders.js:561-591`

# 7. Notification System

## Existing Notification Storage/API

- **Storage**
  - `notifications` table stores target user, type, title, message, read state, order/product refs: `D:/Codings/AgriCatch/database/schema.sql:154-165`

- **Read APIs**
  - Paginated list and optional type filter: `D:/Codings/AgriCatch/backend/routes/notifications.js:19-73`
  - Mark one read: `D:/Codings/AgriCatch/backend/routes/notifications.js:75-93`
  - Mark all read: `D:/Codings/AgriCatch/backend/routes/notifications.js:95-109`

- **Realtime**
  - SSE endpoint: `D:/Codings/AgriCatch/backend/server.js:994-1019`
  - Farmer listens for `notification.created`: `D:/Codings/AgriCatch/frontend/js/farmer.js:1028-1032`

## Existing Notification Triggers

- **Order placed**
  - Target: farmer.
  - Type: `order_placed`.
  - Source: `D:/Codings/AgriCatch/backend/routes/orders.js:699-714`

- **Order updated**
  - Target: customer.
  - Type: `order_update`.
  - Source: `D:/Codings/AgriCatch/backend/routes/orders.js:333-339`

- **Low stock**
  - Target: farmer.
  - Type: `low_stock_alert`.
  - Source: `D:/Codings/AgriCatch/backend/routes/orders.js:673-687`

- **New review**
  - Target: farmer.
  - Type: `new_review`.
  - Source: `D:/Codings/AgriCatch/backend/routes/reviews.js:241-252`

- **Support ticket admin response**
  - Target: ticket owner.
  - Type: `support_ticket`.
  - Source: `D:/Codings/AgriCatch/backend/routes/support-tickets.js:297-304`

- **Platform announcement**
  - Target: selected audience.
  - Type: `announcement`.
  - Source: `D:/Codings/AgriCatch/backend/routes/superadmin.js:234-302`

- **Verification rejection/unverification**
  - Target: farmer.
  - Types: `verification_rejected`, `account_unverified`.
  - Source: `D:/Codings/AgriCatch/backend/routes/admin.js:1153-1174`

- **Products disabled/enabled**
  - Target: farmer.
  - Types: `products_disabled`, `products_enabled`.
  - Source: `D:/Codings/AgriCatch/backend/routes/admin.js:376-388`, `D:/Codings/AgriCatch/backend/routes/admin.js:452-464`

# 8. Chat System

## Customer ↔ Farmer Flow

- **Conversation model**
  - Conversation is identified by `${farmerId}_${customerId}`.
  - Stored in `conversations`.
  - Messages stored in `messages`.
  - Schema: `D:/Codings/AgriCatch/database/schema.sql:167-188`

- **Send flow**
  - Customer may message farmer.
  - Farmer may message customer/admin.
  - Admin may message farmer.
  - Role validation in send endpoint: `D:/Codings/AgriCatch/backend/routes/messages.js:168-201`
  - Conversation creation/update and message insert: `D:/Codings/AgriCatch/backend/routes/messages.js:202-224`

- **Read flow**
  - Conversation list includes unread count and last message: `D:/Codings/AgriCatch/backend/routes/messages.js:25-63`
  - Fetch messages paginated: `D:/Codings/AgriCatch/backend/routes/messages.js:65-116`
  - Mark conversation read: `D:/Codings/AgriCatch/backend/routes/messages.js:118-145`
  - Mark message read: `D:/Codings/AgriCatch/backend/routes/messages.js:241-263`
  - Unread count endpoint: `D:/Codings/AgriCatch/backend/routes/messages.js:265-280`

## Existing Chat Architecture

- **Backend**
  - Express routes under `/api/messages`.
  - PostgreSQL tables.
  - SSE broadcasts for `chat.message` and `chat.read`: `D:/Codings/AgriCatch/backend/routes/messages.js:226-232`, `D:/Codings/AgriCatch/backend/routes/messages.js:133-138`

- **Frontend**
  - Customer/farmer/admin chat UI in `D:/Codings/AgriCatch/frontend/js/chat.js:6-42`
  - Farmer dashboard listens for chat SSE: `D:/Codings/AgriCatch/frontend/js/farmer.js:1009-1016`
  - Support ticket chat uses polling: `D:/Codings/AgriCatch/frontend/js/support-ticket-chat.js:339-345`

## Current Capabilities

- **Supported**
  - Text messages.
  - 500-character message limit.
  - Product context via optional `product_id`.
  - Unread count.
  - Read receipts at message/conversation level.
  - SSE for chat message/read events.
  - Admin-farmer chat path.
  - Support ticket chat is separate from marketplace chat.

## Missing Capabilities

- **Not evident in current code**
  - Attachments/media in chat messages.
  - Typing indicators.
  - Delivered receipts.
  - Message deletion/editing.
  - Group conversations.
  - Push notifications outside web/SSE.
  - WebSocket transport; current realtime is SSE plus polling fallback.

# 9. Review and Rating System

## Current Workflow

- **Product review**
  - Customer can review product only after delivered order.
  - Eligibility checks delivered order and one-month editable window.
  - Source: `D:/Codings/AgriCatch/backend/routes/reviews.js:65-110`

- **Review submission**
  - Validates rating 1-5.
  - Inserts review.
  - Refreshes farmer aggregate rating.
  - Notifies farmer.
  - Source: `D:/Codings/AgriCatch/backend/routes/reviews.js:209-252`

- **Review listing**
  - Public product reviews endpoint: `D:/Codings/AgriCatch/backend/routes/reviews.js:190-201`

- **Customer rating**
  - Farmer can rate customer only after delivered order.
  - Eligibility and one-month window: `D:/Codings/AgriCatch/backend/routes/reviews.js:112-158`

## Permissions

- **Customer**
  - Can rate products they received.

- **Farmer**
  - Can rate customers for delivered orders tied to their products.

- **Guest**
  - Can read reviews.
  - Cannot create reviews.

## Restrictions

- **Product reviews**
  - Require delivered order.
  - Rating must be 1-5.
  - Rating window ends one month after delivery.
  - Unique product/user constraint in schema: `D:/Codings/AgriCatch/database/schema.sql:121-131`

- **Customer ratings**
  - Require delivered order.
  - Unique order/farmer constraint: `D:/Codings/AgriCatch/database/schema.sql:133-143`

# 10. Admin and Superadmin Features

## Admin Controls

- **User management**
  - Admin users endpoint starts at `D:/Codings/AgriCatch/backend/routes/admin.js:496-507`
  - Disable/enable user logic handles farmer product disabling and notifications: `D:/Codings/AgriCatch/backend/routes/admin.js:376-388`, `D:/Codings/AgriCatch/backend/routes/admin.js:452-464`

- **Product/catalog management**
  - Category/product catalog schema: `D:/Codings/AgriCatch/backend/routes/admin.js:164-199`
  - Product approval workflow uses `products.status` and approval section in UI: `D:/Codings/AgriCatch/frontend/admin.html:221-227`

- **Verification requests**
  - List verification requests: `D:/Codings/AgriCatch/backend/routes/admin.js:1038-1074`
  - Review verification requests: `D:/Codings/AgriCatch/backend/routes/admin.js:1092-1183`

- **Audit logs**
  - Audit log list/detail uses `admin_audit_logs`: `D:/Codings/AgriCatch/backend/routes/admin.js:728-760`

- **Support center**
  - Admin access to support tickets: `D:/Codings/AgriCatch/backend/routes/support-tickets.js:53-100`
  - Admin unread count: `D:/Codings/AgriCatch/backend/routes/support-tickets.js:102-124`

## Superadmin Controls

- **Service status**
  - `GET /api/superadmin/status`: `D:/Codings/AgriCatch/backend/routes/superadmin.js:12-207`

- **Admin account listing**
  - `GET /api/superadmin/admin`: `D:/Codings/AgriCatch/backend/routes/superadmin.js:209-232`

- **Announcements**
  - `POST /api/superadmin/announcements`: `D:/Codings/AgriCatch/backend/routes/superadmin.js:234-302`

- **User create/edit/disable**
  - Create any account: `D:/Codings/AgriCatch/backend/routes/superadmin.js:309-385`
  - Edit any user: `D:/Codings/AgriCatch/backend/routes/superadmin.js:387-471`
  - Disable user: `D:/Codings/AgriCatch/backend/routes/superadmin.js:473-508`

- **Settings and flags**
  - Platform settings: `D:/Codings/AgriCatch/backend/routes/superadmin.js:510-578`
  - Feature flags: `D:/Codings/AgriCatch/backend/routes/superadmin.js:642-657`

- **Security logs**
  - Security log endpoint: `D:/Codings/AgriCatch/backend/routes/superadmin.js:579-640`

# 11. Landing Page and Marketplace Features

## Product Browsing

- **Featured / best selling**
  - Featured grid: `D:/Codings/AgriCatch/frontend/index.html:233-242`

- **Products grid**
  - Product listing section: `D:/Codings/AgriCatch/frontend/index.html:244-286`

- **Product API**
  - Public listing supports pagination, category, search, sort, preorder filters: `D:/Codings/AgriCatch/backend/routes/products.js:439-520`

## Search

- **Search input**
  - `D:/Codings/AgriCatch/frontend/index.html:266-271`

## Filters

- **Sort filters**
  - Latest, Top Sales, Expected Harvest Date, Best Before, Price low/high: `D:/Codings/AgriCatch/frontend/index.html:250-264`

- **Preorder filter**
  - All Products, Pre-orders Only, Available Now: `D:/Codings/AgriCatch/frontend/index.html:272-278`

- **Category tabs**
  - `D:/Codings/AgriCatch/frontend/index.html:281-283`

## Categories

- **API**
  - Product categories endpoint filters disabled/fishery categories: `D:/Codings/AgriCatch/backend/routes/products.js:225-265`

## Product Detail Pages

- **Inline marketplace modal**
  - Product details modal: `D:/Codings/AgriCatch/frontend/index.html:288-380`

- **Standalone product page**
  - `D:/Codings/AgriCatch/frontend/product.html:41-71`

- **Product detail data**
  - Includes farmer, location, stock, harvest, expiry, price, quantity, add cart controls: `D:/Codings/AgriCatch/frontend/index.html:311-377`

# 12. Architectural Dependency Map

## Orders

- **Depends on**
  - `users` for customer/farmer roles.
  - `products` for farmer ownership, price, stock, preorder fields.
  - `cart` for checkout source.
  - `notifications` for farmer/customer alerts.
  - `reviews/customer_ratings` for delivered-order eligibility.
  - SSE realtime for order updates.

- **Affected modules**
  - `D:/Codings/AgriCatch/backend/routes/orders.js:1-879`
  - `D:/Codings/AgriCatch/backend/routes/cart.js:1-320`
  - `D:/Codings/AgriCatch/backend/routes/reviews.js:65-158`
  - `D:/Codings/AgriCatch/frontend/js/orders.js:298-312`
  - `D:/Codings/AgriCatch/frontend/js/farmer.js:972-1006`

## Notifications

- **Depends on**
  - `users`
  - `orders`
  - `products`
  - SSE events.

- **Affected modules**
  - `D:/Codings/AgriCatch/backend/routes/notifications.js:19-109`
  - `D:/Codings/AgriCatch/backend/routes/orders.js:333-339`
  - `D:/Codings/AgriCatch/backend/routes/reviews.js:241-252`
  - `D:/Codings/AgriCatch/backend/routes/superadmin.js:234-302`
  - `D:/Codings/AgriCatch/frontend/js/farmer.js:1028-1032`

## Chat

- **Depends on**
  - `users`
  - `conversations`
  - `messages`
  - Optional `products`
  - SSE events.

- **Affected modules**
  - `D:/Codings/AgriCatch/backend/routes/messages.js:25-280`
  - `D:/Codings/AgriCatch/frontend/js/chat.js:6-42`
  - `D:/Codings/AgriCatch/frontend/js/farmer.js:1009-1016`

## Inventory

- **Depends on**
  - `products.stock_quantity`
  - `products.reserved_quantity`
  - `products.max_preorder_quantity`
  - `orders.is_preorder`
  - `orders.preorder_reserved_quantity`

- **Affected modules**
  - `D:/Codings/AgriCatch/backend/routes/cart.js:145-179`
  - `D:/Codings/AgriCatch/backend/routes/orders.js:593-631`
  - `D:/Codings/AgriCatch/database/migrations/add_preorder_fields.sql:1-13`

## Reviews

- **Depends on**
  - Delivered orders.
  - Products.
  - Users.
  - Notifications.
  - Aggregate rating fields on users.

- **Affected modules**
  - `D:/Codings/AgriCatch/backend/routes/reviews.js:18-63`
  - `D:/Codings/AgriCatch/backend/routes/reviews.js:65-158`
  - `D:/Codings/AgriCatch/backend/routes/reviews.js:209-252`

## Admin

- **Depends on**
  - Users.
  - Products/categories/catalog requests.
  - Verification requests.
  - Farmer subscriptions/payment accounts.
  - Notifications.
  - Audit logs.
  - Feature flags/platform settings.

- **Affected modules**
  - `D:/Codings/AgriCatch/backend/routes/admin.js:164-199`
  - `D:/Codings/AgriCatch/backend/routes/admin.js:496-507`
  - `D:/Codings/AgriCatch/backend/routes/admin.js:1038-1183`
  - `D:/Codings/AgriCatch/backend/routes/superadmin.js:510-657`
  - `D:/Codings/AgriCatch/frontend/admin.html:165-363`

# 13. Risk Areas

- **Order/inventory coupling**
  - Checkout mutates stock/reservations, creates orders, sends notifications, and clears cart in one flow.
  - Risk concentration: `D:/Codings/AgriCatch/backend/routes/orders.js:482-744`

- **Per-item order model with legacy `order_items` compatibility**
  - Current comments state each order represents one product/item, but `order_items` still exists.
  - Risk area: `D:/Codings/AgriCatch/database/schema.sql:83-119`

- **Status transition duplication**
  - Main item status endpoint and alternate order status endpoint both implement transition logic.
  - Risk area: `D:/Codings/AgriCatch/backend/routes/orders.js:209-374`, `D:/Codings/AgriCatch/backend/routes/orders.js:800-879`

- **Product availability rules repeated**
  - Cart, product listing, checkout, admin disable, farmer availability all affect whether a product can be bought.
  - Risk area: `D:/Codings/AgriCatch/backend/routes/cart.js:145-179`, `D:/Codings/AgriCatch/backend/routes/orders.js:521-535`, `D:/Codings/AgriCatch/backend/routes/products.js:463-489`

- **Preorder inventory**
  - `reserved_quantity`, `max_preorder_quantity`, `preorder_reserved_quantity`, and cancellation/fulfillment behavior must stay consistent.
  - Risk area: `D:/Codings/AgriCatch/backend/routes/orders.js:593-613`, `D:/Codings/AgriCatch/database/migrations/add_preorder_fields.sql:1-13`

- **Notifications are inserted ad hoc**
  - Multiple routes directly insert notifications with string types.
  - Risk area: `D:/Codings/AgriCatch/backend/routes/orders.js:333-339`, `D:/Codings/AgriCatch/backend/routes/reviews.js:241-252`, `D:/Codings/AgriCatch/backend/routes/superadmin.js:234-302`

- **Realtime is mixed SSE/polling**
  - Orders/chat/notifications use SSE in some places, polling in support/customer/farmer paths.
  - Risk area: `D:/Codings/AgriCatch/backend/server.js:994-1019`, `D:/Codings/AgriCatch/frontend/js/support-ticket-chat.js:339-345`

- **Admin/superadmin role boundary**
  - Admin and superadmin share `/api/admin`, while superadmin has dedicated `/api/superadmin`.
  - Risk area: `D:/Codings/AgriCatch/backend/server.js:875-888`, `D:/Codings/AgriCatch/frontend/admin.html:276-363`

- **Runtime schema creation mixed with migrations**
  - Tables/columns are created in schema, migrations, scripts, and server startup.
  - Risk area: `D:/Codings/AgriCatch/backend/server.js:172-696`, `D:/Codings/AgriCatch/database/schema.sql:5-281`

- **Verification/subscription/admin workflows**
  - Multiple state machines: product status, verification status, subscription status, order status.
  - Risk area: `D:/Codings/AgriCatch/backend/routes/admin.js:1038-1183`, `D:/Codings/AgriCatch/backend/routes/subscriptions.js:52-169`

- **Chat role modeling**
  - `conversations.customer_id` can represent a customer or admin in admin-farmer chat.
  - Risk area: `D:/Codings/AgriCatch/backend/routes/messages.js:181-202`

# Completion Status

- **Completed:** Full read-only system inventory of roles, frontend, backend, database, orders, inventory, notifications, chat, reviews, admin/superadmin, marketplace, dependencies, and risk areas.
- **Not performed:** No code changes, no fixes, no architecture recommendations.
