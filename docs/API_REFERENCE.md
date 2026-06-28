# AgriCatch API Reference
Version: 2.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document documents the actual API endpoints in AgriCatch based on the
repository implementation.

Repository implementation is the source of truth.

==============================================================================
API BASE URLS
==============================================================================

Production
- https://agricatch.onrender.com/api

Development
- http://localhost:3000/api

==============================================================================
AUTHENTICATION ENDPOINTS
==============================================================================

Base Path: /api/auth

GET /api/auth/otp-mode
- Description: Get OTP mode configuration
- Auth: None
- Response: { otp_mode: 'strict' | 'lenient' }

GET /api/auth/check-username/:username
- Description: Check if username is available
- Auth: None
- Response: { available: boolean }

POST /api/auth/register
- Description: Register new user
- Auth: None
- Body: { username, email, password, role, first_name, last_name, middle_name, shop_name, phone, address }
- Response: { token, user }

POST /api/auth/login
- Description: Login user
- Auth: None
- Body: { email, password, otp_code? }
- Response: { token, user }

POST /api/auth/recover-admin
- Description: Recover admin access
- Auth: None
- Body: { email }
- Response: { message }

POST /api/auth/logout
- Description: Logout user
- Auth: Required
- Response: { message }

GET /api/auth/profile
- Description: Get current user profile
- Auth: Required
- Response: { user }

GET /api/auth/me
- Description: Get current user info
- Auth: Required
- Response: { id, role, email, username, full_name }

PUT /api/auth/profile
- Description: Update user profile
- Auth: Required
- Body: { first_name, last_name, middle_name, phone, address }
- Response: { user }

POST /api/auth/forgot
- Description: Request password reset OTP
- Auth: None
- Body: { email }
- Response: { message }

POST /api/auth/forgot/resend
- Description: Resend password reset OTP
- Auth: None
- Body: { email }
- Response: { message }

POST /api/auth/forgot/verify-otp
- Description: Verify password reset OTP
- Auth: None
- Body: { email, otp_code }
- Response: { verified: boolean }

POST /api/auth/forgot/reset
- Description: Reset password with OTP
- Auth: None
- Body: { email, otp_code, new_password }
- Response: { message }

PUT /api/auth/change-password
- Description: Change password (authenticated)
- Auth: Required
- Body: { current_password, new_password }
- Response: { message }

GET /api/auth/feature-flags
- Description: Get feature flags
- Auth: None
- Response: { feature_flags }

==============================================================================
PRODUCT ENDPOINTS
==============================================================================

Base Path: /api/products

GET /api/products
- Description: Get products with filtering
- Auth: Optional
- Query: page, limit, category, search, sort, status, farmer_id
- Response: { products, pagination }

GET /api/products/:id
- Description: Get single product
- Auth: Optional
- Response: { product }

POST /api/products
- Description: Create new product
- Auth: Farmer required
- Body: { name, description, price, category_id, unit, stock_quantity, location, harvest_date, expiry_date, image }
- Response: { product }

PUT /api/products/:id
- Description: Update product
- Auth: Farmer required (owner)
- Body: { name, description, price, category_id, unit, stock_quantity, location, harvest_date, expiry_date, image }
- Response: { product }

DELETE /api/products/:id
- Description: Delete product
- Auth: Farmer required (owner)
- Response: { message }

POST /api/products/:id/toggle-availability
- Description: Toggle product availability
- Auth: Farmer required (owner)
- Response: { product }

GET /api/products/my
- Description: Get current user's products
- Auth: Farmer required
- Response: { products }

==============================================================================
CART ENDPOINTS
==============================================================================

Base Path: /api/cart

GET /api/cart
- Description: Get cart items
- Auth: Optional (uses session_id for guests)
- Query: sessionId
- Response: { cartItems, summary }

POST /api/cart
- Description: Add item to cart
- Auth: Optional
- Body: { product_id, quantity, sessionId? }
- Response: { cartItem }

PUT /api/cart/:id
- Description: Update cart item quantity
- Auth: Optional
- Body: { quantity }
- Response: { cartItem }

DELETE /api/cart/:id
- Description: Remove cart item
- Auth: Optional
- Response: { message }

DELETE /api/cart
- Description: Clear cart
- Auth: Optional
- Body: { sessionId? }
- Response: { message }

POST /api/cart/migrate
- Description: Migrate guest cart to user cart
- Auth: Required
- Body: { sessionId }
- Response: { message }

POST /api/cart/merge
- Description: Merge cart items
- Auth: Required
- Body: { sessionId }
- Response: { message }

==============================================================================
ORDER ENDPOINTS
==============================================================================

Base Path: /api/orders

GET /api/orders
- Description: Get user orders
- Auth: Required
- Response: { orders }

GET /api/orders/:id
- Description: Get single order
- Auth: Required (owner or farmer)
- Response: { order }

POST /api/orders
- Description: Create order
- Auth: Required
- Body: { items: [{ product_id, quantity }], delivery_address, special_instructions }
- Response: { order }

PUT /api/orders/:id/status
- Description: Update order status
- Auth: Required (farmer or admin)
- Body: { status, cancellation_reason? }
- Response: { order }

PUT /api/orders/:id/cancel
- Description: Cancel order
- Auth: Required (customer, farmer, or admin)
- Body: { cancellation_reason }
- Response: { order }

GET /api/orders/farmer
- Description: Get farmer's orders
- Auth: Farmer required
- Response: { orders }

==============================================================================
WISHLIST ENDPOINTS
==============================================================================

Base Path: /api/wishlist

GET /api/wishlist
- Description: Get user wishlist
- Auth: Required
- Response: { products }

POST /api/wishlist
- Description: Add product to wishlist
- Auth: Required
- Body: { product_id }
- Response: { message }

DELETE /api/wishlist/:product_id
- Description: Remove product from wishlist
- Auth: Required
- Response: { message }

==============================================================================
REVIEW ENDPOINTS
==============================================================================

Base Path: /api/reviews

GET /api/reviews/product/:product_id
- Description: Get product reviews
- Auth: None
- Response: { reviews }

POST /api/reviews
- Description: Submit product review
- Auth: Required
- Body: { product_id, order_id, rating, comment }
- Response: { review }

==============================================================================
NOTIFICATION ENDPOINTS
==============================================================================

Base Path: /api/notifications

GET /api/notifications
- Description: Get user notifications
- Auth: Required
- Response: { notifications }

PUT /api/notifications/:id/read
- Description: Mark notification as read
- Auth: Required
- Response: { notification }

PUT /api/notifications/read-all
- Description: Mark all notifications as read
- Auth: Required
- Response: { message }

==============================================================================
MESSAGE ENDPOINTS
==============================================================================

Base Path: /api/messages

GET /api/messages/conversations
- Description: Get user conversations
- Auth: Required
- Response: { conversations }

GET /api/messages/conversation/:conversation_id
- Description: Get conversation messages
- Auth: Required
- Response: { messages }

POST /api/messages
- Description: Send message
- Auth: Required
- Body: { receiver_id, message, product_id? }
- Response: { message }

==============================================================================
ADDRESS ENDPOINTS
==============================================================================

Base Path: /api/addresses

GET /api/addresses
- Description: Get user addresses
- Auth: Required
- Response: { addresses }

POST /api/addresses
- Description: Create address
- Auth: Required
- Body: { label, full_name, phone, address_line1, address_line2, city, province, postal_code, is_default }
- Response: { address }

PUT /api/addresses/:id
- Description: Update address
- Auth: Required
- Body: { label, full_name, phone, address_line1, address_line2, city, province, postal_code, is_default }
- Response: { address }

DELETE /api/addresses/:id
- Description: Delete address
- Auth: Required
- Response: { message }

PUT /api/addresses/:id/set-default
- Description: Set default address
- Auth: Required
- Response: { address }

==============================================================================
ADMIN ENDPOINTS
==============================================================================

Base Path: /api/admin

GET /api/admin/users
- Description: Get all users
- Auth: Admin required
- Query: page, limit, role, search
- Response: { users, pagination }

POST /api/admin/users
- Description: Create user
- Auth: Admin required
- Body: { username, email, password, role, first_name, last_name }
- Response: { user }

GET /api/admin/products
- Description: Get all products
- Auth: Admin required
- Query: page, limit, status, category
- Response: { products, pagination }

PUT /api/admin/products/:id/approve
- Description: Approve product
- Auth: Admin required
- Response: { product }

PUT /api/admin/products/:id/reject
- Description: Reject product
- Auth: Admin required
- Body: { rejection_reason }
- Response: { product }

GET /api/admin/orders
- Description: Get all orders
- Auth: Admin required
- Query: page, limit, status
- Response: { orders, pagination }

PUT /api/admin/orders/:id/status
- Description: Update order status
- Auth: Admin required
- Body: { status }
- Response: { order }

GET /api/admin/categories
- Description: Get all categories
- Auth: Admin required
- Response: { categories }

POST /api/admin/categories
- Description: Create category
- Auth: Admin required
- Body: { name, description, type }
- Response: { category }

PUT /api/admin/categories/:id
- Description: Update category
- Auth: Admin required
- Body: { name, description, type, is_disabled }
- Response: { category }

DELETE /api/admin/categories/:id
- Description: Delete category
- Auth: Admin required
- Response: { message }

GET /api/admin/farmers
- Description: Get farmers
- Auth: Admin required
- Query: page, limit, verification_status
- Response: { farmers, pagination }

PUT /api/admin/farmers/:id/verify
- Description: Verify farmer
- Auth: Admin required
- Response: { farmer }

PUT /api/admin/farmers/:id/unverify
- Description: Unverify farmer
- Auth: Admin required
- Response: { farmer }

GET /api/admin/logs
- Description: Get admin audit logs
- Auth: Admin required
- Query: page, limit, action, entity
- Response: { logs, pagination }

==============================================================================
SUPER ADMIN ENDPOINTS
==============================================================================

Base Path: /api/superadmin

GET /api/superadmin/settings
- Description: Get platform settings
- Auth: Super Admin required
- Response: { settings }

PUT /api/superadmin/settings
- Description: Update platform settings
- Auth: Super Admin required
- Body: { key, value }
- Response: { setting }

GET /api/superadmin/feature-flags
- Description: Get feature flags
- Auth: Super Admin required
- Response: { feature_flags }

PUT /api/superadmin/feature-flags/:key
- Description: Update feature flag
- Auth: Super Admin required
- Body: { enabled }
- Response: { feature_flag }

==============================================================================
FARMER ENDPOINTS
==============================================================================

Base Path: /api/farmers

GET /api/farmers/profile
- Description: Get farmer profile
- Auth: Farmer required
- Response: { farmer }

PUT /api/farmers/profile
- Description: Update farmer profile
- Auth: Farmer required
- Body: { shop_name, shop_description, shop_banner_url, shop_avatar_url }
- Response: { farmer }

GET /api/farmers/analytics
- Description: Get farmer analytics
- Auth: Farmer required
- Response: { analytics }

==============================================================================
SUBSCRIPTION ENDPOINTS
==============================================================================

Base Path: /api/subscriptions

GET /api/subscriptions/tiers
- Description: Get subscription tiers
- Auth: None
- Response: { tiers }

POST /api/subscriptions/subscribe
- Description: Subscribe to tier
- Auth: Farmer required
- Body: { tier, duration, payment_account_id }
- Response: { subscription }

GET /api/subscriptions/my
- Description: Get current subscription
- Auth: Farmer required
- Response: { subscription }

==============================================================================
SUPPORT TICKET ENDPOINTS
==============================================================================

Base Path: /api/support-tickets

GET /api/support-tickets
- Description: Get support tickets
- Auth: Required
- Response: { tickets }

POST /api/support-tickets
- Description: Create support ticket
- Auth: Required
- Body: { subject, message, category }
- Response: { ticket }

PUT /api/support-tickets/:id/status
- Description: Update ticket status
- Auth: Admin required
- Body: { status }
- Response: { ticket }

==============================================================================
PSGC ENDPOINTS
==============================================================================

Base Path: /api/psgc

GET /api/psgc/provinces
- Description: Get provinces
- Auth: None
- Query: zone
- Response: { provinces }

GET /api/psgc/cities
- Description: Get cities/municipalities
- Auth: None
- Query: zone, province
- Response: { cities }

GET /api/psgc/barangays
- Description: Get barangays
- Auth: None
- Query: city
- Response: { barangays }

==============================================================================
HEALTH ENDPOINT
==============================================================================

GET /_health
- Description: Health check
- Auth: None
- Response: { status }

==============================================================================
AUTHENTICATION
==============================================================================

Protected endpoints require JWT token in Authorization header:

Authorization: Bearer <token>

Token payload includes:
- id: User ID
- role: User role (customer, farmer, admin, super_admin)
- email: User email
- username: Username

==============================================================================
AUTHORIZATION
==============================================================================

Role-based access control enforced via middleware:

- authenticateToken: Validates JWT token
- requireRole('role1', 'role2'): Requires specific role

Roles hierarchy:
- customer: Basic access
- farmer: Product and order management
- admin: User and product approval
- super_admin: Full platform access

==============================================================================
ERROR RESPONSES
==============================================================================

Standard error format:

{
  "message": "Error description",
  "error": "Detailed error info (in development)"
}

HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

==============================================================================
END
==============================================================================