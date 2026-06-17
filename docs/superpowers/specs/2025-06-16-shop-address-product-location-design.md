# Shop Address Auto-Fill for Product Location

## Overview
Implement Shopee/Lazada style address logic where product location defaults to the seller's shop address. This simplifies product creation while allowing optional override for flexibility.

## Problem Statement
Currently, farmers must manually enter location for each product. This is redundant when all products come from the same shop location, and inconsistent with major e-commerce platforms (Shopee, Lazada) where shop address is the default.

## Solution
Auto-fill product location from shop profile address. Make it readonly in add product modal (always uses shop address), and auto-populate in edit product modal with option to override.

## Design

### Add Product Modal
- **Location field**: `product-location` input becomes `readonly`
- **Placeholder**: "Auto-filled from shop address"
- **Hint text**: "Location is automatically set to your shop address. Contact admin to change shop location."
- **Behavior**: When modal opens, populate with `currentShopProfile.location` if available

### Edit Product Modal
- **Display field**: `edit-product-location-display` (readonly textarea) shows current product address
- **Address overlay modal**: Existing PSGC form (`edit-product-address-modal`) allows override
- **Auto-populate logic**:
  - If product has custom location: display it, populate PSGC fields from it
  - If product has no location or empty: auto-populate from shop address
- **Confirm button**: Copies formatted address from PSGC preview to display field

### Data Flow

#### Add Product
1. User clicks "Add Product"
2. Modal opens → `openAddProductModal()` in farmer.js
3. Read `this.currentShopProfile.location`
4. Set `product-location.value` to shop address
5. User fills other fields and submits
6. Form submission sends shop address as product location

#### Edit Product
1. User clicks "Edit" on product
2. Modal opens → `loadEditProductModal()` in farmer.js
3. Read `product.location`
4. If empty/missing: use `this.currentShopProfile.location`
5. Populate `edit-product-location-display` with address
6. Parse address with PSGC to populate dropdown fields
7. User can click "Set Location" to open overlay and override
8. On confirm: sync PSGC preview to display field
9. Form submission sends display field value as product location

### Implementation Details

#### farmer.js Changes

**In `openAddProductModal()`:**
```javascript
const shopLocation = this.currentShopProfile?.location || '';
const locationInput = document.getElementById('product-location');
if (locationInput) locationInput.value = shopLocation;
```

**In `loadEditProductModal()`:**
```javascript
const productLocation = product.location || '';
const shopLocation = this.currentShopProfile?.location || '';
const finalLocation = productLocation || shopLocation;

const displayEl = document.getElementById('edit-product-location-display');
if (displayEl) displayEl.value = finalLocation;

// Parse and populate PSGC fields from finalLocation
```

**Form submission (add product):**
- No changes needed, already reads from `product-location`

**Form submission (edit product):**
- Already reads from `edit-product-location-display` (set on confirm)

#### farmer.html Changes

**Add product modal:**
- Change `product-location` to `readonly`
- Update placeholder and hint text

**Edit product modal:**
- No changes needed (already has display field + overlay modal)

### Edge Cases

1. **Shop profile has no location set:**
   - Add product: location field remains empty
   - Edit product: if product has no location, remains empty
   - Hint text instructs to contact admin

2. **Product has existing custom location:**
   - Edit product: preserve and display existing location
   - PSGC fields populate from existing location
   - User can still override via overlay modal

3. **PSGC parsing fails:**
   - Fallback: display address as-is in street field
   - Preview shows raw address string

### Testing Checklist

- [ ] Add product modal auto-fills with shop address
- [ ] Add product location field is readonly
- [ ] Edit product modal shows product's existing location
- [ ] Edit product modal shows shop address if product has no location
- [ ] Address overlay modal opens and closes correctly
- [ ] Confirm button syncs address to display field
- [ ] Form submission sends correct address value
- [ ] Edge case: shop profile with no location
- [ ] Edge case: product with custom location preserved

## Success Criteria
- Product location auto-fills from shop address in add product modal
- Edit product modal auto-populates from shop address when product has no location
- Existing product locations are preserved on edit
- User can override address via PSGC overlay modal
