# Configurable Delivery Fee Design

**Date:** 2025-06-09
**Status:** Approved

## Overview
Make the delivery fee configurable via platform settings instead of being hardcoded. Allow super_admin to set delivery fee to 0 to disable it, which hides the delivery fee line item from checkout.

## Requirements
- Delivery fee currently hardcoded to 35 in `app.js`
- Super_admin can configure delivery fee in platform settings
- When set to 0, delivery fee line item is hidden in checkout
- Add explanatory message: "Set to 0 to disable delivery fee - it will not appear in checkout"
- Only super_admin role can access this setting

## Architecture & Data Flow

### Database
- Add `delivery_fee` key to existing `platform_settings` table
- Store as numeric value (e.g., "35", "0")
- Existing `GET/PUT /api/superadmin/settings` endpoints handle key-value pairs
- Initial value: 35 (inserted via migration)

### Frontend (Admin Panel)
- Platform settings section exists in admin.html (super_admin only)
- Add delivery_fee input field with explanatory message
- Input type: number, min="0", step="1"
- Default value: 35

### Frontend (Checkout)
- On app load, call public API to get delivery_fee
- Store in localStorage as `cached_delivery_fee` with timestamp
- In checkout summary, conditionally show delivery fee line:
  - If delivery_fee > 0: show "Delivery Fee: ₱X.XX"
  - If delivery_fee == 0: hide the line item entirely
- Calculate grand total: subtotal + (delivery_fee > 0 ? delivery_fee : 0)

### Cache Refresh
- Add "Refresh Settings" button in platform settings to clear localStorage cache
- Cache TTL: 1 hour (optional, can use manual refresh only)

## Components

### Backend Components
1. **Migration Script** - Insert initial `delivery_fee = 35` into `platform_settings` table if not exists
2. **Public API Endpoint** (new) - `GET /api/settings/delivery-fee` - returns delivery_fee value without authentication

### Frontend Components
1. **Admin Platform Settings Form** - Add delivery_fee input field in existing platform-settings section
2. **Cache Management** - Functions to get/set/clear delivery_fee from localStorage
3. **Checkout Logic** - Modify existing checkout calculation in `app.js` to use cached delivery_fee

### Modified Files
- `database/migrations/` - add migration script for delivery_fee
- `backend/routes/` - add public endpoint for delivery_fee
- `frontend/admin.html` - add delivery_fee input to platform settings
- `frontend/js/admin.js` - handle delivery_fee in save/load platform settings
- `frontend/js/app.js` - fetch and cache delivery_fee, modify checkout logic

## Error Handling & Edge Cases

### API Failures
- If public delivery_fee API fails, fallback to default value of 35
- If platform_settings API fails on admin side, show error message but keep existing values
- Log errors to console for debugging

### Validation
- Admin input: minimum value 0, no maximum (reasonable limit like 1000 suggested)
- Reject negative numbers
- Reject non-numeric values

### Cache Scenarios
- First visit: no cache, fetch from API
- Cache exists but expired (optional TTL): fetch fresh
- Cache exists and valid: use cached value
- Manual refresh: clear cache and fetch fresh

### Edge Cases
- Empty/null value in database: treat as 0 (no delivery fee)
- Database migration fails: log error, continue with hardcoded 35 as fallback
- Multiple tabs open: localStorage syncs automatically

## Testing Strategy

### Unit Tests
- Test public API endpoint returns delivery_fee correctly
- Test cache functions (get/set/clear)
- Test checkout calculation with different fee values

### Integration Tests
- Admin sets delivery_fee to 0 → checkout hides line item
- Admin sets delivery_fee to 50 → checkout shows line item with ₱50
- Cache refresh clears and refetches value

### Manual Testing
- Verify platform settings form shows delivery_fee input with correct message
- Verify only super_admin can access the field
- Verify checkout UI updates correctly after cache refresh
