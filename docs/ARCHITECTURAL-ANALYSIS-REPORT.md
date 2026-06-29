# AgriCatch Architectural Analysis Report
## For Thesis Documentation

> Based entirely on actual codebase inspection. No features are invented or guessed.

---

# PART 1 — SYSTEM OVERVIEW

## Purpose

AgriCatch is a production-ready agricultural e-commerce platform that connects customers directly with verified farmers in the Philippines. The platform supports both "Available Now" products (in-stock) and "Hybrid Pre-order" products (reserve before harvest), with role-based access for customers, farmers, administrators, and super administrators.

## Main Users (Actors)

1. **Customer** — Browses products, manages cart/wishlist, places orders, submits reviews, messages farmers, manages addresses, receives notifications, creates support tickets.
2. **Farmer** — Manages products (including hybrid pre-order lifecycle), views analytics/dashboard, manages shop profile, handles orders (status updates, delivery), responds to reviews, messages customers, requests verification, manages subscriptions, creates support tickets.
3. **Admin (Staff)** — Manages users (CRUD, disable/enable, verify), products (approve/reject, disable, assign, edit), orders (status updates, disable/enable), categories (CRUD, disable/enable), catalog names (CRUD, disable/enable), reviews category requests, views dashboard analytics, views audit logs, manages payment accounts, views support tickets.
4. **Super Admin** — All admin capabilities plus: manages platform settings, manages feature flags, broadcasts announcements, creates any user role (including admin), deletes categories/catalog names, toggles debug mode, manages activity monitor settings, views system status.

## Core Modules

1. **Authentication** — Registration, login, JWT-based auth, OTP verification, password reset (forgot password flow), profile management, change password.
2. **Authorization** — Role-based access control (RBAC) via `requireRole` middleware.
3. **Products** — Full CRUD by farmers, admin approval workflow (pending/approved/rejected), product catalog, category management, featured products, product search/filter, harvest lifecycle, pre-order conversion.
4. **Hybrid Pre-order** — Pre-order product creation, reservation logic, inventory synchronization (reserved_quantity, stock_quantity, max_preorder_quantity), harvest lifecycle (convert pre-orders to stock), preorder-specific order status (preorder_reserved).
5. **Cart** — Guest cart (session-based) and user cart (JWT-based), cart migration on login, quantity updates.
6. **Wishlist** — Add/remove products, view wishlist.
7. **Checkout & Orders** — Order creation, per-item order status, order transition matrix, cancellation with inventory restoration, delivery date setting, farmer/admin order management.
8. **Reviews** — Product reviews (rating + comment), edit/delete reviews, farmer ratings aggregation, customer ratings (farmer rates customer per delivered order).
9. **Messaging** — Real-time chat between customers and farmers, conversations, unread counts.
10. **Notifications** — In-app notifications (order updates, product approvals, category requests, announcements), mark as read, SSE real-time delivery.
11. **Addresses** — CRUD user addresses, set default address.
12. **Farmer Dashboard & Analytics** — Overview stats, metrics, time-series reports, CSV export, shop profile management, verification requests.
13. **Admin Dashboard & Analytics** — Dashboard stats (sales, revenue, customers, farmers), time-series reports, top products, top farmers, recent activity (audit logs), suspicious pattern detection, customer/farmer summaries.
14. **Subscriptions** — Farmer subscription tiers (free/premium), subscription requests with payment proof, subscription history, payment account management.
15. **Platform Settings** — Delivery fee, delivery address, product limits, reCAPTCHA mode, OTP mode, maintenance mode, registration toggle, announcements toggle, price drop alerts, product approval requirement.
16. **Feature Flags** — Database-driven toggles for system features.
17. **Activity Monitor** — User activity logging, admin activity dashboard, real-time SSE stream, online users, error tracking, storage stats, cleanup, configurable settings.
18. **Audit Logs** — Admin action audit trail with before/after state, IP, user agent, session ID.
19. **Support Tickets** — Customer/farmer creates tickets, admin views/responds, ticket messages.
20. **PSGC (Philippine Standard Geographic Code)** — Provinces, cities, barangays data for address dropdowns (Luzon regions).
21. **File Uploads** — Product images, shop banners, shop avatars, verification documents, payment proofs — via Multer (local) + Cloudinary (cloud storage).
22. **Contact** — Public contact form submission.
23. **Announcements** — Super admin broadcasts dismissible platform-wide banners.

## Business Workflow

1. Farmer registers (or admin creates account) → Farmer may request verification → Admin reviews verification request.
2. Farmer creates product → If `require_product_approval` flag is on, product is `pending` → Admin approves/rejects → Product becomes available.
3. Customer browses products (filter by category, search, sort) → Adds to cart (guest or logged-in) → Manages wishlist.
4. Customer checks out → Order is created (per-item) → Inventory is decremented/reserved.
5. Farmer/Admin updates order status through the transition matrix: pending → confirmed → preparing → scheduled → out_for_delivery → delivered → completed.
6. Customer can cancel order (only at specific stages per role rules). Inventory is restored on cancellation.
7. After delivery, customer can submit a review. Farmer can rate the customer.
8. For pre-orders: Customer reserves → Order is `preorder_reserved` → Farmer harvests → Converts pre-orders to stock → Order continues through normal flow.
9. Farmer can view analytics, manage shop profile, message customers.
10. Admin manages users, products, orders, categories, catalog, views analytics, reviews requests.
11. Super Admin manages platform settings, feature flags, announcements, system status.

## Technologies Used

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (vanilla), Bootstrap 5.3.3, Bootstrap Icons, Font Awesome, Simple-DataTables |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Supabase) |
| ORM/Driver | `pg` (node-postgres) with connection pooling |
| Authentication | JWT (`jsonwebtoken`), `bcryptjs` for password hashing |
| Session | `express-session` |
| File Upload | `multer` (local storage) + `cloudinary` (cloud storage) |
| Email | `nodemailer` (SMTP fallback) + `resend` (Resend API, preferred) |
| Rate Limiting | `express-rate-limit` |
| Scheduled Tasks | `node-cron` |
| Bot Protection | Google reCAPTCHA v2 |
| Real-time | Server-Sent Events (SSE) |
| Cookies | `cookie-parser` |
| Environment | `dotenv` |

## External Services

1. **Supabase** — PostgreSQL database hosting.
2. **Cloudinary** — Cloud image storage and CDN for product images, shop banners, avatars, verification documents, payment proofs.
3. **Resend** — Email API for OTP, welcome emails, password resets (preferred over SMTP).
4. **Google reCAPTCHA** — Bot protection on registration and login.
5. **Render** — Backend application hosting (with self-ping cron job).
6. **Vercel** — Frontend static file hosting.

## Database

PostgreSQL hosted on Supabase. Connection via `DATABASE_URL` environment variable or individual `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT` variables. SSL is auto-enabled for Supabase/Render hosts.

## Hosting

- **Frontend**: Vercel (static files served from `/frontend` directory).
- **Backend**: Render (Node.js web service). Self-ping cron job every 5 minutes to prevent sleep.
- **Database**: Supabase (PostgreSQL).
- **Image Storage**: Cloudinary.
- **Email**: Resend API (cloud-friendly) with SMTP fallback.

---

# PART 2 — USE CASE DIAGRAM CONTENT

## Actors

1. **Customer**
2. **Farmer**
3. **Admin (Staff)**
4. **Super Admin**
5. **Guest (Unregistered Visitor)**

## Use Cases per Actor

### Guest (Unregistered Visitor)
- Browse Products
- Search Products
- Filter Products by Category
- View Product Details
- View Farmer Shop Profile
- Add to Cart (Guest Cart)
- View Featured Products
- Submit Contact Form
- Register Account
- Login
- Forgot Password / Reset Password
- View Announcements

### Customer
- Login
- Logout
- Browse Products
- Search Products
- Filter Products by Category
- View Product Details
- View Similar Sellers
- Add to Cart
- Update Cart Quantity
- Remove Cart Item
- Clear Cart
- Migrate Guest Cart to User Cart
- Add to Wishlist
- Remove from Wishlist
- View Wishlist
- Checkout / Place Order
- View Orders
- View Order Details
- Cancel Order
- Track Order Status
- Submit Product Review
- Edit Review
- Delete Review
- View Notifications
- Mark Notification as Read
- Mark All Notifications as Read
- Start Conversation with Farmer
- Send Message
- View Conversations
- View Messages
- Mark Messages as Read
- View Unread Message Count
- Manage Addresses (Add, Edit, Delete, Set Default)
- Update Profile
- Change Password
- View Announcements
- Create Support Ticket
- Request Verification

### Farmer
- Login
- Logout
- View Dashboard / Overview Stats
- View Metrics (Charts)
- View Time-Series Report
- Export Metrics as CSV
- Add Product
- Edit Product
- Delete Product
- Update Harvest Date
- Convert Pre-orders to Stock
- Complete Harvest Lifecycle
- Resubmit Rejected Product
- View Product Requests (My Requests)
- Request Custom Product Name (Category Request)
- View Category Request History
- View Orders (Farmer Orders)
- Update Order Status
- Set Delivery Date
- Cancel Order (Farmer)
- Rate Customer
- View Reviews (for own products)
- Update Shop Profile (banner, avatar, description, shop name)
- Request Verification
- View Verification Request Status
- Message Customers
- View Conversations
- Send Message
- View Notifications
- View Subscription Status
- Request Subscription (Premium)
- View Subscription History
- Create Support Ticket
- View Announcements

### Admin (Staff)
- Login
- Logout
- View Dashboard Statistics
- View Dashboard Report (Time-Series)
- View Top Products
- View Top Farmers
- View Recent Activity (Audit Logs)
- View Suspicious Patterns
- Manage Users (View, Create, Edit, Disable, Enable, Suspend)
- Generate Temporary Password for User
- Verify/Unverify Users
- Review Verification Requests
- Update Farmer Shop Profile
- Manage Products (View, Edit, Assign Farmer, Approve, Reject, Disable, Enable, Delete)
- Manage Orders (View, Update Status, Disable, Enable, View Details)
- Manage Categories (View, Create, Edit, Disable, Enable, Delete [super_admin only])
- Manage Catalog Names (View, Create, Edit, Disable/Enable, Set Average Price, Delete [super_admin only])
- Review Category Requests (Approve/Reject custom product names)
- View Audit Logs
- View Customer Summary
- View Farmer Summary
- Manage Payment Accounts (View, Create, Edit, Delete)
- View Support Tickets
- Respond to Support Tickets
- View Announcements

### Super Admin
- All Admin use cases, plus:
- Manage Platform Settings
- Manage Feature Flags (Toggle)
- Broadcast Announcements
- Create Any User Role (including Admin)
- Edit Any User
- Disable Any User
- Delete Categories
- Delete Catalog Names
- Toggle Debug Mode for Users
- View System Status (External Services)
- Manage Activity Monitor Settings
- Trigger Activity Log Cleanup
- View Activity Monitor Storage Stats
- View Online Users Count
- View Errors Today Count
- View Activity Monitor Dashboard

## Shared Use Cases

- **Login** — Customer, Farmer, Admin, Super Admin
- **Logout** — Customer, Farmer, Admin, Super Admin
- **View Notifications** — Customer, Farmer
- **Send Message** — Customer, Farmer
- **View Conversations** — Customer, Farmer
- **Update Profile** — Customer, Farmer (via `/auth/profile`)
- **Change Password** — Customer, Farmer, Admin, Super Admin
- **Create Support Ticket** — Customer, Farmer
- **Request Verification** — Customer, Farmer
- **View Announcements** — All actors (public endpoint)
- **View Dashboard** — Admin, Super Admin (Activity Monitor)
- **Update Order Status** — Farmer, Admin, Super Admin
- **Cancel Order** — Customer, Farmer, Admin, Super Admin (with role-based rules)

## <<include>> Relationships

- **Checkout** <<include>> **Authentication** (user must be logged in to checkout)
- **Place Order** <<include>> **Cart Validation** (cart must have items)
- **Submit Review** <<include>> **Authentication** (must be logged in)
- **Submit Review** <<include>> **Order Delivered Check** (order must be delivered to review)
- **Rate Customer** <<include>> **Order Delivered Check** (farmer can only rate after delivery)
- **Approve Product** <<include>> **Product Approval Flag Check** (only if `require_product_approval` is enabled)
- **Manage Categories** <<include>> **Admin Authentication**
- **Manage Platform Settings** <<include>> **Super Admin Authentication**
- **Broadcast Announcement** <<include>> **Announcements Enabled Flag**
- **Create Support Ticket** <<include>> **Authentication**

## <<extend>> Relationships

- **Register** <<extend>> **OTP Verification** (if OTP mode is enabled)
- **Login** <<extend>> **OTP Verification** (if OTP mode is strict)
- **Login** <<extend>> **reCAPTCHA Verification** (if reCAPTCHA mode is enabled)
- **Register** <<extend>> **reCAPTCHA Verification** (if reCAPTCHA mode is enabled)
- **Add Product** <<extend>> **Product Approval Workflow** (if `require_product_approval` flag is on, product goes to pending)
- **View Product Details** <<extend>> **View Similar Sellers** (optional, shown on product details modal)
- **View Product Details** <<extend>> **View Reviews** (shown on product details)
- **Complete Harvest** <<extend>> **Create Available Product** (optionally create a new available product from harvested pre-order)
- **Cancel Order** <<extend>> **Restore Inventory** (inventory is automatically restored on cancellation)
- **Deliver Order** <<extend>> **Update Statistics** (sales_count, total_sales, total_revenue updated on delivery)

## Actor Relationships

- **Customer** interacts with **Farmer** via messaging and orders.
- **Farmer** interacts with **Customer** via messaging, order fulfillment, and customer ratings.
- **Admin** manages **Farmer** and **Customer** accounts (verification, disable/enable, profile edits).
- **Super Admin** manages **Admin** accounts (role assignment, debug mode).
- **Super Admin** has all capabilities of **Admin**.
- **Guest** becomes **Customer** or **Farmer** upon registration.

## What Should NOT Appear in the Use Case Diagram

- Internal middleware operations (JWT verification, rate limiting, CORS handling)
- Database connection management
- Cloudinary upload internals
- Activity logging (background process, not a user-facing use case)
- Audit log writing (background process)
- SSE connection management (implementation detail)
- Cron job execution (harvest reminders, log cleanup)
- Self-ping mechanism (deployment detail)
- Feature flag checking (internal mechanism)
- Session management
- Database migration on startup
- PSGC data loading (internal data serving)

---

# PART 3 — DFD CONTENT

## External Entities

1. **Customer** — Initiates browsing, cart, checkout, reviews, messages.
2. **Farmer** — Creates products, manages orders, updates shop profile.
3. **Admin** — Manages users, products, orders, categories, views analytics.
4. **Super Admin** — Manages platform settings, feature flags, announcements.
5. **Guest** — Browses products, uses guest cart, registers.
6. **Cloudinary Service** — Receives image uploads, returns CDN URLs.
7. **Email Service (Resend/SMTP)** — Receives email requests, sends emails to users.
8. **Google reCAPTCHA Service** — Receives verification tokens, returns validation results.
9. **Supabase (PostgreSQL)** — Receives queries, returns data. *(Note: In a DFD, this is a data store, not an external entity. Listed here for context.)*

## Data Stores

1. **DS1: users** — User accounts (customers, farmers, admins, super admins).
2. **DS2: products** — Product listings with stock, pre-order, harvest, and approval fields.
3. **DS3: categories** — Product categories.
4. **DS4: cart** — Shopping cart items (user or session-based).
5. **DS5: orders** — Order records (per-item, with status, pre-order fields).
6. **DS6: reviews** — Product reviews with ratings.
7. **DS7: customer_ratings** — Farmer-to-customer ratings per delivered order.
8. **DS8: wishlist** — User wishlist items.
9. **DS9: notifications** — In-app notifications.
10. **DS10: conversations** — Chat conversation metadata.
11. **DS11: messages** — Chat messages between users.
12. **DS12: user_addresses** — User delivery addresses.
13. **DS13: otps** — One-time passwords for verification.
14. **DS14: password_resets** — Password reset tokens/OTP.
15. **DS15: feature_flags** — Feature toggle settings.
16. **DS16: platform_settings** — Platform-wide configuration key-value pairs.
17. **DS17: admin_audit_logs** — Admin action audit trail.
18. **DS18: activity_logs** — User activity monitoring logs.
19. **DS19: activity_monitor_settings** — Activity monitor configuration.
20. **DS20: product_name_catalog** — Approved product name catalog.
21. **DS21: product_name_requests** — Farmer custom product name requests.
22. **DS22: verification_requests** — Farmer/customer verification requests.
23. **DS23: farmer_subscriptions** — Farmer subscription records.
24. **DS24: payment_accounts** — GCash/bank payment accounts.
25. **DS25: featured_products** — Admin-curated featured products.
26. **DS26: announcements** — Platform-wide announcements.
27. **DS27: support_tickets** — Support ticket records.
28. **DS28: support_ticket_messages** — Messages within support tickets.

## Processes

### Process 1: User Authentication & Account Management
- **Inputs**: Credentials (email, password), registration data, OTP, reCAPTCHA token, profile update data.
- **Outputs**: JWT token, user profile data, error messages, OTP email.
- **Database tables involved**: users, otps, password_resets, feature_flags, platform_settings.
- **APIs involved**: `/api/auth/*`, `/api/otp/*`.
- **Description**: Handles registration, login, logout, OTP send/verify, password reset, profile view/update, change password.

### Process 2: Product Management
- **Inputs**: Product data (name, price, stock, category, image), product ID, search/filter parameters.
- **Outputs**: Product listings, product details, category list, catalog names, featured products, pricing suggestions.
- **Database tables involved**: products, categories, product_name_catalog, product_name_requests, featured_products, users (farmer info).
- **APIs involved**: `/api/products/*`.
- **Description**: Handles product CRUD, search, filter, sort, categories, catalog, featured products, harvest lifecycle, pre-order conversion.

### Process 3: Cart Management
- **Inputs**: Product ID, quantity, session ID, JWT token.
- **Outputs**: Cart items with product details, updated cart.
- **Database tables involved**: cart, products, users.
- **APIs involved**: `/api/cart/*`.
- **Description**: Handles cart retrieval, add/update/remove items, clear cart, guest-to-user cart migration.

### Process 4: Order Management
- **Inputs**: Order data (product, quantity, address), order ID, status update, cancellation request.
- **Outputs**: Order records, order details, status updates, delivery date.
- **Database tables involved**: orders, products, users, notifications.
- **APIs involved**: `/api/orders/*`.
- **Description**: Handles order creation, retrieval, status updates (via transition matrix), cancellation with inventory restoration, delivery date setting, farmer order views.

### Process 5: Wishlist Management
- **Inputs**: Product ID, JWT token.
- **Outputs**: Wishlist items, add/remove confirmation.
- **Database tables involved**: wishlist, products.
- **APIs involved**: `/api/wishlist/*`.
- **Description**: Handles wishlist view, add, remove.

### Process 6: Review & Rating Management
- **Inputs**: Product ID, rating, comment, order ID, customer rating data.
- **Outputs**: Reviews list, rating eligibility, customer rating, farmer reviews.
- **Database tables involved**: reviews, customer_ratings, products, orders, users.
- **APIs involved**: `/api/reviews/*`.
- **Description**: Handles product review CRUD, eligibility checks, farmer-to-customer ratings.

### Process 7: Messaging
- **Inputs**: Message content, conversation ID, recipient ID.
- **Outputs**: Conversations list, messages, unread counts.
- **Database tables involved**: conversations, messages, users.
- **APIs involved**: `/api/messages/*`.
- **Description**: Handles conversation listing, message sending, message history, read status, unread counts.

### Process 8: Notification Management
- **Inputs**: User ID, notification ID.
- **Outputs**: Notifications list, read status updates.
- **Database tables involved**: notifications.
- **APIs involved**: `/api/notifications/*`, `/api/events` (SSE).
- **Description**: Handles notification retrieval, mark as read, mark all as read, real-time SSE delivery.

### Process 9: Address Management
- **Inputs**: Address data (street, city, province, barangay, contact), address ID.
- **Outputs**: Address list, default address.
- **Database tables involved**: user_addresses.
- **APIs involved**: `/api/addresses/*`.
- **Description**: Handles address CRUD and default address setting.

### Process 10: Farmer Dashboard & Analytics
- **Inputs**: JWT token, period filter.
- **Outputs**: Dashboard stats, metrics, time-series report, CSV export.
- **Database tables involved**: products, orders, users, reviews.
- **APIs involved**: `/api/farmers/me/*`, `/api/farmers/:id/profile`.
- **Description**: Handles farmer overview, metrics, reports, CSV export, shop profile management, verification requests.

### Process 11: Admin Dashboard & Management
- **Inputs**: Admin JWT, user/product/order/category data, filters, pagination.
- **Outputs**: User lists, product lists, order lists, categories, catalog names, dashboard stats, analytics, audit logs, suspicious patterns.
- **Database tables involved**: users, products, orders, categories, product_name_catalog, product_name_requests, verification_requests, admin_audit_logs, payment_accounts, support_tickets.
- **APIs involved**: `/api/admin/*`.
- **Description**: Handles all admin management operations including users, products, orders, categories, catalog, analytics, audit logs, verification, payment accounts.

### Process 12: Super Admin Platform Management
- **Inputs**: Super Admin JWT, platform settings, feature flag toggles, announcement data.
- **Outputs**: Platform settings, feature flags, announcements, system status, activity monitor data.
- **Database tables involved**: platform_settings, feature_flags, announcements, activity_monitor_settings, activity_logs, users.
- **APIs involved**: `/api/superadmin/*`, `/api/activity-monitor/*`.
- **Description**: Handles platform settings, feature flags, announcements, user creation (any role), system status, activity monitor.

### Process 13: File Upload & Cloudinary Integration
- **Inputs**: Image file (multipart/form-data), upload type.
- **Outputs**: Cloudinary URL, public ID.
- **Database tables involved**: products, users (shop profile fields).
- **APIs involved**: `/api/upload/*`.
- **Description**: Handles product image, shop banner, shop avatar, verification document, and payment proof uploads via Multer + Cloudinary.

### Process 14: Subscription Management
- **Inputs**: Subscription request data, payment proof file, plan duration.
- **Outputs**: Subscription status, history, settings.
- **Database tables involved**: farmer_subscriptions, payment_accounts, users.
- **APIs involved**: `/api/subscriptions/*`, `/api/admin/payment-accounts/*`.
- **Description**: Handles subscription settings, farmer subscription status, subscription requests with payment proof, subscription history.

### Process 15: Support Ticket Management
- **Inputs**: Ticket subject, description, priority, ticket ID, message content.
- **Outputs**: Ticket creation confirmation, ticket list, ticket details, messages.
- **Database tables involved**: support_tickets, support_ticket_messages.
- **APIs involved**: `/api/support-tickets/*`.
- **Description**: Handles ticket creation by customers/farmers, ticket viewing and response by admins.

### Process 16: PSGC (Geographic Data)
- **Inputs**: Zone filter, province/city selection.
- **Outputs**: Provinces, cities, barangays (Luzon regions only).
- **Database tables involved**: None (reads from local PSGC JSON data files).
- **APIs involved**: `/api/psgc/*`.
- **Description**: Serves Philippine Standard Geographic Code data for address dropdowns.

### Process 17: Contact Form
- **Inputs**: Name, email, subject, message.
- **Outputs**: Confirmation message.
- **Database tables involved**: None (sends email via email service).
- **APIs involved**: `/api/contact`.
- **Description**: Handles public contact form submissions and sends email.

## Data Flows

### Context Diagram Entities

- **Customer/Guest** → System (browse, cart, checkout, reviews, messages, account management)
- **Farmer** → System (products, orders, shop, analytics, messages, subscriptions)
- **Admin** → System (user management, product management, order management, analytics, audit)
- **Super Admin** → System (platform settings, feature flags, announcements, system status)
- **Cloudinary** ← System (image uploads)
- **Email Service (Resend/SMTP)** ← System (OTP emails, welcome emails, password reset emails)
- **Google reCAPTCHA** ← System (token verification)

### Context Diagram Data Flows

1. Customer/Guest → System: Browse/search request, cart operations, checkout, registration, login
2. System → Customer/Guest: Product listings, cart data, order confirmation, notifications, JWT
3. Farmer → System: Product CRUD, order updates, shop profile, analytics requests
4. System → Farmer: Product data, orders, dashboard stats, notifications, JWT
5. Admin → System: Management requests (users, products, orders, categories)
6. System → Admin: Management data, analytics, audit logs
7. Super Admin → System: Platform settings, feature flags, announcements
8. System → Super Admin: Platform data, system status, activity monitor
9. System → Cloudinary: Image upload request
10. Cloudinary → System: CDN URL, public ID
11. System → Email Service: Email send request (OTP, welcome, password reset)
12. Email Service → User: Email delivery
13. System → Google reCAPTCHA: Token verification request
14. Google reCAPTCHA → System: Verification result

### Level 0 Processes (Summary)

1. **1.0 User Authentication & Account Management**
2. **2.0 Product Management**
3. **3.0 Cart Management**
4. **4.0 Order Management**
5. **5.0 Wishlist Management**
6. **6.0 Review & Rating Management**
7. **7.0 Messaging**
8. **8.0 Notification Management**
9. **9.0 Address Management**
10. **10.0 Farmer Dashboard & Analytics**
11. **11.0 Admin Dashboard & Management**
12. **12.0 Super Admin Platform Management**
13. **13.0 File Upload & Cloudinary Integration**
14. **14.0 Subscription Management**
15. **15.0 Support Ticket Management**
16. **16.0 PSGC Geographic Data Service**
17. **17.0 Contact Form Handler**

### Recommended Level 1 Breakdown

**Level 1 for Process 1.0 (User Authentication):**
- 1.1 Register User (with reCAPTCHA, OTP)
- 1.2 Login User (with reCAPTCHA, OTP, disabled check)
- 1.3 Verify OTP
- 1.4 Forgot Password (send OTP)
- 1.5 Reset Password (verify OTP, update)
- 1.6 View/Update Profile
- 1.7 Change Password

**Level 1 for Process 2.0 (Product Management):**
- 2.1 List Products (with filter, search, sort, pagination)
- 2.2 View Product Details
- 2.3 Create Product (farmer, with image upload, approval check)
- 2.4 Update Product
- 2.5 Delete Product
- 2.6 Manage Categories & Catalog
- 2.7 Harvest Lifecycle (update harvest date, convert pre-orders, complete harvest)
- 2.8 Product Approval Workflow (resubmit, admin approve/reject)

**Level 1 for Process 4.0 (Order Management):**
- 4.1 Create Order (checkout, inventory decrement/reserve)
- 4.2 View Orders (customer, farmer, admin)
- 4.3 Update Order Status (transition matrix validation)
- 4.4 Cancel Order (role-based, inventory restoration)
- 4.5 Set Delivery Date

**Level 1 for Process 11.0 (Admin Dashboard & Management):**
- 11.1 Manage Users (CRUD, verify, disable/enable, suspend)
- 11.2 Manage Products (approve/reject, assign, disable, edit, delete)
- 11.3 Manage Orders (status, disable/enable)
- 11.4 Manage Categories (CRUD, disable/enable, delete)
- 11.5 Manage Catalog Names (CRUD, disable/enable, average price)
- 11.6 Review Category Requests
- 11.7 Dashboard Analytics (stats, report, top products, top farmers, recent activity)
- 11.8 View Audit Logs
- 11.9 Manage Payment Accounts

---

# PART 4 — SYSTEM ARCHITECTURE CONTENT

## Frontend Pages

| Page | File | Purpose |
|------|------|---------|
| Landing/Home | `frontend/index.html` | Product browsing, featured products, search, filter, login/register modals |
| Farmer Dashboard | `frontend/farmer.html` | Farmer product management, orders, reviews, shop, chat, analytics |
| Admin Dashboard | `frontend/admin.html` | Admin management (users, products, orders, categories, catalog, analytics, audit logs) |
| Customer Account | `frontend/customer-account.html` | Customer profile, orders, addresses, wishlist |
| Chat | `frontend/chat.html` | Standalone messaging page |
| 404 | `frontend/404.html` | Not found page |

## Frontend JavaScript Modules

| Module | File | Purpose |
|--------|------|---------|
| App Core | `frontend/js/app.js` | Core app logic, auth state, UI helpers, product loading, cart badge, modals |
| Admin | `frontend/js/admin.js` | Admin dashboard logic, user/product/order management, analytics, charts |
| Admin Charts | `frontend/js/admin-charts.js` | Chart rendering for admin dashboard (ApexCharts/Chart.js) |
| Farmer | `frontend/js/farmer.js` | Farmer dashboard logic, product CRUD, order management, shop profile, chat |
| Farmers (Public) | `frontend/js/farmers.js` | Public farmer listing and shop profile view |
| Product | `frontend/js/product.js` | Product details modal, add to cart, reviews, similar sellers |
| Cart/Checkout | `frontend/js/checkout.js` | Cart management, checkout flow, order placement |
| Orders | `frontend/js/orders.js` | Order listing, order details, status tracking |
| Wishlist | `frontend/js/wishlist.js` | Wishlist management |
| Customer Account | `frontend/js/customer-account.js` | Customer profile, addresses, order history |
| Chat | `frontend/js/chat.js` | Real-time messaging, conversations, SSE |
| Addresses | `frontend/js/addresses.js` | Address CRUD, PSGC dropdowns |
| PSGC | `frontend/js/psgc.js` | Philippine Standard Geographic Code data fetching for address dropdowns |
| Support Ticket Chat | `frontend/js/support-ticket-chat.js` | Support ticket messaging |
| Config | `frontend/js/config.js` | reCAPTCHA site key configuration |

## Frontend CSS

| File | Purpose |
|------|---------|
| `frontend/css/nicemain.css` | Main application styles |
| `frontend/css/admin.css` | Admin dashboard styles |
| `frontend/css/agricatch-admin.css` | Shared admin/farmer dashboard styles |
| `frontend/css/agricatch-polish.css` | UI polish and refinements |
| `frontend/css/styles.css` | Additional styles (if present) |

## Frontend Vendor Libraries

| Library | Purpose |
|---------|---------|
| Bootstrap 5.3.3 | UI framework (grid, components, modals) |
| Bootstrap Icons | Icon set |
| Font Awesome | Additional icons |
| Simple-DataTables | Data table rendering for admin/farmer dashboards |
| ApexCharts / Chart.js | Dashboard charts |

## Backend Routes (Controllers)

| Route Module | Mount Path | Purpose |
|-------------|-----------|---------|
| `auth.js` | `/api/auth` | Authentication, profile, password management |
| `otp.js` | `/api/otp` | OTP send/verify |
| `products.js` | `/api/products` | Product CRUD, search, categories, catalog, harvest lifecycle |
| `reviews.js` | `/api/reviews` | Product reviews, customer ratings |
| `cart.js` | `/api/cart` | Shopping cart management |
| `wishlist.js` | `/api/wishlist` | Wishlist management |
| `orders.js` | `/api/orders` | Order management, status, cancellation |
| `notifications.js` | `/api/notifications` | Notification management |
| `messages.js` | `/api/messages` | Chat messaging |
| `addresses.js` | `/api/addresses` | Address management |
| `admin.js` | `/api/admin` | Admin management (users, products, orders, categories, catalog, analytics, audit) |
| `superadmin.js` | `/api/superadmin` | Super admin (settings, flags, announcements, user creation, system status) |
| `activityMonitor.js` | `/api/activity-monitor` | Activity monitor dashboard, SSE stream, settings, cleanup |
| `subscriptions.js` | `/api/subscriptions` | Farmer subscription management |
| `payment-accounts.js` | `/api/admin/payment-accounts` | Payment account CRUD (admin) |
| `settings.js` | `/api/settings` | Public platform settings (delivery fee, product limits, reCAPTCHA mode) |
| `psgc.js` | `/api/psgc` | Philippine geographic data (provinces, cities, barangays) |
| `upload.js` | `/api/upload` | File uploads (product images, banners, avatars, verification docs, payment proofs) |
| `contact.js` | `/api/contact` | Contact form submission |
| `farmers.js` | `/api/farmers` | Farmer public profile, dashboard stats, metrics, shop profile, verification, harvest pre-order |
| `support-tickets.js` | `/api/support-tickets` | Support ticket CRUD and messaging |
| `health.js` | `/_health` | Health check endpoint |

## Backend Middleware

| Middleware | File | Purpose |
|-----------|------|---------|
| CORS | (inline in `server.js`) | Cross-origin resource sharing configuration |
| JSON Parser | (Express built-in) | Parse JSON request bodies |
| URL-encoded Parser | (Express built-in) | Parse URL-encoded request bodies |
| Cookie Parser | `cookie-parser` | Parse cookies |
| Session | `express-session` | Session management |
| Rate Limiter | `express-rate-limit` | Rate limiting for auth and OTP endpoints |
| Authenticate Token | `middleware/authenticateToken.js` | JWT verification, populates `req.user` |
| Require Role | `middleware/requireRole.js` | Role-based access control |
| Feature Flags | `middleware/featureFlags.js` | Maintenance mode, registration toggle, announcements toggle, price drop alerts, product approval |
| Log Activity | `middleware/logActivity.js` | User activity logging |
| Upload (Multer) | `middleware/upload.js` | File upload handling (product, banner, avatar, payment proof) |

## Backend Services

| Service | File | Purpose |
|---------|------|---------|
| Activity Logger | `services/activityLogger.js` | Centralized user activity logging to database |
| Browser Parser | `services/browserParser.js` | Parse user agent strings for activity logs |
| IP Geolocation | `services/ipGeolocation.js` | IP-based geolocation for activity logs |

## Backend Utilities

| Utility | File | Purpose |
|---------|------|---------|
| Database | `utils/db.js` | PostgreSQL connection pool, platform settings cache |
| Cloudinary | `utils/cloudinary.js` | Cloudinary configuration, upload helpers, public ID generation |
| Email Service | `utils/emailService.js` | Email sending (Resend API preferred, SMTP fallback) |
| Realtime | `utils/realtime.js` | SSE client management, event broadcasting |
| Order Transitions | `utils/orderTransitions.js` | Order status transition matrix, validation |
| Order Business Logic | `utils/orderBusinessLogic.js` | Inventory restoration on cancel, statistics update on deliver |
| Audit Log | `utils/auditLog.js` | Admin audit log table creation and writing |
| Admin Cache | `utils/adminCache.js` | In-memory cache for admin dashboard data |
| Recaptcha | `utils/recaptcha.js` | Google reCAPTCHA token verification |
| DB Migrations | `utils/dbMigrations.js` | Database schema migration helpers |
| File Utils | `utils/fileUtils.js` | File system utilities |

## Database

- **Provider**: PostgreSQL on Supabase
- **Connection**: Via `DATABASE_URL` or individual env vars
- **Driver**: `pg` (node-postgres) with connection pooling
- **SSL**: Auto-enabled for Supabase/Render hosts
- **Timezone**: UTC

## Authentication

- **Method**: JWT (JSON Web Tokens)
- **Token Generation**: On successful login/registration
- **Token Verification**: `authenticateToken` middleware
- **Password Hashing**: `bcryptjs` (10 rounds default)
- **OTP**: Generated via `crypto.randomInt`, stored in `otps` table, sent via email
- **Session**: `express-session` for session-based features
- **Role-Based Access**: `requireRole` middleware checks `req.user.role`

## Hosting

- **Frontend**: Vercel (static hosting)
- **Backend**: Render (Node.js web service)
- **Database**: Supabase (PostgreSQL)
- **Image Storage**: Cloudinary
- **Email**: Resend API (preferred) / SMTP (fallback)

## External APIs

1. **Cloudinary API** — Image upload, storage, CDN delivery
2. **Resend API** — Email delivery (OTP, welcome, password reset)
3. **Google reCAPTCHA API** — Bot protection verification
4. **Supabase PostgreSQL** — Database queries

## Deployment

- **Render YAML**: `render.yaml` defines a cron job for self-ping every 5 minutes
- **Self-Ping**: `scripts/self_ping.js` pings `/_health` to prevent Render free tier sleep
- **Environment Variables**: `JWT_SECRET`, `SESSION_SECRET`, `DATABASE_URL`, `CLOUDINARY_URL` (or individual Cloudinary vars), `RESEND_API_KEY`, `RECAPTCHA_SECRET_KEY`, `FRONTEND_URL`, `RENDER_EXTERNAL_URL`, `PORT`

## Request Flow

```
Browser (User)
    ↓ HTTP Request
Frontend (HTML/JS on Vercel)
    ↓ fetch() / XMLHttpRequest / EventSource (SSE)
REST API (/api/*)
    ↓
Express Server (server.js on Render)
    ↓
Middleware Pipeline:
    CORS → JSON Parser → URL-encoded Parser → Cookie Parser → Session → Rate Limiter → AuthenticateToken → RequireRole → FeatureFlags → LogActivity → Upload(Multer)
    ↓
Route Handler (routes/*.js)
    ↓
Business Logic / Utilities (utils/*.js, services/*.js)
    ↓
Database Query (pool.query → PostgreSQL on Supabase)
    ↓
[Optional] External Service Call:
    Cloudinary (image upload)
    Resend (email send)
    Google reCAPTCHA (token verify)
    ↓
Response (JSON)
    ↓
Express Response
    ↓
Frontend JS (process response, update DOM)
    ↓
Browser (User sees result)
```

### Real-time Flow (SSE)

```
Browser (EventSource)
    ↓ HTTP GET /api/events (SSE connection)
Express Server
    ↓ addSseClient()
SSE Client Set (in-memory)
    ↓
[Event occurs: order update, notification, product update, admin audit]
    ↓ broadcastEvent(event, data)
SSE Clients
    ↓ res.write("event: ...\ndata: ...\n\n")
Browser (EventSource.onmessage)
    ↓ Update UI (notifications, cart badge, etc.)
```

---

# PART 5 — DATABASE

## Tables in Schema (from `database/schema.sql`)

### 1. users
- **Purpose**: Stores all user accounts (customers, farmers, admins, super admins).
- **Key Columns**: id, username, email, password (bcrypt hash), role, full_name, first_name, middle_name, last_name, phone, address, is_verified, is_disabled, disable_type, disabled_reason, shop_name, shop_description, shop_avatar_url, shop_banner_url, average_rating, total_reviews, customer_average_rating, total_sales, total_revenue, sales_count, created_at.
- **Relationships**: Referenced by products (farmer_id), orders (user_id), reviews (user_id), cart (user_id), wishlist (user_id), notifications (user_id), conversations (user1_id, user2_id), messages (sender_id), user_addresses (user_id), otps (email), password_resets (user_id), admin_audit_logs (actor_admin_id), activity_logs (user_id), verification_requests (farmer_id), farmer_subscriptions (farmer_id), featured_products (farmer_id), support_tickets (farmer_id).

### 2. categories
- **Purpose**: Product categories (e.g., Vegetables, Fruits, Fishery).
- **Key Columns**: id, name, description, type, is_disabled, created_at.
- **Relationships**: Referenced by products (category_id), product_name_catalog (category_id), product_name_requests (category_id).

### 3. products
- **Purpose**: Product listings created by farmers.
- **Key Columns**: id, farmer_id, category_id, name, description, price, stock_quantity, unit, image_url, cloudinary_public_id, is_available, is_preorder, preorder_availability_date, max_preorder_quantity, reserved_quantity, harvest_date, sales_count, status (pending/approved/rejected), rejection_reason, is_admin_disabled, admin_disabled_at, created_at.
- **Relationships**: FK to users (farmer_id), FK to categories (category_id). Referenced by orders (product_id), cart (product_id), wishlist (product_id), reviews (product_id), featured_products (product_id).

### 4. cart
- **Purpose**: Shopping cart items for users and guest sessions.
- **Key Columns**: id, user_id, session_id, product_id, quantity, created_at.
- **Relationships**: FK to users (user_id), FK to products (product_id).

### 5. orders
- **Purpose**: Order records (per-item orders, not multi-item carts).
- **Key Columns**: id, user_id, product_id, quantity, price, total_amount, status, is_preorder, preorder_converted_at, preorder_fulfilled_quantity, preorder_reserved_quantity, delivery_date, delivered_at, is_disabled, reason, created_at, updated_at.
- **Relationships**: FK to users (user_id), FK to products (product_id).
- **Status Values**: pending, accepted, preorder_reserved, confirmed, preparing, scheduled, out_for_delivery, delivered, completed, cancelled.

### 6. reviews
- **Purpose**: Product reviews submitted by customers.
- **Key Columns**: id, product_id, user_id, rating (1-5), comment, created_at.
- **Relationships**: FK to products (product_id), FK to users (user_id).

### 7. customer_ratings
- **Purpose**: Farmer-to-customer ratings per delivered order.
- **Key Columns**: id, order_id, farmer_id, customer_id, rating, comment, created_at.
- **Relationships**: FK to orders (order_id), FK to users (farmer_id, customer_id).

### 8. wishlist
- **Purpose**: User wishlist items.
- **Key Columns**: id, user_id, product_id, created_at.
- **Relationships**: FK to users (user_id), FK to products (product_id).

### 9. notifications
- **Purpose**: In-app notifications for users.
- **Key Columns**: id, user_id, type, title, message, is_read, created_at.
- **Relationships**: FK to users (user_id).

### 10. conversations
- **Purpose**: Chat conversation metadata between two users.
- **Key Columns**: id, user1_id, user2_id, created_at.
- **Relationships**: FK to users (user1_id, user2_id). Referenced by messages (conversation_id).

### 11. messages
- **Purpose**: Individual chat messages within conversations.
- **Key Columns**: id, conversation_id, sender_id, message, is_read, created_at.
- **Relationships**: FK to conversations (conversation_id), FK to users (sender_id).

### 12. user_addresses
- **Purpose**: User delivery addresses.
- **Key Columns**: id, user_id, recipient_name, phone, street, city, province, barangay, postal_code, is_default, created_at.
- **Relationships**: FK to users (user_id).

### 13. otps
- **Purpose**: One-time passwords for email/phone verification.
- **Key Columns**: id, email, otp_code, purpose, expires_at, created_at.
- **Relationships**: None (lookup by email).

### 14. password_resets
- **Purpose**: Password reset OTP records.
- **Key Columns**: id, user_id, email, otp_code, expires_at, used, created_at.
- **Relationships**: FK to users (user_id).

### 15. feature_flags
- **Purpose**: Database-driven feature toggles.
- **Key Columns**: key, name, description, enabled, updated_at.
- **Known Flags**: require_product_approval, allow_registrations, maintenance_mode, announcements_enabled, price_drop_alerts_enabled.

### 16. platform_settings
- **Purpose**: Platform-wide configuration key-value pairs.
- **Key Columns**: key (PK), value, updated_by, updated_at.
- **Known Settings**: otp_mode, delivery_fee, use_default_delivery_address, max_products_per_farmer, recaptcha_mode, premium_monthly_price, premium_yearly_price.

### 17. admin_audit_logs
- **Purpose**: Audit trail of admin actions.
- **Key Columns**: id, actor_admin_id, actor_admin_email, actor_admin_name, action, entity, entity_id, before (JSONB), after (JSONB), ip_address, user_agent, session_id, created_at.
- **Relationships**: actor_admin_id references users (no FK constraint).

## Tables from Migrations

### 18. activity_logs
- **Purpose**: User activity monitoring logs.
- **Key Columns**: id, session_id, user_id, role, action, entity_type, entity_id, description, current_page, metadata, ip_address, user_agent, created_at.
- **Source**: `database/migrations/create_activity_logs.sql`.

### 19. activity_monitor_settings
- **Purpose**: Configurable settings for the activity monitor.
- **Key Columns**: id, setting_key (unique), setting_value.
- **Source**: `database/migrations/create_activity_monitor_settings.sql`.

### 20. product_name_catalog
- **Purpose**: Approved product name catalog for standardized product creation.
- **Key Columns**: id, category_id, name (unique), is_approved, source, is_disabled, default_unit, admin_set_average_price, reviewed_by, reviewed_at, requested_by, created_at.
- **Relationships**: FK to categories (category_id).
- **Source**: Created in `products.js` and `admin.js` (inline migration).

### 21. product_name_requests
- **Purpose**: Farmer requests for custom product names (requires admin approval).
- **Key Columns**: id, category_id, requested_category_name, name, notes, status, review_notes, requested_by, reviewed_by, reviewed_at, created_at.
- **Relationships**: FK to categories (category_id), FK to users (requested_by, reviewed_by).
- **Source**: Created in `products.js` and `admin.js` (inline migration).

### 22. verification_requests
- **Purpose**: Farmer/customer verification requests.
- **Key Columns**: id, farmer_id, status (pending/approved/rejected), rejection_reason, created_at.
- **Relationships**: FK to users (farmer_id).
- **Source**: `database/migrations/run_verification_requests_migration.js`.

### 23. farmer_subscriptions
- **Purpose**: Farmer subscription records (free/premium tiers).
- **Key Columns**: id, farmer_id, tier, plan_duration_months, started_at, expires_at, status, payment_method, payment_account_id, expected_amount, payment_proof_url, reviewed_by, reviewed_at, rejection_reason, created_at.
- **Relationships**: FK to users (farmer_id), FK to payment_accounts (payment_account_id).
- **Source**: `database/migrations/add_farmer_subscriptions.sql`.

### 24. payment_accounts
- **Purpose**: GCash/bank payment accounts for subscription payments.
- **Key Columns**: id, name, account_number, type, is_active, sort_order, created_at.
- **Source**: `database/migrations/add_farmer_subscriptions.sql`.

### 25. featured_products
- **Purpose**: Admin-curated featured products for landing page.
- **Key Columns**: id, product_id, farmer_id, sort_order, created_at.
- **Relationships**: FK to products (product_id), FK to users (farmer_id).
- **Source**: `database/migrations/add_featured_products_table.sql`.

### 26. announcements
- **Purpose**: Platform-wide dismissible announcements/banners.
- **Key Columns**: id, title, message, type, is_active, created_by, created_at, expires_at.
- **Source**: `database/migrations/create_announcements_table.sql`.

### 27. support_tickets
- **Purpose**: Support tickets created by customers/farmers.
- **Key Columns**: id, farmer_id (user_id), subject, description, priority, status, created_at.
- **Relationships**: FK to users (farmer_id).
- **Source**: `database/create_missing_tables.js`, `backend/create_support_tables.js`.

### 28. support_ticket_messages
- **Purpose**: Messages within support tickets.
- **Key Columns**: id, ticket_id, sender_id, message, is_read, created_at.
- **Relationships**: FK to support_tickets (ticket_id), FK to users (sender_id).
- **Source**: `database/create_missing_tables.js`.

## Important Foreign Keys Summary

| Child Table | Column | Parent Table | Column |
|-------------|--------|-------------|--------|
| products | farmer_id | users | id |
| products | category_id | categories | id |
| orders | user_id | users | id |
| orders | product_id | products | id |
| cart | user_id | users | id |
| cart | product_id | products | id |
| reviews | product_id | products | id |
| reviews | user_id | users | id |
| customer_ratings | order_id | orders | id |
| customer_ratings | farmer_id | users | id |
| customer_ratings | customer_id | users | id |
| wishlist | user_id | users | id |
| wishlist | product_id | products | id |
| notifications | user_id | users | id |
| conversations | user1_id | users | id |
| conversations | user2_id | users | id |
| messages | conversation_id | conversations | id |
| messages | sender_id | users | id |
| user_addresses | user_id | users | id |
| password_resets | user_id | users | id |
| product_name_catalog | category_id | categories | id |
| product_name_requests | category_id | categories | id |
| verification_requests | farmer_id | users | id |
| farmer_subscriptions | farmer_id | users | id |
| farmer_subscriptions | payment_account_id | payment_accounts | id |
| featured_products | product_id | products | id |
| featured_products | farmer_id | users | id |
| support_tickets | farmer_id | users | id |
| support_ticket_messages | ticket_id | support_tickets | id |
| support_ticket_messages | sender_id | users | id |

---

# PART 6 — API INVENTORY

## Authentication (`/api/auth`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/auth/otp-mode` | Public | Get current OTP mode setting |
| GET | `/api/auth/check-username/:username` | Public | Check username availability |
| POST | `/api/auth/register` | Public (registrations flag) | Register new user (customer/farmer) |
| POST | `/api/auth/login` | Public | Login user |
| POST | `/api/auth/recover-admin` | Public (admin secret) | Recover admin role |
| POST | `/api/auth/logout` | Auth | Logout user |
| GET | `/api/auth/profile` | Auth | Get current user profile |
| GET | `/api/auth/me` | Auth | Alias for /profile |
| PUT | `/api/auth/profile` | Auth | Update user profile |
| POST | `/api/auth/forgot` | Public | Request password reset OTP |
| POST | `/api/auth/forgot/resend` | Public | Resend password reset OTP |
| POST | `/api/auth/forgot/verify-otp` | Public | Verify password reset OTP |
| POST | `/api/auth/forgot/reset` | Public | Reset password with OTP |
| PUT | `/api/auth/change-password` | Auth | Change password (authenticated) |
| GET | `/api/auth/feature-flags` | Public | Get public feature flags |

## OTP (`/api/otp`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/otp/send` | Public | Send OTP to email |
| POST | `/api/otp/verify` | Public | Verify OTP code |

## Products (`/api/products`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/products/` | Public | Get all products (paginated, filtered, sorted) |
| GET | `/api/products/categories` | Public | Get farm categories |
| POST | `/api/products/category-requests` | Farmer | Request custom product name |
| GET | `/api/products/category-requests/mine` | Farmer | Get my category requests |
| GET | `/api/products/requests/mine` | Farmer | Alias for category requests |
| GET | `/api/products/product-requests/mine` | Farmer | Get pending/rejected products |
| GET | `/api/products/catalog/names` | Public | Get product name catalog |
| GET | `/api/products/previous-values` | Farmer | Get previous product values for auto-fill |
| GET | `/api/products/pricing/suggestion` | Farmer | Get suggested pricing |
| GET | `/api/products/featured` | Public | Get featured products |
| GET | `/api/products/:id` | Public | Get single product by ID |
| GET | `/api/products/:id/current-active` | Public | Get current active product (lifecycle) |
| GET | `/api/products/:id/similar-sellers` | Public | Get similar products from other farmers |
| POST | `/api/products/:id/resubmit` | Farmer | Resubmit rejected product |
| GET | `/api/products/farmer/:farmerId` | Public | Get products by farmer |
| POST | `/api/products/` | Farmer | Add new product |
| PUT | `/api/products/:id/harvest-date` | Farmer | Update harvest date |
| PUT | `/api/products/:id` | Farmer | Update product |
| POST | `/api/products/:id/convert-preorders` | Farmer | Convert pre-orders to stock |
| POST | `/api/products/:id/harvest-lifecycle` | Farmer | Complete harvest lifecycle |
| DELETE | `/api/products/:id` | Farmer | Delete product |

## Reviews (`/api/reviews`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/reviews/products/:id/reviews/eligibility` | Auth | Check review eligibility |
| GET | `/api/reviews/products/:id/reviews` | Public | Get reviews for a product |
| POST | `/api/reviews/products/:id/reviews` | Auth (Customer) | Create a review |
| PUT | `/api/reviews/reviews/:id` | Auth | Update a review |
| DELETE | `/api/reviews/reviews/:id` | Auth | Delete a review |
| GET | `/api/reviews/orders/:id/customer-rating/eligibility` | Auth (Farmer) | Check customer rating eligibility |
| POST | `/api/reviews/orders/:id/customer-rating` | Auth (Farmer) | Rate customer |
| PUT | `/api/reviews/orders/:id/customer-rating` | Auth (Farmer) | Update customer rating |
| GET | `/api/reviews/mine` | Auth (Farmer) | Get reviews for farmer's products |

## Cart (`/api/cart`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/cart/` | Public (JWT or session) | Get cart items |
| POST | `/api/cart/` | Public (JWT or session) | Add to cart |
| PUT | `/api/cart/:id` | Public (JWT or session) | Update cart item quantity |
| DELETE | `/api/cart/:id` | Public (JWT or session) | Remove cart item |
| DELETE | `/api/cart/` | Public (JWT or session) | Clear cart |
| POST | `/api/cart/migrate` | Auth | Migrate guest cart to user cart |
| POST | `/api/cart/merge` | Auth | Alias for migrate |

## Wishlist (`/api/wishlist`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/wishlist/` | Auth | Get wishlist items |
| POST | `/api/wishlist/` | Auth | Add to wishlist |
| DELETE | `/api/wishlist/:productId` | Auth | Remove from wishlist |

## Orders (`/api/orders`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/orders/` | Auth | Get user orders |
| GET | `/api/orders/farmer/:farmerId` | Auth (Farmer) | Get farmer orders |
| PUT | `/api/orders/:orderId/items/:orderItemId/status` | Auth (Farmer/Admin) | Update per-item order status |
| GET | `/api/orders/:id` | Auth | Get single order |
| POST | `/api/orders/` | Auth (Customer) | Create new order |
| PUT | `/api/orders/:id/status` | Auth (Farmer/Admin) | Update order status |
| PUT | `/api/orders/:id/cancel` | Auth (Customer) | Cancel order |
| PUT | `/api/orders/:id/delivery-date` | Auth (Farmer/Admin) | Set delivery date |
| PUT | `/api/orders/:id/cancel-farmer` | Auth (Farmer) | Cancel order (farmer) |

## Notifications (`/api/notifications`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/notifications/` | Auth | Get notifications (paginated) |
| PUT | `/api/notifications/:id/read` | Auth | Mark notification as read |
| PUT | `/api/notifications/read-all` | Auth | Mark all notifications as read |

## Messages (`/api/messages`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/messages/conversations` | Auth | Get conversations |
| GET | `/api/messages/conversation/:conversationId` | Auth | Get messages in conversation |
| PUT | `/api/messages/conversation/:conversationId/read` | Auth | Mark conversation as read |
| POST | `/api/messages/send` | Auth | Send a message |
| PUT | `/api/messages/:id/read` | Auth | Mark message as read |
| GET | `/api/messages/unread-count` | Auth | Get unread message count |

## Addresses (`/api/addresses`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/addresses/` | Auth | Get user addresses |
| POST | `/api/addresses/` | Auth | Add new address |
| PUT | `/api/addresses/:id` | Auth | Update address |
| DELETE | `/api/addresses/:id` | Auth | Delete address |
| PUT | `/api/addresses/:id/set-default` | Auth | Set default address |

## Farmers (`/api/farmers`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/farmers/` | Public | Get farmers listing |
| GET | `/api/farmers/:id/profile` | Public | Get farmer shop profile |
| GET | `/api/farmers/me/stats` | Farmer | Get dashboard stats |
| GET | `/api/farmers/me/metrics` | Farmer | Get overview metrics |
| GET | `/api/farmers/me/report` | Farmer | Get time-series report |
| GET | `/api/farmers/me/metrics/export.csv` | Farmer | Export metrics as CSV |
| PUT | `/api/farmers/profile` | Farmer | Update shop profile |
| POST | `/api/farmers/me/verification-request` | Farmer/Customer | Request verification |
| GET | `/api/farmers/me/verification-request` | Farmer/Customer | Get verification request status |
| POST | `/api/farmers/products/:id/harvest-preorder` | Farmer | Harvest pre-order inventory |
| POST | `/api/farmers/products/:id/convert-preorder` | Farmer | Convert pre-order to available stock |

## Admin (`/api/admin`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/admin/users` | Admin/Super Admin | Get all users |
| POST | `/api/admin/users` | Admin/Super Admin | Create user |
| GET | `/api/admin/logs` | Admin/Super Admin | Get audit logs |
| GET | `/api/admin/audit-logs/:id` | Admin/Super Admin | Get single audit log |
| GET | `/api/admin/audit-logs/actions` | Admin/Super Admin | Get distinct audit actions |
| GET | `/api/admin/audit-logs/entities` | Admin/Super Admin | Get distinct audit entities |
| PUT | `/api/admin/users/:id` | Admin/Super Admin | Update user details |
| PUT | `/api/admin/users/:id/verify` | Admin/Super Admin | Verify/unverify user |
| GET | `/api/admin/verification-requests` | Admin/Super Admin | Get verification requests |
| PUT | `/api/admin/verification-requests/:id/review` | Admin/Super Admin | Review verification request |
| PUT | `/api/admin/users/:id/shop-profile` | Admin/Super Admin | Update farmer shop profile |
| POST | `/api/admin/users/:id/generate-temp-password` | Admin/Super Admin | Generate temp password |
| GET | `/api/admin/products` | Admin/Super Admin | Get all products |
| PUT | `/api/admin/products/:id/assign` | Admin/Super Admin | Assign product to farmer |
| POST | `/api/admin/products/:id/approve` | Admin/Super Admin | Approve product |
| POST | `/api/admin/products/:id/reject` | Admin/Super Admin | Reject product |
| PUT | `/api/admin/products/:id` | Admin/Super Admin | Update product details |
| GET | `/api/admin/orders` | Admin/Super Admin | Get all orders |
| PUT | `/api/admin/users/:id/role` | Super Admin | Update user role |
| PUT | `/api/admin/orders/:id/status` | Admin/Super Admin | Update order status |
| DELETE | `/api/admin/orders/:id` | Admin/Super Admin | Disable order |
| PUT | `/api/admin/orders/:id/enable` | Admin/Super Admin | Enable order |
| GET | `/api/admin/stats` | Admin/Super Admin | Get dashboard statistics |
| PUT | `/api/admin/users/:id/disable` | Admin/Super Admin | Disable user |
| PUT | `/api/admin/users/:id/enable` | Admin/Super Admin | Enable user |
| DELETE | `/api/admin/users/:id` | Admin/Super Admin | Disable user (legacy) |
| DELETE | `/api/admin/products/:id` | Admin/Super Admin | Delete product (hard delete) |
| PUT | `/api/admin/products/:id/status` | Admin/Super Admin | Toggle product status |
| GET | `/api/admin/categories` | Admin/Super Admin | Get categories |
| GET | `/api/admin/categories/:id` | Admin/Super Admin | Get single category |
| GET | `/api/admin/categories/:id/products` | Admin/Super Admin | Get products in category |
| POST | `/api/admin/categories` | Admin/Super Admin | Create category |
| PUT | `/api/admin/categories/:id` | Admin/Super Admin | Update category |
| PUT | `/api/admin/categories/:id/disable` | Admin/Super Admin | Disable category |
| DELETE | `/api/admin/categories/:id` | Super Admin | Delete category |
| PUT | `/api/admin/categories/:id/enable` | Admin/Super Admin | Enable category |
| GET | `/api/admin/catalog-names` | Admin/Super Admin | Get catalog names |
| POST | `/api/admin/catalog-names` | Admin/Super Admin | Add catalog name |
| PUT | `/api/admin/catalog-names/:id` | Admin/Super Admin | Update catalog name |
| PATCH | `/api/admin/catalog-names/:id` | Admin/Super Admin | Disable/enable catalog name |
| PATCH | `/api/admin/catalog-names/:id/average-price` | Admin/Super Admin | Set average price |
| DELETE | `/api/admin/catalog-names/:id` | Super Admin | Delete catalog name |
| GET | `/api/admin/category-requests` | Admin/Super Admin | Get category requests |
| PUT | `/api/admin/category-requests/:id/review` | Admin/Super Admin | Review category request |
| GET | `/api/admin/orders/:id` | Admin/Super Admin | Get order details |
| GET | `/api/admin/dashboard/stats` | Admin/Super Admin | Dashboard stats (period) |
| GET | `/api/admin/dashboard/report` | Admin/Super Admin | Dashboard time-series report |
| GET | `/api/admin/dashboard/top-products` | Admin/Super Admin | Top products |
| GET | `/api/admin/dashboard/top-farmers` | Admin/Super Admin | Top farmers |
| GET | `/api/admin/dashboard/recent-activity` | Admin/Super Admin | Recent activity (audit logs) |
| GET | `/api/admin/customers/:id/summary` | Admin/Super Admin | Customer summary |
| GET | `/api/admin/farmers/:id/summary` | Admin/Super Admin | Farmer summary |
| PUT | `/api/admin/users/:id/suspend` | Admin/Super Admin | Suspend user |
| GET | `/api/admin/suspicious-patterns` | Admin/Super Admin | Detect suspicious patterns |

## Payment Accounts (`/api/admin/payment-accounts`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/admin/payment-accounts` | Admin/Super Admin | Get payment accounts |
| POST | `/api/admin/payment-accounts` | Admin/Super Admin | Create payment account |
| PUT | `/api/admin/payment-accounts/:id` | Admin/Super Admin | Update payment account |
| DELETE | `/api/admin/payment-accounts/:id` | Admin/Super Admin | Delete payment account |

## Super Admin (`/api/superadmin`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/superadmin/status` | Super Admin | System status |
| GET | `/api/superadmin/admin` | Super Admin | Get admin users |
| POST | `/api/superadmin/announcements` | Super Admin (announcements flag) | Broadcast announcement |
| GET | `/api/superadmin/announcements` | Public | Get active announcements |
| POST | `/api/superadmin/users` | Super Admin | Create any user role |
| PUT | `/api/superadmin/users/:id` | Super Admin | Edit any user |
| DELETE | `/api/superadmin/users/:id` | Super Admin | Disable user |
| GET | `/api/superadmin/settings` | Super Admin | Get platform settings |
| PUT | `/api/superadmin/settings` | Super Admin | Update platform settings |
| PUT | `/api/superadmin/users/:id/debug-mode` | Super Admin | Toggle debug mode |
| GET | `/api/superadmin/flags` | Super Admin | List feature flags |
| PUT | `/api/superadmin/flags/:key` | Super Admin | Toggle feature flag |

## Activity Monitor (`/api/activity-monitor`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/activity-monitor/activities` | Admin/Super Admin | Get activities (paginated) |
| GET | `/api/activity-monitor/activities/:id` | Admin/Super Admin | Get single activity |
| GET | `/api/activity-monitor/session/:sessionId/timeline` | Admin/Super Admin | Get session timeline |
| GET | `/api/activity-monitor/dashboard` | Admin/Super Admin | Dashboard stats |
| GET | `/api/activity-monitor/online-users` | Admin/Super Admin | Online users count |
| GET | `/api/activity-monitor/errors-today` | Admin/Super Admin | Errors today count |
| GET | `/api/activity-monitor/settings` | Super Admin | Get settings |
| PUT | `/api/activity-monitor/settings` | Super Admin | Update settings |
| POST | `/api/activity-monitor/cleanup` | Super Admin | Trigger cleanup |
| GET | `/api/activity-monitor/storage` | Super Admin | Storage stats |
| GET | `/api/activity-monitor/stream` | Auth (query param) | SSE stream |

## Subscriptions (`/api/subscriptions`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/subscriptions/settings` | Public | Get subscription pricing + payment accounts |
| GET | `/api/subscriptions/farmers/me/subscription` | Auth (Farmer) | Get subscription status |
| POST | `/api/subscriptions/farmers/me/subscription/request` | Auth (Farmer) | Request subscription with payment proof |
| GET | `/api/subscriptions/farmers/me/subscription/history` | Auth (Farmer) | Get subscription history |

## Settings (`/api/settings`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/settings/` | Public | Get delivery address setting |
| GET | `/api/settings/delivery-fee` | Public | Get delivery fee |
| GET | `/api/settings/product-limits` | Public | Get product limit settings |
| GET | `/api/settings/recaptcha-mode` | Public | Get reCAPTCHA mode |

## Upload (`/api/upload`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/upload/product-image` | Auth | Upload product image |
| POST | `/api/upload/shop-banner` | Auth | Upload shop banner |
| POST | `/api/upload/shop-avatar` | Auth | Upload shop avatar |
| POST | `/api/upload/verification-document` | Auth | Upload verification document |

## Contact (`/api/contact`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/contact/` | Public | Submit contact form |

## PSGC (`/api/psgc`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/psgc/provinces` | Public | Get provinces (Luzon) |
| GET | `/api/psgc/cities` | Public | Get cities by province |
| GET | `/api/psgc/barangays` | Public | Get barangays by city |

## Support Tickets (`/api/support-tickets`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/support-tickets/` | Auth (Customer/Farmer) | Create support ticket |
| GET | `/api/support-tickets/` | Auth (Admin) | Get all tickets |
| GET | `/api/support-tickets/:id` | Auth | Get single ticket |
| PUT | `/api/support-tickets/:id` | Auth (Admin) | Update ticket |
| POST | `/api/support-tickets/:id/messages` | Auth | Add message to ticket |
| GET | `/api/support-tickets/:id/messages` | Auth | Get ticket messages |
| GET | `/api/support-tickets/unread-count` | Auth (Admin) | Get unread ticket count |
| GET | `/api/support-tickets/my` | Auth (Customer/Farmer) | Get user's tickets |

## Server-Level Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/_health` | Public | Health check |
| GET | `/api/test-db` | Public | Database connection test |
| GET | `/api/events` | Auth (SSE) | Server-Sent Events stream |
| GET | `/api/time` | Public | Server time |

---

# PART 7 — RECOMMENDED DIAGRAMS

Based ONLY on the actual implementation, the following diagrams are recommended:

## 1. Use Case Diagram
- **Recommended**: Yes. The system has clear actor roles (Customer, Farmer, Admin, Super Admin, Guest) with well-defined use cases per actor. Shared use cases and include/extend relationships are present.

## 2. Context Diagram (DFD Level 0)
- **Recommended**: Yes. External entities (Customer, Farmer, Admin, Super Admin, Guest, Cloudinary, Email Service, Google reCAPTCHA) interact with the AgriCatch system as a single process.

## 3. DFD Level 0
- **Recommended**: Yes. The system can be decomposed into 17 major processes as listed in Part 3.

## 4. DFD Level 1
- **Recommended**: Yes, for the most complex processes:
  - **Level 1 for Process 1.0 (Authentication)**: 7 sub-processes.
  - **Level 1 for Process 2.0 (Product Management)**: 8 sub-processes.
  - **Level 1 for Process 4.0 (Order Management)**: 5 sub-processes.
  - **Level 1 for Process 11.0 (Admin Management)**: 9 sub-processes.

## 5. System Architecture Diagram
- **Recommended**: Yes. Shows the three-tier architecture: Frontend (Vercel) → Backend (Render) → Database (Supabase), with external services (Cloudinary, Resend, Google reCAPTCHA).

## 6. Deployment Diagram
- **Recommended**: Yes. Shows deployment targets:
  - Vercel (Frontend static hosting)
  - Render (Backend Node.js service + cron job)
  - Supabase (PostgreSQL database)
  - Cloudinary (Image storage CDN)
  - Resend (Email API)

## 7. ER Diagram
- **Recommended**: Yes. The database has 28 tables with clear relationships. An ER diagram showing all tables with their primary keys, foreign keys, and relationships is essential.

## 8. Sequence Diagrams
- **Recommended**: Yes, for key flows:
  - **User Registration with OTP**: Browser → API → Database → Email Service → Browser
  - **User Login**: Browser → API → Database → JWT → Browser
  - **Product Creation with Approval**: Farmer → API → Database (pending) → Admin → API → Database (approved) → Notification
  - **Checkout / Order Creation**: Browser → API → Database (inventory check, order creation, inventory decrement) → Response
  - **Order Status Update**: Farmer/Admin → API → Transition Matrix Validation → Database → Notification → SSE → Browser
  - **Order Cancellation with Inventory Restoration**: Customer/Farmer → API → Database (restore inventory) → Response
  - **Hybrid Pre-order Lifecycle**: Farmer creates pre-order → Customer reserves → Farmer harvests → Converts to stock → Order continues
  - **File Upload to Cloudinary**: Browser → API → Multer (local) → Cloudinary (cloud) → URL → Database → Response

## 9. State Diagram
- **Recommended**: Yes, for Order Status transitions. The `orderTransitions.js` module defines a clear state machine:
  - pending → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
  - preorder_reserved → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
  - Any non-terminal state → cancelled (role-dependent)
  - cancelled and completed are terminal states

---

# PART 8 — THESIS RECOMMENDATIONS

## Implementation Details That Should NOT Be Shown in the Thesis

### 1. Middleware Internals
- **JWT verification logic** (`authenticateToken.js`) — Simplify to "User is authenticated."
- **Role checking** (`requireRole.js`) — Simplify to "User is authorized."
- **Rate limiting** — Omit from use case/DFD. Mention briefly in security section.
- **CORS configuration** — Omit from diagrams. Mention in deployment section.
- **Cookie parsing** — Omit entirely.
- **Session management** — Omit from diagrams. Mention briefly if needed.

### 2. Database Constraints and Indexes
- **Primary keys, foreign keys** — Show in ER diagram but don't list every constraint.
- **Indexes** — Omit entirely from diagrams.
- **Column types (VARCHAR, INTEGER, etc.)** — Omit from ER diagram unless specifically asked.
- **Default values** — Omit from diagrams.

### 3. Internal Helper Services
- **Activity Logger** (`activityLogger.js`) — Omit from use case/DFD. Mention briefly in architecture.
- **Browser Parser** (`browserParser.js`) — Omit entirely.
- **IP Geolocation** (`ipGeolocation.js`) — Omit entirely.
- **Admin Cache** (`adminCache.js`) — Omit from diagrams. Mention as "caching layer" if needed.
- **Audit Log writer** (`auditLog.js`) — Omit from use case/DFD. Mention as "audit trail" in architecture.

### 4. Cron Jobs and Scheduled Tasks
- **Self-ping mechanism** — Omit from diagrams. Mention in deployment section.
- **Harvest reminder scheduler** — Omit from use case. Mention in business logic section.
- **Activity log cleanup cron** — Omit from diagrams. Mention in maintenance section.

### 5. Database Migration on Startup
- **Inline table creation in `server.js`** — Omit entirely. The database schema is shown via ER diagram.
- **`ALTER TABLE ADD COLUMN IF NOT EXISTS`** — Omit entirely.

### 6. Feature Flag Checking
- **Individual flag checks in middleware** — Simplify to "Feature flags control system behavior."
- **Platform settings cache** (`db.js` settings cache) — Omit entirely.

### 7. SSE Implementation Details
- **Client Set management** — Simplify to "Real-time updates via Server-Sent Events."
- **EventSource authentication via query parameter** — Omit entirely.

### 8. Cloudinary Upload Internals
- **Public ID generation logic** — Omit entirely.
- **Slugify, Manila timestamp** — Omit entirely.
- **Multer storage configuration** — Simplify to "File upload to cloud storage."

### 9. Email Service Implementation
- **Resend vs SMTP fallback logic** — Simplify to "Email service for OTP and notifications."
- **Logo attachment, base64 encoding** — Omit entirely.
- **Nodemailer transporter configuration** — Omit entirely.

### 10. reCAPTCHA Implementation
- **Token verification API call** — Simplify to "Bot protection via reCAPTCHA."
- **Timeout, AbortController** — Omit entirely.

### 11. Order Transition Matrix Implementation
- **`TRANSITION_MATRIX` constant** — Show as a state diagram, not as code.
- **`CANCELLATION_RULES` per role** — Show in state diagram description, not as code.
- **`validateTransition` function** — Omit from diagrams. Describe as "validated by business rules."

### 12. Inventory Restoration Logic
- **`restoreInventoryOnCancel` function** — Simplify to "Inventory is restored on cancellation."
- **`updateStatisticsOnDeliver` function** — Simplify to "Sales statistics are updated on delivery."
- **Pre-order conversion logic** — Simplify to "Pre-orders are converted to available stock at harvest."

### 13. PSGC Data Loading
- **JSON file parsing, data loading** — Omit from diagrams. Mention as "Geographic data service for address selection."

### 14. Debug Mode
- **User debug mode toggle** — Omit entirely from thesis. This is an internal developer tool.

### 15. Suspicious Pattern Detection
- **SQL queries for pattern matching** — Simplify to "Admin can detect suspicious user behavior patterns."

## What Should Be Simplified for Academic Documentation

1. **Authentication flow** — Show as "User logs in → System validates credentials → JWT issued." Don't show bcrypt hashing, JWT signing details, or OTP generation code.

2. **File upload flow** — Show as "User uploads image → System stores in cloud → URL returned." Don't show Multer configuration or Cloudinary public ID generation.

3. **Real-time notifications** — Show as "System pushes real-time updates to connected clients." Don't show SSE client Set management or event payload format.

4. **Database queries** — Never show raw SQL in diagrams. Show as "System queries database" or "Database returns data."

5. **Error handling** — Simplify to "System returns error response." Don't show try-catch blocks or error status codes.

6. **Pagination** — Simplify to "Results are paginated." Don't show offset/limit calculations.

7. **Caching** — Mention as "Frequently accessed data is cached." Don't show cache TTL or cache key generation.

8. **Rate limiting** — Mention as "API endpoints are rate-limited for security." Don't show rate limiter configuration.

9. **Activity logging** — Mention as "User activities are logged for monitoring." Don't show the ActivityLogger class or deduplication cache.

10. **Audit logging** — Mention as "Admin actions are recorded in an audit trail." Don't show the `writeAdminAuditLog` function or before/after JSONB storage.

---

*End of Report. All content is based on actual codebase inspection of the AgriCatch project as of the current implementation.*
