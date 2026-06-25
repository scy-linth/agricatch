# Order Details Modal Redesign Design

## Overview
Rebuild the order details modal in farmer.html with a modern, agricultural-themed two-column layout that improves visual design, information hierarchy, UX, and mobile responsiveness.

## Goals
- Improve visual design with agricultural theme
- Better information hierarchy for easy scanning
- Enhance UX with clearer actions
- Ensure mobile responsiveness
- Display all critical order information (product, customer, delivery, status, payment)

## Layout Structure

### Modal Container
- Width: 800px (up from 600px)
- Max-height: 90vh with scroll
- Background: White with subtle green leaf pattern overlay (5% opacity)
- Border: 2px solid #2d7a3a (primary green)
- Border-radius: 12px
- Shadow: Deep shadow for depth

### Header
- Height: 60px
- Background: Linear gradient from #2d7a3a to #1e5a2e (agricultural green)
- Left: Order ID in white, bold, 18px
- Right: Status badge with white background, green text, pill shape
- Close button: White X on green background, hover turns light green

### Two-Column Grid
- CSS Grid: 2 columns (60% left, 40% right)
- Gap: 20px between columns
- Padding: 20px inside modal body

## Left Column - Product Card (Hero)

### Product Card Structure
- Background: Light green tint (#f0f7f0)
- Border: Light green border
- Border-radius: 8px
- Padding: 16px

### Content
1. **Product Image**: Large (200px height), centered, rounded corners (8px), object-fit cover
2. **Product Name**: Bold, 20px, dark green (#1a2e1e), margin-top 12px
3. **Category Badge**: Small pill badge, green background, white text, below name
4. **Price & Quantity**:
   - Price per unit in large text (24px, green accent)
   - Quantity multiplier (e.g., "× 5 kg")
   - Total amount highlighted (28px, bold, green)
5. **Product Details Grid**:
   - Harvest date (with calendar icon)
   - Best before/expiry date (with clock icon)
   - Stock remaining (with box icon)
   - Location (with map pin icon)
6. **Product Rating**: Stars + review count (if available)

### Icons
- Bootstrap Icons in green (#2d7a3a) for visual interest

## Right Column - Stacked Cards

### Card Structure
- Vertical stack of 4 cards
- Each card: White background, light green border (#e8f5e9), 8px border-radius, 12px padding
- Gap: 16px between cards

### Card 1: Customer Information
- Header: "Customer" with user icon (green)
- Content:
  - Name (bold, 16px) + verified badge (green checkmark if verified)
  - Phone number (clickable tel: link)
  - Email (clickable mailto: link)
  - Customer rating (stars + count, if available)

### Card 2: Delivery Information
- Header: "Delivery" with truck icon (green)
- Content:
  - Full address (multi-line if needed)
  - Delivery date (with calendar icon)
  - Special instructions (if any, in italic gray)
  - City/Province location (with map pin)

### Card 3: Order Status Timeline
- Header: "Status" with clock icon (green)
- Content: Vertical timeline showing:
  - Order placed (date/time)
  - Current status (highlighted in green)
  - Next expected step (if applicable)
  - Each step with icon and timestamp

### Card 4: Actions
- Header: "Actions" with gear icon (green)
- Content: Action buttons (full width, stacked)
  - Primary action (green background)
  - Secondary actions (light green/gray)
  - Same buttons as current getOrderActionButtons()

## Mobile Responsiveness

### Breakpoint
- Below 768px (Bootstrap md breakpoint)

### Mobile Layout
- Switch from 2-column to single column vertical stack
- Product card stays at top (full width)
- Other cards stack below in order: Customer → Delivery → Status → Actions
- Modal width: 95% of viewport (max-width: 600px)
- Product image: Smaller (150px height) to save space
- Action buttons: Fixed at bottom of modal (sticky) for easy access
- Scrollable content area between product card and fixed actions

### Touch Optimization
- Larger tap targets (minimum 44px height)
- Spacing between clickable elements
- No hover-dependent interactions

## Loading & Error States

### Loading State
- Skeleton loader for each card while data is being fetched
- Shimmer effect on product image placeholder
- Gray placeholder rectangles for text content
- Maintains card structure so layout doesn't shift

### Error State
- If order data fails to load: Show error message in modal body
- "Unable to load order details. Please try again."
- Retry button to attempt reload
- Close button to dismiss modal

### Empty State
- If order has no items: Show "No items in this order" message
- If customer info missing: Show "Customer information unavailable"
- Graceful degradation for missing data

## Implementation Details

### CSS Structure
- Add page-scoped CSS in farmer.html `<style>` block
- Use CSS Grid for two-column layout
- Custom classes:
  - `.order-details-modal-content`
  - `.order-product-card`
  - `.order-info-card`
  - `.order-timeline`
- Agricultural theme colors:
  - Primary green: #2d7a3a
  - Light green: #e8f5e9
  - Dark green: #1a2e1e

### JavaScript Changes
- Refactor `openOrderModal()` function to use new HTML structure
- Add timeline rendering logic
- Keep existing data fetching from `lastOrdersById`
- Maintain existing action button logic via `getOrderActionButtons()`

### Data Requirements
- Ensure order object has:
  - Customer info (name, email, phone, verified status)
  - Delivery details (address, date, special instructions)
  - Product details (image, name, quantity, price, harvest/expiry dates)
  - Status timeline
- Add fallbacks for missing data (graceful degradation)

## Files to Modify
1. `frontend/farmer.html` - Update modal HTML structure and add CSS
2. `frontend/js/farmer.js` - Refactor `openOrderModal()` function

## Success Criteria
- Modal displays all order information clearly
- Product is prominent (hero position)
- Customer and delivery info easily accessible
- Status timeline shows order progression
- Action buttons are clear and accessible
- Works well on mobile devices
- Agricultural theme consistent with brand
- Loading states prevent layout shifts
- Error states are user-friendly
