# AgriCatch Permanent Behaviors Report

**Generated:** 2025-01-09  
**Scope:** Systematic inspection of implemented behaviors across the AgriCatch repository  
**Method:** Code inspection via grep, file reading, and pattern matching  
**Constraint:** Only includes implemented behaviors - no inference or invention

---

## 1. Development-Only Behaviors

### 1.1 Authentication

**JWT Token Configuration**
- `JWT_SECRET` environment variable is **required** for server startup (throws error if missing)
- Default JWT signing uses `process.env.JWT_SECRET`
- JWT tokens are verified in `authenticateToken.js` middleware
- Token expiration is configurable per endpoint (typically 1h for test tokens)

**Password Hashing**
- Uses bcrypt with configurable rounds via `BCRYPT_ROUNDS` environment variable
- Default bcrypt rounds: 10
- Applied in: `auth.js`, `superadmin.js`, `create_admin.js`, `create_superadmin.js`

**Plaintext Password Mode (Development Only)**
- `DEV_PLAINTEXT_PASSWORDS=true` enables plaintext password comparison (non-production only)
- `ALLOW_PLAINTEXT_PASSWORDS=true` also enables plaintext mode (non-production only)
- **Intentionally disallowed in production** to prevent misconfiguration
- Location: `backend/routes/auth.js` lines 35-39

**Password Reset OTP Exposure**
- `DEV_SHOW_PASSWORD_RESET_OTP=true` exposes OTP in console logs (non-production only)
- Requires `NODE_ENV !== 'production'` to function
- Location: `backend/routes/auth.js` line 33

**Admin Secret Recovery**
- `ADMIN_SECRET` environment variable enables admin role recovery
- Used in `/api/auth/admin-recover` endpoint
- Required for admin account recovery functionality
- Location: `backend/routes/auth.js` lines 661-671

### 1.2 Verification

**Farmer Verification Workflow**
- `is_verified` boolean column in `users` table (default: false)
- Verification requests stored in `verification_requests` table
- Status workflow: `pending` → `approved`/`rejected`/`unverified`
- Admin can approve/reject verification requests
- Verification status affects:
  - Product search ranking (verified farmers ranked higher)
  - Custom product name requests (premium + verified only)
  - Product approval priority
- Location: `backend/routes/admin.js`, `backend/routes/farmers.js`

**Verification Request Submission**
- Farmers submit verification requests via `/api/farmers/me/verification-request`
- Requires `document_url` (Cloudinary upload)
- Only one pending request per farmer allowed
- Admin notified of new verification requests
- Location: `backend/routes/farmers.js` lines 931-983

### 1.3 Email

**Email Service Architecture**
- Primary: Resend API (preferred when `RESEND_API_KEY` is set)
- Fallback: SMTP (Nodemailer) when Resend unavailable
- SMTP configuration: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`

**Development-Only Email Skipping**
- Email sending is **skipped in development mode** (`NODE_ENV === 'development'`)
- OTP is logged to console instead of sending email
- Purpose: Save Resend API quota during development
- Location: `backend/utils/emailService.js` lines 99-102

**Email Types**
- OTP emails (login, register, password reset)
- Welcome emails
- Account verification/unverification emails
- Premium upgrade/expiration emails
- Support ticket notifications
- Order status notifications

### 1.4 CAPTCHA

**reCAPTCHA Configuration**
- `RECAPTCHA_SECRET_KEY` environment variable required
- reCAPTCHA verification via Google's `siteverify` endpoint
- Location: `backend/utils/recaptcha.js`

**reCAPTCHA Mode System**
- `recaptcha_mode` platform setting controls behavior: `auto`, `always_on`, `always_off`
- In `auto` mode: reCAPTCHA is **automatically bypassed in development** (`NODE_ENV === 'development'`)
- In production: reCAPTCHA is enforced (unless `always_off`)
- Location: `backend/routes/auth.js`, test scripts

**Development Bypass**
- Playwright tests use `recaptcha_mode=always_off` or `NODE_ENV=development` with auto mode
- Location: `tests/recaptcha-playwright-test.spec.js`

### 1.5 OTP

**OTP Mode System**
- `otp_mode` platform setting: `strict`, `testing`, `disabled`, `bypass`
- `otp_bypass_code` platform setting for testing mode
- Modes:
  - **strict**: OTP required, no bypass, no exposure (production default)
  - **testing**: OTP required, bypass code works, OTP exposed in response (local/AI testing)
  - **disabled**: No OTP required (not recommended)
  - **bypass**: OTP required, bypass code works, OTP exposed in logs/API but not frontend UI

**OTP Rate Limiting**
- Environment-aware rate limits via platform settings:
  - `otp_rate_limit_local` (default: 50 per 15min for development)
  - `otp_rate_limit_production` (default: 10 per 15min for production)
- Dynamic selection based on `NODE_ENV`
- Location: `backend/server.js` lines 747-766

**OTP Tables**
- `otps` table: stores OTP codes with expiration
- `password_resets` table: stores password reset OTP hashes
- Both tables have indexes on `expires_at` for cleanup
- Location: `backend/server.js` lines 632-667

**OTP Validity**
- OTP validity: 10 minutes (hardcoded in email template)
- Password reset OTP TTL: 15 minutes (configurable via `PASSWORD_RESET_OTP_TTL_MINUTES`)

### 1.6 Test Accounts

**Playwright Test Accounts**
- Test accounts defined in individual test files:
  - `TEST_SUPER_ADMIN` in `tests/ui-audit-superadmin.spec.js`
  - `TEST_ADMIN` in `tests/ui-audit-admin.spec.js`
  - `TEST_FARMER` in `tests/ui-audit-farmer.spec.js`
  - `TEST_CUSTOMER` in `tests/ui-audit-customer.spec.js`
- Used for UI audit tests

**Test Tokens**
- `TEST_FARMER_TOKEN` environment variable for API tests
- `TEST_ADMIN_TOKEN` environment variable for API tests
- Fallback to `'test-token'` if not set
- Location: `tests/support-ticket-api-smoke-test.js`

**Debug Account Flag**
- `is_debug_account` boolean column in `users` table (default: false)
- Used for marking debug/test accounts
- Location: `database/migrations/add_debug_account_flag.sql`

---

## 2. Business Workflows

### 2.1 Product Approval

**Product Status Workflow**
- Status values: `pending`, `approved`, `rejected`, `available`
- New farmer-created products default to `pending` when `require_product_approval` feature flag is enabled
- Admin approve/reject endpoints in `backend/routes/admin.js`
- Product approval controlled by `require_product_approval` feature flag
- Location: `backend/routes/products.js`, `backend/routes/admin.js`

**Product Approval Feature Flag**
- `require_product_approval` platform setting controls workflow
- When enabled: new products require admin approval before appearing in marketplace
- When disabled: new products are auto-approved
- Admin can toggle this flag dynamically
- Location: `backend/middleware/featureFlags.js`, `backend/routes/products.js`

**Product Rejection**
- Rejected products can be resubmitted by farmers
- Resubmission resets status to `pending` and clears rejection reason
- Location: `backend/routes/products.js` lines 1041-1070

**Admin Product Management**
- Admin can approve/reject products via `/api/admin/products/:id/approve` and `/api/admin/products/:id/reject`
- Admin can disable products (sets `is_admin_disabled=true`)
- Disabled accounts have their products automatically disabled
- Location: `backend/routes/admin.js` lines 1555-1594

### 2.2 Farmer Approval

**Farmer Verification Approval**
- Admin approves verification requests via `/api/admin/verification-requests/:id/status`
- Approvals set `users.is_verified = true`
- Rejections set `users.is_verified = false` with optional reason
- Location: `backend/routes/admin.js` lines 1103-1254

**Verification Status Effects**
- Verified farmers get search ranking boost
- Verified farmers can request custom product names (premium only)
- Verified farmers get priority in product approval queue
- Location: `backend/routes/products.js` (sorting logic)

**Account Disabling**
- Admin can disable accounts via `/api/admin/users/:id/disable`
- Disabled accounts cannot login (blocked by middleware)
- Disabled accounts have their products automatically disabled
- Disabled accounts have their orders marked as disabled
- Location: `backend/routes/admin.js`, `backend/server.js` (disabled account check)

### 2.3 Subscription Workflow

**Subscription Tiers**
- Free tier: 10 product limit, basic analytics
- Premium tier: unlimited products, advanced analytics, custom product names, priority approval
- Tier stored in `farmer_subscriptions.tier` column
- Status workflow: `pending` → `active` → `expired`
- Location: `backend/routes/subscriptions.js`, `backend/routes/products.js`

**Subscription Request**
- Farmers request premium subscription via `/api/farmers/me/subscription/request`
- Requires payment proof upload (Cloudinary)
- Admin approves/rejects pending subscriptions
- Only one pending subscription request per farmer allowed
- Location: `backend/routes/subscriptions.js` lines 91-143

**Subscription Management**
- Admin approves subscriptions via `/api/admin/subscriptions/:id/approve`
- Admin rejects subscriptions via `/api/admin/subscriptions/:id/reject`
- Admin expires subscriptions via `/api/admin/subscriptions/:id/expire`
- Automated expiry via cron job (`backend/scripts/expire_subscriptions.js`)
- Location: `backend/routes/admin.js` lines 4308-4380

**Subscription Benefits**
- Premium farmers get unlimited product listings
- Premium farmers get custom date range analytics
- Premium farmers get CSV export of metrics
- Premium farmers get priority in search results
- Location: `backend/routes/products.js` (tier checks), `backend/routes/farmers.js` (analytics)

### 2.4 Order Workflow

**Order Status Workflow**
- Regular orders: `pending` → `confirmed` → `preparing` → `out_for_delivery` → `delivered` → `cancelled`
- Pre-orders: `preorder_reserved` → `confirmed` → `preparing` → `out_for_delivery` → `delivered` → `cancelled`
- Customers can only cancel `pending` or `confirmed` orders (or `preorder_reserved` for pre-orders)
- Location: `backend/routes/orders.js` lines 19, 247, 322-323, 1096-1098

**Order Creation**
- Orders created via `/api/orders` endpoint
- Regular orders: `status='pending'`, `delivery_date=NULL`
- Pre-orders: `status='preorder_reserved'`, `delivery_date` set
- Order items track quantity, price, and fulfillment status
- Location: `backend/routes/orders.js` lines 689-691

**Order Status Updates**
- Farmers update order status via `/api/orders/:order_id/items/:item_id/status`
- Status transitions enforced by business rules
- Location: `backend/routes/orders.js`

**Order Cancellation**
- Customers cancel orders via `/api/orders/:order_id/cancel`
- Cancellation rules based on order status
- Pre-order cancellation decrements `reserved_quantity`
- Location: `backend/routes/orders.js` lines 1096-1098

### 2.5 Pre-order Workflow

**Pre-order Product Fields**
- `is_preorder`: boolean flag
- `preorder_availability_date`: DATE column
- `max_preorder_quantity`: maximum units available for pre-order
- `reserved_quantity`: currently reserved units
- Location: `database/migrations/add_preorder_fields.sql`

**Pre-order Constraints**
- `preorder_expiry_check`: `expiry_date >= preorder_availability_date`
- `preorder_availability_required`: pre-orders must have availability date
- `preorder_reserved_within_max`: `reserved_quantity <= max_preorder_quantity`
- `stock_quantity_non_negative`: stock cannot be negative
- `reserved_quantity_non_negative`: reserved quantity cannot be negative
- Location: `database/migrations/add_preorder_fields.sql`, `database/migrations/add_phase1_inventory_constraints.sql`

**Pre-order Order Fields**
- `is_preorder`: boolean flag
- `preorder_converted_at`: timestamp when pre-order converted to regular order
- `preorder_reserved_quantity`: units reserved for this order
- `preorder_fulfilled_quantity`: units fulfilled to this order
- Location: `database/migrations/add_preorder_fields.sql`

**Pre-order Fulfillment**
- Farmers convert pre-orders to regular orders via harvest
- Endpoint: `/api/products/:product_id/convert-preorders`
- Harvest quantity allocated to pre-order orders
- Updates `stock_quantity`, `reserved_quantity`, `preorder_fulfilled_quantity`
- Location: `backend/routes/products.js` (harvest fulfillment logic)

**Pre-order Per-Name Limits**
- `max_products_per_name_preorder` platform setting (default: 1)
- Independent limit from available products (`max_products_per_name_available`)
- Enforced in product name catalog filtering
- Location: `backend/routes/settings.js`, `backend/routes/products.js`

### 2.6 Admin Workflow

**Admin Roles**
- `admin`: Standard admin role
- `super_admin`: Super admin role (can access during maintenance mode)
- Role hierarchy: `super_admin` > `admin` > `farmer` > `customer`
- Location: `backend/routes/admin.js`, `backend/middleware/featureFlags.js`

**Admin Audit Logging**
- `admin_audit_logs` table tracks all admin actions
- Fields: `actor_admin_id`, `action`, `entity`, `entity_id`, `before`, `after`, `ip_address`, `user_agent`, `session_id`
- Logged actions: user verification, product approval, subscription management, etc.
- Best-effort logging (swallows errors to not block admin actions)
- Location: `backend/utils/auditLog.js`, `backend/services/activityLogger.js`

**Activity Logging**
- `activity_logs` table tracks user activities
- Configurable via `activity_monitor_settings` table
- Fields: `user_id`, `role`, `action`, `entity_type`, `entity_id`, `ip_address`, `user_agent`, `session_id`
- Retention policy configurable
- Location: `backend/services/activityLogger.js`

**Maintenance Mode**
- `maintenance_mode` feature flag blocks all non-super_admin users
- Only super_admin can access site during maintenance
- Auth routes and static assets exempt from maintenance mode
- Location: `backend/middleware/featureFlags.js` lines 175-176

**Registration Control**
- `allow_registrations` feature flag controls new user registrations
- When disabled, registration endpoint returns 403
- Location: `backend/middleware/featureFlags.js` lines 28-34

---

## 3. Environment Behaviors

### 3.1 Backend Startup

**Server Configuration**
- Express.js server on port 3000 (configurable via `PORT` environment variable)
- Trust proxy enabled for Render deployment (`app.set('trust proxy', true)`)
- Session middleware configured with `SESSION_SECRET` (required)
- Location: `backend/server.js` lines 28-29, 18-22

**Database Connection**
- PostgreSQL connection via `pg` pool
- SSL auto-enabled for Render/Supabase hosts
- Connection string: `DATABASE_URL` or individual `DB_*` environment variables
- Best-effort schema migration on startup (creates tables if missing)
- Location: `backend/utils/db.js`, `backend/server.js`

**Schema Migration (Best-Effort)**
- On startup, backend attempts to create missing tables and columns
- Uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- Tables: users, categories, products, cart, orders, order_items, reviews, customer_ratings, wishlist, notifications, conversations, messages, user_addresses, otps, password_resets, settings, feature_flags, farmer_subscriptions, payment_accounts, verification_requests, verification_history, featured_products, activity_logs, admin_audit_logs, activity_monitor_settings, announcements
- Fails silently if migration fails (logs error but continues)
- Location: `backend/server.js` lines 200-700

**CORS Configuration**
- Default development origins: `http://localhost:8888`, `http://localhost:3000`, `http://127.0.0.1:8888`, `http://127.0.0.1:3000`
- Default production origins: `https://agricatch.store`, `https://www.agricatch.store`, `https://agricatch.onrender.com`
- `PERMISSIVE_CORS=true` allows any origin (short-term debugging only)
- Credentials enabled for all origins
- Location: `backend/server.js` lines 48-124

**Rate Limiting**
- Dynamic rate limits from platform settings
- Auth endpoint: `auth_rate_limit_local` (dev) / `auth_rate_limit_production` (prod)
- OTP endpoint: `otp_rate_limit_local` (dev) / `otp_rate_limit_production` (prod)
- Default limits: 100/20 for auth, 50/10 for OTP
- Location: `backend/server.js` lines 727-766

**Static File Serving**
- Frontend files served from `../frontend` directory
- Configured before route handlers
- Location: `backend/server.js` line 1113

**Self-Ping (Render)**
- Self-ping prevents Render free tier from sleeping
- Enabled when `RENDER=true` or `RENDER_EXTERNAL_URL` is set
- Configurable interval: `SELF_PING_MIN_MINUTES` to `SELF_PING_MAX_MINUTES` (default: 1-13 minutes)
- Pings `/api/test-db` endpoint
- Location: `backend/server.js` lines 1217-1238

**Local Ingest Logger**
- Development-only logging to `http://127.0.0.1:7242/ingest/...`
- Disabled in production by default
- Can be enabled via `ENABLE_INGEST` environment variable
- Best-effort (swallows errors)
- Location: `backend/server.js` lines 35-45

### 3.2 Frontend Startup

**Frontend Files**
- Served as static files by backend Express server
- No separate frontend server process
- Location: `frontend/` directory

**PSGC API Base URL**
- Uses `https://agricatch.onrender.com/api/psgc` when hostname is `agricatch.store` or `www.agricatch.store`
- Uses `/api/psgc` otherwise (local development)
- Purpose: Avoid production custom-domain proxy 404s
- Location: `frontend/js/psgc.js`

**Name Field Validation**
- `first_name`, `middle_name`, `last_name`, `shop_name` limited to 40 characters
- `maxlength="40"` on all relevant inputs
- Client-side validation in JS files
- Location: `frontend/*.html`, `frontend/*.js`

### 3.3 Browser MCP

**Browser MCP Usage**
- Browser MCP server available for automated browser testing
- Used for Playwright test execution
- No specific configuration found in codebase
- Location: Available via MCP server (not in AgriCatch code)

### 3.4 Playwright

**Playwright Configuration**
- Test directory: `./tests`
- Timeout: 60 seconds
- Expect timeout: 15 seconds
- Headless mode: true
- Viewport: 1280x720
- Action timeout: 15 seconds
- Navigation timeout: 30 seconds
- Trace: on-first-retry
- Workers: 1 (not parallel)
- Reporter: list
- Base URL: `http://localhost:3000`
- Browser: Chromium with cache disabled
- Location: `playwright.config.js`

**Test Environment Variables**
- `BASE_URL`: Test base URL (default: `http://localhost:3000`)
- `API_BASE`: API base URL (default: `http://localhost:3000/api`)
- `DATABASE_URL`: Database connection string for direct DB tests
- `TEST_FARMER_TOKEN`: Farmer JWT for API tests
- `TEST_ADMIN_TOKEN`: Admin JWT for API tests
- Location: Various test files

### 3.5 Database

**Database Provider**
- PostgreSQL (Supabase or Render)
- SSL required for external connections (auto-enabled for Supabase/Render hosts)
- Connection pooling via `pg` library
- Location: `backend/utils/db.js`

**Schema Management**
- Best-effort migration on backend startup
- Individual migration files in `database/migrations/`
- No separate migration runner - migrations run on server start
- Location: `backend/server.js`, `database/migrations/`

**Platform Settings**
- `platform_settings` table stores dynamic configuration
- Key-value pairs for feature flags, rate limits, etc.
- Accessed via `getPlatformSetting()` utility
- Location: `backend/utils/db.js`

**Feature Flags**
- `feature_flags` table stores feature toggles
- Fields: `key`, `enabled`, `description`
- Used for: maintenance_mode, allow_registrations, require_product_approval, price_drop_alerts, etc.
- Location: `backend/middleware/featureFlags.js`

### 3.6 Storage

**Cloudinary Image Storage**
- Primary image storage for product images
- Configuration via `CLOUDINARY_URL` or individual `CLOUDINARY_*` environment variables
- Required: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Public ID format: `agricatch/{category}/{product}/{productId}.jpeg`
- Location: `backend/utils/cloudinary.js`

**Local File Uploads**
- User uploads stored under `/frontend/images/uploads/`
- Served as static assets by backend
- Location: `backend/utils/fileUtils.js`, `backend/middleware/upload.js`

**Fishery Content Exclusion**
- Fishery-related products/categories filtered out
- Keywords: fishery, seafood, fish, tilapia, tuna, prawn, shrimp, crab, lobster, salmon, sardine, mackerel
- Purpose: AgriCatch focuses on agriculture, not fishery
- Location: `backend/routes/products.js`, `backend/scripts/purge-fishery.js`

---

## 4. Common Debugging Pitfalls

### 4.1 Error Swallowing

**Best-Effort Operations**
- Many operations use `.catch(() => {})` to swallow errors
- Examples: ingest logging, audit logging, notification sending
- Purpose: Prevent non-critical failures from blocking main operations
- Pitfall: Can hide real issues if not monitored
- Location: `backend/server.js` line 41, `backend/utils/auditLog.js` line 68

### 4.2 Silent Failures

**Migration Failures**
- Schema migration failures are logged but don't stop server startup
- Pitfall: Server may start with incomplete schema
- Location: `backend/server.js` (safeQuery function)

**Email Failures**
- Email sending failures are logged but don't block operations
- Pitfall: Users may not receive expected emails
- Location: `backend/utils/emailService.js`

### 4.3 Development vs Production Confusion

**Environment-Specific Behavior**
- Many behaviors change based on `NODE_ENV`
- Examples: reCAPTCHA bypass, email skipping, rate limits, plaintext passwords
- Pitfall: Code that works in development may fail in production
- Location: Multiple files

**CORS Issues**
- Different CORS origins for development vs production
- Pitfall: Cross-origin requests fail if origins not configured
- Location: `backend/server.js` lines 48-124

### 4.4 Missing Environment Variables

**Required Variables**
- `JWT_SECRET`: Required for server startup
- `SESSION_SECRET`: Required for server startup
- `DATABASE_URL` or `DB_*`: Required for database connection
- Pitfall: Server fails to start if these are missing
- Location: `backend/server.js` lines 18-22

**Optional Variables**
- `CLOUDINARY_URL` or `CLOUDINARY_*`: Required for image uploads
- `RESEND_API_KEY`: Required for email (fallback to SMTP)
- `RECAPTCHA_SECRET_KEY`: Required for reCAPTCHA
- Pitfall: Features fail silently if variables missing
- Location: Various files

### 4.5 Database Schema Drift

**Best-Effort Migration**
- Schema changes applied on startup without version tracking
- Pitfall: Schema can drift between environments
- No rollback mechanism
- Location: `backend/server.js`

### 4.6 Rate Limiting Issues

**Dynamic Rate Limits**
- Rate limits read from database on each request
- Pitfall: Database failures can cause rate limiting to fail
- Pitfall: High traffic can cause database load
- Location: `backend/server.js` lines 727-766

### 4.7 Session Management

**Session Storage**
- Sessions stored in memory (default Express session)
- Pitfall: Sessions lost on server restart
- Pitfall: Not scalable across multiple instances
- Location: `backend/server.js` lines 137-138

---

## 5. Permanent Project Assumptions

### 5.1 Authentication Assumptions

**JWT-Based Authentication**
- All authenticated routes use JWT tokens
- Tokens passed via `Authorization: Bearer <token>` header
- Tokens contain user ID and role
- Assumption: JWT secret is kept secure and rotated periodically

**Password Security**
- All passwords hashed with bcrypt (minimum 10 rounds)
- Plaintext passwords only in development (never in production)
- Assumption: Bcrypt rounds sufficient for security requirements

### 5.2 Role-Based Access Control

**Four User Roles**
- `customer`: Can browse products, place orders, manage profile
- `farmer`: Can manage products, view orders, access analytics
- `admin`: Can manage users, products, categories, audit logs
- `super_admin`: Can access during maintenance, manage all settings
- Assumption: Role hierarchy is sufficient for access control needs

### 5.3 Database Assumptions

**PostgreSQL as Primary Database**
- All data stored in PostgreSQL
- No other database systems supported
- Assumption: PostgreSQL meets all performance and scalability needs

**Best-Effort Schema Migration**
- Schema changes applied on startup without version control
- Assumption: Schema changes are additive and backward-compatible
- Assumption: Single deployment environment (no multi-version deployments)

### 5.4 Email Assumptions

**Resend as Primary Email Service**
- Resend API preferred for email sending
- SMTP as fallback only
- Assumption: Resend API is reliable and cost-effective
- Assumption: SMTP configuration available as backup

**Email as Best-Effort**
- Email failures don't block operations
- Assumption: Users can proceed without email notifications
- Assumption: Critical operations don't depend on email delivery

### 5.5 Image Storage Assumptions

**Cloudinary as Primary Storage**
- All product images stored in Cloudinary
- Assumption: Cloudinary is reliable and cost-effective
- Assumption: Cloudinary API remains stable

**Local Uploads for Development**
- Local uploads stored in frontend directory
- Assumption: Local storage sufficient for development
- Assumption: Production uses Cloudinary exclusively

### 5.6 Business Logic Assumptions

**Product Approval Workflow**
- Products require admin approval when feature flag enabled
- Assumption: Admin approval is necessary for quality control
- Assumption: Auto-approval acceptable when flag disabled

**Farmer Verification**
- Verification required for premium features
- Assumption: Verification process prevents fraud
- Assumption: Manual verification is sustainable

**Subscription Model**
- Two-tier subscription (free/premium)
- Assumption: Two tiers sufficient for user segmentation
- Assumption: Premium features justify subscription cost

**Pre-order System**
- Pre-orders allow advance reservations
- Assumption: Farmers can accurately predict harvest quantities
- Assumption: Customers willing to wait for pre-order fulfillment

### 5.7 Geographic Assumptions

**Philippines-Centric Design**
- PSGC (Philippine Standard Geographic Code) integration
- Address fields: province, city, barangay, street
- Assumption: All users are in the Philippines
- Assumption: PSGC data is accurate and up-to-date

**Fishery Exclusion**
- Fishery products explicitly excluded
- Assumption: AgriCatch focuses on agriculture only
- Assumption: Fishery exclusion is acceptable business decision

### 5.8 Performance Assumptions

**Single-Instance Deployment**
- No horizontal scaling support
- In-memory sessions (not distributed)
- Assumption: Single instance can handle expected load
- Assumption: No need for multi-instance deployment

**Rate Limiting Sufficient**
- Rate limits prevent abuse
- Assumption: Rate limits don't block legitimate users
- Assumption: Database can handle rate limit query load

### 5.9 Security Assumptions

**reCAPTCHA for Bot Prevention**
- reCAPTCHA prevents automated abuse
- Assumption: reCAPTCHA is effective and user-friendly
- Assumption: reCAPTCHA bypass in development is acceptable

**CORS Configuration**
- CORS prevents unauthorized cross-origin requests
- Assumption: CORS origins are correctly configured
- Assumption: Permissive CORS only used for short-term debugging

### 5.10 Monitoring Assumptions

**Audit Logging**
- Admin actions logged for accountability
- Assumption: Audit logs are sufficient for compliance
- Assumption: Audit log retention policy is appropriate

**Activity Logging**
- User activities logged for analytics
- Assumption: Activity logging doesn't impact performance
- Assumption: Activity data is useful for business insights

### 5.11 Development Workflow Assumptions

**Playwright for Testing**
- Playwright used for E2E testing
- Assumption: Playwright tests cover critical user flows
- Assumption: Test execution time is acceptable

**Git-Based Version Control**
- Git used for version control
- Assumption: Git workflow is understood by team
- Assumption: Branching strategy is appropriate

### 5.12 Deployment Assumptions

**Render as Primary Platform**
- Render used for production deployment
- Self-ping prevents free tier sleeping
- Assumption: Render is reliable and cost-effective
- Assumption: Self-ping interval is appropriate

**Environment Variables for Configuration**
- All configuration via environment variables
- Assumption: Environment variables are secure
- Assumption: Environment variable management is manageable

---

## 6. Hardcoded Values and Constants

### 6.1 Validation Limits

- **Name fields**: 40 characters max (first_name, middle_name, last_name, shop_name)
- **Product description**: 500 characters max
- **Support ticket subject**: 200 characters max
- **Support ticket description**: 500 characters max
- **Support ticket message**: 1000 characters max
- **Password**: 8 characters min
- **Activity log metadata**: 4096 bytes max

### 6.2 Business Logic Constants

- **Minimum sample count for pricing suggestions**: 5
- **Default auth rate limit (local)**: 100 per 15min
- **Default auth rate limit (production)**: 20 per 15min
- **Default OTP rate limit (local)**: 50 per 15min
- **Default OTP rate limit (production)**: 10 per 15min
- **Default max products per name (available)**: 2
- **Default max products per name (preorder)**: 1
- **Free tier product limit**: 10 products
- **OTP validity**: 10 minutes
- **Password reset OTP TTL**: 15 minutes (configurable)
- **Bcrypt rounds**: 10 (configurable)

### 6.3 Hardcoded Product Data

- **Suggested price baselines**: Hardcoded in `SUGGESTED_PRICE_BASELINE` object
- **Default product catalog**: Hardcoded product names for catalog suggestions
- **Featured category groups**: Predefined category groupings

### 6.4 URLs and Endpoints

- **Ingest URL**: `http://127.0.0.1:7242/ingest/edada99e-03b1-40b7-84f1-7a3e6b30377c`
- **Self-ping URL**: `https://api.agricatch.store/api/test-db` (configurable)
- **PSGC API**: `https://agricatch.onrender.com/api/psgc` (production)

---

## 7. File Organization Assumptions

### 7.1 Backend Structure

- `backend/routes/`: API route handlers
- `backend/middleware/`: Express middleware
- `backend/utils/`: Utility functions
- `backend/services/`: Business logic services
- `backend/scripts/`: Standalone scripts (testing, migrations)
- `backend/server.js`: Main server entry point

### 7.2 Frontend Structure

- `frontend/*.html`: HTML pages
- `frontend/js/`: JavaScript files
- `frontend/css/`: CSS files
- `frontend/images/uploads/`: User-uploaded images
- `frontend/vendor/`: Third-party libraries

### 7.3 Database Structure

- `database/schema.sql`: Base schema
- `database/migrations/`: Schema migration files
- `database/scripts/`: Database utility scripts

### 7.4 Test Structure

- `tests/*.spec.js`: Playwright E2E tests
- `tests/*.js`: Utility test scripts
- `playwright.config.js`: Playwright configuration

---

## 8. Summary

This report documents all permanent project behaviors identified through systematic inspection of the AgriCatch repository. The behaviors are categorized into:

1. **Development-only behaviors**: Authentication, verification, email, CAPTCHA, OTP, and test account configurations that differ between development and production environments.

2. **Business workflows**: Product approval, farmer approval, subscription management, order processing, pre-order fulfillment, and administrative operations.

3. **Environment behaviors**: Backend startup, frontend serving, Playwright testing, database management, and Cloudinary storage.

4. **Common debugging pitfalls**: Error swallowing, silent failures, environment confusion, missing variables, schema drift, rate limiting, and session management issues.

5. **Permanent project assumptions**: Underlying assumptions about authentication, roles, database, email, storage, business logic, geography, performance, security, monitoring, development workflow, and deployment.

All behaviors documented in this report are **implemented in the codebase**. No behaviors were inferred or invented. The report serves as a reference for understanding the permanent rules and behaviors that should be documented as development guidelines for the AgriCatch project.
