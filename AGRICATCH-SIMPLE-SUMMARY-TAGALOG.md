# AgriCatch - Simple Flow Summary (Tagalog)

**Madaling Intindihan na Buod ng Sistema**

---

## MGA USER ROLES

**Guest (Bisita)**
- Puwedeng mag-browse ng products
- Puwedeng mag-search at mag-filter
- Puwedeng mag-add sa cart (guest)
- Hindi puwedeng bumili (kailangan mag-register muna)

**Customer (Buyer)**
- Lahat ng guest permissions
- Puwedeng bumili ng products
- Puwedeng mag-manage ng wishlist
- Puwedeng mag-place ng orders
- Puwedeng mag-cancel ng orders (pending lang)
- Puwedeng mag-message sa farmers
- Puwedeng mag-review ng products (delivered orders lang)
- Puwedeng mag-manage ng addresses

**Farmer (Seller)**
- Puwedeng mag-create ng products (pending status)
- Puwedeng mag-update ng sariling products
- Puwedeng mag-manage ng inventory
- Puwedeng mag-create ng pre-order products
- Puwedeng mag-view ng customer orders
- Puwedeng mag-update ng order status
- Puwedeng mag-cancel ng orders (early stages lang)
- Puwedeng mag-message sa customers
- Puwedeng mag-rate ng customers
- Puwedeng mag-subscribe sa premium

**Admin (Administrator)**
- Puwedeng mag-verify ng farmers
- Puwedeng mag-approve ng products
- Puwedeng mag-reject ng products
- Puwedeng mag-view ng lahat ng orders
- Puwedeng mag-update ng order status
- Puwedeng mag-manage ng categories
- Puwedeng mag-view ng audit logs
- Puwedeng mag-manage ng support tickets

**Super Admin (Owner)**
- Lahat ng admin permissions
- Puwedeng mag-modify ng platform settings
- Puwedeng mag-manage ng feature flags
- Puwedeng mag-disable ng kahit sinong user
- Full system control

---

## AUTHENTICATION FLOW

**Registration**
1. User pumunta sa index.html#login
2. Mag-fill ng registration form (username, email, password, name, role)
3. Client-side validation
4. reCAPTCHA verification (kung enabled)
5. POST /api/auth/register
6. Backend validates (unique username/email, password strength, name <= 40 chars)
7. Password hashed with bcrypt
8. User inserted sa database
9. JWT token generated
10. Token stored sa localStorage
11. Redirect based on role

**Login**
1. User pumunta sa index.html#login
2. Mag-fill ng login form (email/username, password)
3. OTP verification (kung enabled)
4. POST /api/auth/login
5. Backend validates (exists, password match, not disabled)
6. JWT token generated
7. Token stored sa localStorage
8. Redirect based on role
9. Activity logged

**Logout**
1. User clicks logout
2. Token removed from localStorage
3. Redirect to index.html#login
4. Activity logged

---

## CUSTOMER FLOW

**Browse Products**
1. Pumunta sa index.html
2. Browse approved and available products
3. Search at filter by category
4. View product details
5. Add to wishlist or cart

**Cart & Checkout**
1. Add products sa cart
2. Pumunta sa checkout
3. Piliin ang delivery address (saved o new)
4. Review order items
5. Confirm order
6. Order created (status='pending')
7. Cart cleared
8. Redirect to orders.html

**Orders**
1. View orders sa orders.html
2. Tabs: All, Active, Delivered, Cancelled
3. Cancel order (pending/preorder_reserved lang)
4. Rate product (delivered lang)
5. View order details

**Reviews**
1. Delivered orders lang puwedeng i-review
2. 1-5 stars rating
3. Comment optional
4. Editable for 1 month after delivery

---

## FARMER FLOW

**Product Creation**
1. Pumunta sa farmer.html
2. Click "Add Product"
3. Fill product form (name, description, price, category, image, stock, etc.)
4. If pre-order: set preorder_availability_date
5. POST /api/products
6. Product created with status='pending', is_available=false
7. Requires admin approval before visible to customers

**Product Approval**
1. Admin reviews pending products
2. Admin approves → status='approved', is_available=true
3. Admin rejects → status='rejected'
4. Email notification sent to farmer
5. Product visible to customers after approval

**Order Processing**
1. View customer orders sa farmer dashboard
2. Order status flow:
   - pending → confirmed (farmer accepts)
   - confirmed → preparing (farmer prepares)
   - preparing → scheduled (farmer schedules delivery)
   - scheduled → out_for_delivery (farmer starts delivery)
   - out_for_delivery → delivered (farmer marks as delivered)
   - delivered → completed (farmer/admin completes)
3. Cancel orders (pending/confirmed/preparing lang)
4. Inventory restored on cancellation

**Verification**
1. Farmer registers (is_verified=false)
2. Request verification (kung implemented)
3. Admin reviews request
4. Admin approves → is_verified=true
5. Verification badge displayed
6. Admin rejects → is_verified remains false

**Premium Subscription**
1. Farmer requests premium subscription
2. Select plan duration (1/3/6 months)
3. Upload payment proof
4. Admin reviews request
5. Admin approves → status='active', expires_at set
6. Premium features unlocked (higher product limit, premium badge)

---

## ORDER LIFECYCLE

**Regular Order Flow**
```
pending → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
```

**Pre-order Flow**
```
preorder_reserved → confirmed → preparing → scheduled → out_for_delivery → delivered → completed
```

**Cancellation Rules**
- Customer: puwedeng i-cancel pending at preorder_reserved
- Farmer: puwedeng i-cancel pending, confirmed, preparing
- Admin/Super Admin: puwedeng i-cancel lahat except delivered/completed/cancelled

**Status Changes**
- pending → confirmed (farmer)
- confirmed → preparing (farmer)
- preparing → scheduled (farmer)
- scheduled → out_for_delivery (farmer)
- out_for_delivery → delivered (farmer/admin/super_admin)
- delivered → completed (farmer/admin/super_admin)
- any status → cancelled (based on role rules)

---

## PRODUCT LIFECYCLE

**Product Status Flow**
```
pending → approved → available
pending → rejected
approved → unavailable (toggle availability)
approved → disabled (admin)
```

**Creation**
1. Farmer creates product
2. status='pending', is_available=false
3. Not visible to customers
4. Requires admin approval

**Approval**
1. Admin reviews pending product
2. Approve → status='approved', is_available=true
3. Reject → status='rejected'
4. Email notification to farmer

**Availability**
- Farmer can toggle is_available
- Admin can set is_admin_disabled=true
- Customer visibility requires: status='approved', is_available=true, is_admin_disabled=false, farmer.is_disabled=false

**Pre-order Products**
- is_preorder=true
- preorder_availability_date set
- reserved_quantity tracked
- Customers can reserve before availability
- On availability date: converted to regular order

---

## MESSAGING SYSTEM

**Who Can Message Whom**
- Customer ↔ Farmer: Allowed
- Admin ↔ Farmer: Allowed
- Customer ↔ Customer: Not allowed
- Farmer ↔ Farmer: Not allowed
- Customer ↔ Admin: Not allowed (use support tickets)

**Conversation Flow**
1. User initiates message
2. conversation_id generated (${farmerId}_${customerId})
3. Messages stored with sender/receiver
4. is_read flag tracks read status
5. last_message_at updated
6. Real-time via server-sent events

---

## NOTIFICATION SYSTEM

**Notification Types**
- order_created (farmer)
- order_status_changed (customer)
- new_review (farmer)
- review_updated (farmer)
- support_ticket (ticket creator)
- platform_announcement (target audience)
- product_approved (farmer)
- product_rejected (farmer)

**Actions**
- Mark as read
- Mark all as read
- Filter by type
- Paginate

---

## SUPPORT TICKET SYSTEM

**Ticket Creation**
1. User creates support ticket (subject, description, priority)
2. Status: open
3. Admin receives notification

**Ticket Processing**
1. Admin reviews ticket
2. Admin updates status to in_progress
3. Admin responds via support messages
4. User receives notification
5. User responds if needed
6. Admin resolves issue
7. Admin updates status to resolved
8. Admin closes ticket

**Status Flow**
```
open → in_progress → resolved → closed
```

---

## KEY BUSINESS RULES

**Authentication**
- JWT-based authentication
- Password hashed with bcrypt
- OTP verification (optional/strict/disabled)
- reCAPTCHA verification (auto/always_on/always_off)

**Product Approval**
- New products: status='pending', is_available=false
- Requires admin approval before customer visibility
- Admin can approve/reject
- Approved products: status='approved', is_available=true

**Order Validation**
- Per-item orders (each product = separate order)
- Inventory decremented on order
- Inventory restored on cancellation
- Pre-order: reserved_quantity instead of stock_quantity

**Role-Based Access**
- JWT token includes role
- Middleware enforces role-based API access
- Frontend checks role for page access
- Higher roles can access lower role features

**Name Field Limits**
- shop_name, first_name, middle_name, last_name: max 40 chars
- full_name: max 130 chars
- Validated across database, backend, and frontend

---

## QUICK REFERENCE

**Customer Pages**
- index.html (Landing)
- checkout.html (Checkout)
- orders.html (My Orders)
- wishlist.html (Wishlist)
- chat.html (Messaging)
- customer-account.html (Account)
- notifications.html (Notifications)

**Farmer Pages**
- farmer.html (Dashboard)
- chat.html (Messaging)
- notifications.html (Notifications)

**Admin Pages**
- admin.html (Dashboard)
- chat.html (Messaging)
- notifications.html (Notifications)

**API Base URLs**
- Local: http://localhost:3000/api
- Production: https://agricatch.onrender.com/api
- Custom domain: https://agricatch.store → uses Render API

---

## END-TO-END USER JOURNEY (Customer)

1. **Registration**
   - Register as customer
   - Login
   - Redirect to index.html

2. **Browse & Buy**
   - Browse products
   - Add to cart
   - Checkout
   - Select address
   - Confirm order

3. **Order Tracking**
   - View orders
   - Track status updates
   - Receive notifications

4. **Delivery**
   - Order delivered
   - Receive notification

5. **Review**
   - Rate product
   - Write review
   - Rate farmer (if applicable)

---

## END-TO-END USER JOURNEY (Farmer)

1. **Registration**
   - Register as farmer
   - Login
   - Redirect to farmer.html

2. **Verification** (Optional)
   - Request verification
   - Admin approves
   - Verification badge displayed

3. **Product Creation**
   - Create product
   - Wait for admin approval
   - Product approved
   - Product visible to customers

4. **Order Processing**
   - Receive order notification
   - Accept order
   - Prepare order
   - Schedule delivery
   - Start delivery
   - Mark as delivered
   - Complete order

5. **Premium** (Optional)
   - Subscribe to premium
   - Upload payment proof
   - Admin approves
   - Premium features unlocked

---

**Ito ang simplified flow ng AgriCatch system. Para sa mas detalyadong documentation, tingnan ang AGRICATCH-DOCUMENTATION files.**
