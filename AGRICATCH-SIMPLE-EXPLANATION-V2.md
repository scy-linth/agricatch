# AgriCatch - Simple Explanation

AgriCatch is a website that connects people who want to buy fresh farm products directly with the farmers who grow them.

## How It Works

### People on AgriCatch

There are different types of people who use AgriCatch:

**Customers** - People who want to buy fresh farm products like vegetables, fruits, and other crops.

**Farmers** - People who grow and sell farm products. Farmers can be "verified" (checked and approved by the system) or "non-verified" (new farmers waiting to be checked).

**Admins** - People who manage the website. They check farmers, approve products, and help with problems.

**Super Admins** - The main managers who control important website settings.

---

## For Customers (Buyers)

### Getting Started

**Before You Log In**
- You can look at products and see what farmers are selling
- You can see product details like prices, pictures, and descriptions
- You can add products to your shopping cart (but you need to log in to buy)
- You can contact the team through the "Contact Us" section (this sends an email)

**Creating an Account**
- You need to provide your email, username, and password
- You choose if you are a Customer or a Farmer
- You may need to verify your email with a code sent to you
- Your name (first, middle, last) can only be 40 letters or less
- Your phone number must be 10 digits and start with 9

**Logging In**
- You use your email or username and your password
- The system keeps you logged in with a special code (token)

### What You Can Do

**Shopping**
- Browse products from different farmers
- See which products are "Available Now" (ready to deliver)
- See which products are "Pre-order" (you reserve now, get later)
- Add products to your wishlist to save them for later
- Add products to your cart
- Select which items in your cart you want to buy
- Checkout and pay for your order

**Orders**
- View all your orders in one place
- See order status: Pending → Confirmed → Preparing → On the Way → Delivered
- For pre-orders: Pending → Reserved → Confirmed → Preparing → On the Way → Delivered
- Cancel orders if they are still pending
- Chat with the farmer about your order
- Rate products after they are delivered (within 1 month)
- See why an order was cancelled

**Reviews**
- Give a star rating (1 to 5 stars) for products you bought
- Write comments about the product
- You can only review products that were delivered to you
- You can only review within 1 month after delivery
- Farmers can also rate customers after delivery

**Wishlist**
- Save products you like by clicking the heart icon
- See all your saved products in one place
- Add wishlist items to your cart
- Remove items from your wishlist
- See if prices went down since you saved them

**Addresses**
- Add multiple delivery addresses
- Set one address as your default
- Your address includes: street, barangay, city, province
- Phone number must be 10 digits starting with 9

**Messages**
- Chat with farmers about products or orders
- See your message history
- Know when you have unread messages

**Notifications**
- Get alerts about order updates
- Get alerts when farmers reply to your messages
- Get alerts about new announcements
- Mark notifications as read

**Support Tickets**
- If you have a problem, you can create a support ticket
- Only logged-in customers and farmers can create tickets
- Write the subject and description of your problem
- Choose priority: low, medium, or high
- Admins will review and help you
- You can chat within the ticket
- See ticket status: Open → In Progress → Resolved → Closed

---

## For Farmers (Sellers)

### Getting Started

**Creating an Account**
- You register as a Farmer
- Provide your email, username, password
- Provide your shop name (40 letters or less)
- Provide your name (first, middle, last - 40 letters each)
- Provide your phone number (10 digits starting with 9)
- Provide your farm location

**Verification**
- New farmers start as "non-verified"
- You can request to be verified
- Upload documents to prove you are a real farmer
- Admins will check your request
- If approved, you get a "verified" badge
- If rejected, you can try again with a new request
- Being verified helps customers trust you more

### What You Can Do

**Products**
- Add products to sell
- Choose if product is "Available Now" or "Pre-order"
- For "Available Now": set how many items you have in stock
- For "Pre-order": set when it will be available and how many people can reserve
- Upload product pictures
- Set the price per unit (per kilo, per piece, etc.)
- Write a description (500 letters or less)
- Choose the category (vegetables, fruits, etc.)
- New products start as "pending" - waiting for admin approval
- Admins approve or reject your products
- You can edit your products
- You can disable products you don't want to sell anymore

**Premium Farmer (Paid Subscription)**
- You can pay to become a Premium Farmer
- Choose a plan: 1 month, 3 months, or 6 months
- Upload proof of payment
- Admins approve your subscription
- Premium features include:
  - Request new product names (if a product isn't in the list)
  - More visibility on the platform

**Orders**
- See orders from customers
- Update order status: Pending → Confirmed → Preparing → On the Way → Delivered
- For pre-orders: you set the harvest date and when it will be available
- If harvest date changes, you can update it and tell customers why
- Cancel orders if needed (inventory is returned to customer)
- Chat with customers about their orders

**Reviews**
- See reviews customers wrote about your products
- See your average rating
- Rate customers after delivering their orders (within 1 month)

**Messages**
- Chat with customers about products or orders
- Chat with admins if you need help
- See your message history
- Know when you have unread messages

**Notifications**
- Get alerts about new orders
- Get alerts when customers message you
- Get alerts about new reviews
- Get alerts about product approval status
- Get alerts about subscription status

**Support Tickets**
- Create support tickets if you have problems
- Chat with admins within tickets
- See ticket status updates

**Shop Profile**
- See your shop information
- Edit your shop details
- See your verification status
- See your subscription status

---

## For Admins (Website Managers)

### What You Can Do

**User Management**
- See all users on the website
- Create new user accounts
- Edit user information
- Disable users who break rules
- Enable disabled users
- When you disable a farmer, their products are also disabled
- When you disable a user, their active orders are cancelled

**Product Management**
- See all products
- Approve or reject pending products
- Disable products that break rules
- Enable disabled products
- Manage product categories

**Farmer Verification**
- See farmer verification requests
- Approve farmers who provide valid documents
- Reject farmers with invalid documents
- Write reasons for rejection

**Subscription Management**
- See farmer subscription requests
- Approve premium subscriptions after checking payment proof
- Reject invalid payment proofs

**Support Tickets**
- See all support tickets
- Update ticket status
- Reply to tickets
- Help customers and farmers with problems

**Messages**
- Chat with farmers who need help
- See message history

**Audit Logs**
- See a record of all admin actions
- Regular admins only see their own actions
- Super admins see all actions

---

## For Super Admins (Main Managers)

### What You Can Do

**Everything Admins Can Do** - Plus:

**Admin Management**
- See all admin and super admin accounts
- Create new admin accounts
- Edit admin information
- Disable other admins if needed

**Platform Settings**
- Change website settings
- Turn features on or off (feature flags)
- Set general platform rules

**Announcements**
- Send announcements to all users
- Send announcements to specific groups (farmers, customers, admins)

**System Status**
- Check if the website is working properly
- Check database connection
- Check external services (email, image storage, etc.)

**Audit Logs**
- See all actions by all admins
- Full visibility of platform activity

---

## Important Things to Know

### Product Selling Modes

**Available Now**
- Product is ready to deliver
- Customer buys and gets it soon
- Stock is deducted when order is placed
- If stock runs out, product shows as "out of stock"

**Pre-order**
- Product is not ready yet
- Customer reserves it now
- Farmer sets when it will be available
- Customer gets it when it's ready
- Farmer can update the harvest date if needed
- Limited number of people can reserve (max preorder quantity)

### Order Status Flow

**Regular Orders:**
1. Pending - Order placed, waiting for farmer to confirm
2. Confirmed - Farmer accepted the order
3. Preparing - Farmer is getting the product ready
4. On the Way - Product is being delivered
5. Delivered - Customer received the product
6. Cancelled - Order was cancelled (by customer or farmer)

**Pre-orders:**
1. Pending - Reservation placed
2. Reserved - Customer's reservation is confirmed
3. Confirmed - Farmer confirmed the pre-order
4. Preparing - Farmer is preparing for harvest/delivery
5. On the Way - Product is being delivered
6. Delivered - Customer received the product
7. Cancelled - Reservation was cancelled

### Who Can Chat With Whom

- Customers can chat with Farmers
- Farmers can chat with Customers and Admins
- Admins can chat with Farmers
- Customers cannot chat with other Customers
- Farmers cannot chat with other Farmers

### Notifications

Notifications are alerts that tell you something important happened:
- Order status changed
- New message received
- New review posted
- Product approved or rejected
- Account disabled or enabled
- Products disabled or enabled
- New announcement from Super Admin
- Fraud alerts (if suspicious activity detected)

### Reviews

**Product Reviews (by Customers)**
- Only after delivery
- Within 1 month of delivery
- Rating: 1 to 5 stars
- Optional comment
- Can update or delete within the time limit
- Farmer's average rating updates automatically

**Customer Ratings (by Farmers)**
- Only after delivery
- Within 1 month of delivery
- Rating: 1 to 5 stars
- Customer's average rating updates automatically

### Delivery Address

- Default delivery address is Trabajo Market in Manila
- This can be changed by Super Admin in platform settings
- If custom address is enabled, customers can set their own address
- Address includes: street, barangay, city, province
- Phone number must be 10 digits starting with 9

### Security

- Passwords are protected (scrambled so no one can read them)
- reCAPTCHA is used to prevent robots from creating accounts
- Name fields are limited to 40 characters
- Phone numbers must be valid Philippine numbers

---

## Summary

AgriCatch is a simple way to buy fresh farm products directly from farmers. Customers can browse, buy, and review products. Farmers can sell their harvest and manage orders. Admins keep everything running smoothly. The system is designed to be safe, easy to use, and helpful for everyone involved.
