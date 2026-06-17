# Farmer Profile Migration Design

## Overview
Add a "My Profile" section to farmer.html similar to admin.html, with the distinction between shop name (public-facing) and owner's personal name (private/admin use). Update admin.html to display both shop name and owner name as separate columns for farmer records.

## Problem Statement
Currently, farmer.html lacks a "My Profile" section for managing personal information (first name, middle name, last name, phone, password). The existing "Shop Profile" section only manages shop name, location, and description. Additionally, the database uses a single `full_name` field for both shop name (farmers) and personal name (customers/admins), making it impossible to distinguish between the two.

## Requirements

### Database Changes
1. Add new columns to `users` table:
   - `shop_name` VARCHAR(100) - Public shop/farm name (for farmers)
   - `first_name` VARCHAR(50) - Owner's first name
   - `middle_name` VARCHAR(50) - Owner's middle name (optional)
   - `last_name` VARCHAR(50) - Owner's last name

2. Migration logic:
   - For all users: Split existing `full_name` into `first_name`, `middle_name`, `last_name`
     - Last word = last_name
     - First word = first_name
     - Middle words = middle_name (if any)
   - For farmers only: Set `shop_name` = current `full_name` (as default)
   - Keep `full_name` as computed field: `first_name || ' ' || COALESCE(middle_name || ' ', '') || last_name`

### Frontend Changes

#### farmer.html
1. Add new "My Profile" section with ID `profile` and class `admin-section-card`
2. Profile section structure:
   - Left column: Profile card with avatar, shop name, owner name, role
   - Right column: 3 tabs (Overview, Edit Profile, Change Password)
3. Tab content:
   - **Overview**: Display shop name, owner name, email, phone, role, joined date
   - **Edit Profile**: Form with first_name, middle_name, last_name, phone
   - **Change Password**: Current password, new password, confirm password
4. Keep existing "Shop Profile" section (ID `shop`) - this is separate from personal profile
5. Add "My Profile" link to sidebar dropdown menu

#### farmer.js
1. Add event listeners for profile tab navigation
2. Add functions:
   - `loadProfile()` - Fetch and display current profile data
   - `updateProfile()` - Submit profile changes to API
   - `changePassword()` - Submit password change to API
3. Update `showSection()` to handle profile navigation
4. Update sidebar dropdown "My Account" button to navigate to profile section

#### admin.html
1. Update Farmers table to show 2 separate columns:
   - "Shop Name" column
   - "Owner Name" column (first_name + last_name)
2. Update farmer edit modal to include:
   - Shop name field
   - First name, middle name, last name fields

#### admin.js
1. Update farmers table rendering to display both shop name and owner name columns
2. Update farmer edit modal to handle shop_name, first_name, middle_name, last_name fields
3. Update farmer save endpoint to include new fields

### Backend Changes

#### API Endpoints
1. Update `/api/users/me` endpoint to return:
   - `shop_name`
   - `first_name`
   - `middle_name`
   - `last_name`
2. Add `/api/users/profile` endpoint for updating profile:
   - Accepts: first_name, middle_name, last_name, phone
   - Returns: Updated user object
3. Update farmer edit endpoint in `/api/admin/farmers/:id` to handle:
   - shop_name
   - first_name
   - middle_name
   - last_name

#### Validation
- first_name: required, max 50 chars
- middle_name: optional, max 50 chars
- last_name: required, max 50 chars
- shop_name: required for farmers, max 100 chars
- phone: optional, format validation (10 digits starting with 9)

## Data Flow

### Loading Profile
1. User clicks "My Account" in sidebar dropdown
2. `showSection('profile')` is called
3. `loadProfile()` fetches user data from `/api/users/me`
4. Profile data is displayed in Overview tab
5. Edit Profile form is pre-populated with current values

### Updating Profile
1. User fills Edit Profile form and clicks "Save Changes"
2. Form data is validated (required fields, phone format)
3. `updateProfile()` sends POST to `/api/users/profile`
4. Backend updates database and returns updated user object
5. UI is refreshed with new data
6. Success message is displayed

### Changing Password
1. User fills Change Password form and clicks "Change Password"
2. Form data is validated (current password required, new password confirmation)
3. `changePassword()` sends POST to `/api/users/change-password`
4. Backend validates current password and updates password
5. Success message is displayed
6. Form is cleared

## Error Handling
- Network errors: Display user-friendly error message
- Validation errors: Display inline error messages
- Auth errors: Redirect to login page
- Server errors: Display error message from server response

## Testing
- Manual testing of profile section navigation
- Test profile update with valid data
- Test profile update with invalid data (missing required fields)
- Test password change with correct current password
- Test password change with incorrect current password
- Test admin farmers table displays both columns correctly
- Test admin farmer edit modal saves all fields correctly

## Implementation Order
1. Database migration (add columns, migrate existing data)
2. Backend API updates (endpoints, validation)
3. farmer.html (add profile section HTML)
4. farmer.js (add profile functions, event listeners)
5. admin.html (update farmers table columns)
6. admin.js (update table rendering, edit modal)
7. Testing and verification
