# Farmer Verification Request UI Design

**Date:** 2025-06-17
**Status:** Approved

## Overview

Add complete verification request workflow UI for both farmers and admins:
- **Farmer UI:** Request verification, view status, coordinate payment via chat
- **Admin UI:** Review requests, approve/reject with reasons, manage verification workflow

Verification enables unlimited products, priority approval, custom product names, and advanced analytics. Payment coordination happens through existing chat system with admin.

## Requirements

### Functional Requirements
**Farmer Side:**
- Farmers can submit verification requests with a single button click
- Farmers can upload ID/document image (JPG/PNG) with request (optional but recommended)
- Cloudinary auto-optimization for uploaded images (quality: auto, fetch_format: auto)
- Display verification request status in two locations: profile dropdown and overview banner
- Show different states: no request, pending, approved, rejected
- Handle rejection reason display when request is rejected
- Prevent duplicate requests when one is already pending
- Prevent requests from already verified farmers

**Admin Side:**
- Admins can view all verification requests with pagination and status filter
- Admins can approve verification requests (auto-verifies farmer)
- Admins can reject verification requests with required reason
- Admins can view farmer details (shop, products, orders) when reviewing
- Admins can view uploaded ID/document images in review modal
- Admins can open chat conversation with farmer from review modal
- Admins receive notifications when new requests are submitted

### Non-Functional Requirements
- Follow existing UI patterns in farmer dashboard
- Use Bootstrap 5 components and existing CSS classes
- Persist banner dismissal state in localStorage
- Show user-friendly error messages for API failures

## Architecture

### Components

#### 1. Profile Dropdown Menu
**File:** `frontend/farmer.html`
**Location:** User account dropdown in sidebar header

**States:**
- **Unverified, no pending request**: Show "Request Verification" button
- **Pending request**: Show yellow badge "Pending Review"
- **Verified**: Show green checkmark badge "Verified"
- **Rejected**: Show red badge "Rejected" - click to show rejection reason modal with "Submit New Request" button

**API Integration:**
- Button click → Open verification request modal
- Status check → `GET /api/farmers/me/verification-request`

#### 1.5. Verification Request Modal (Farmer)
**File:** `frontend/farmer.html`
**Location:** Modal that opens when clicking "Request Verification"

**Components:**
- File input for ID/document upload (JPG/PNG, max 5MB)
- Preview of uploaded image
- Notes textarea (optional)
- Submit and Cancel buttons

**Behavior:**
- File upload optional but recommended
- Cloudinary auto-optimization (quality: auto, fetch_format: auto) applied on upload
- Image preview shows after selection
- Submit → Upload to Cloudinary with optimization → `POST /api/farmers/me/verification-request` with document_url
- On success → close modal, show toast, navigate to chat

#### 2. Overview Section Banner
**File:** `frontend/farmer.html`
**Location:** Top of overview section, before stats cards

**States:**
- **No request**: Hidden
- **Pending**: Yellow alert with "Verification Request Pending - Chat with admin to coordinate payment" + "Open Chat" button
- **Approved**: Green success alert with "Account Verified! You now have unlimited products and advanced analytics"
- **Rejected**: Red danger alert with rejection reason and "Submit new request after addressing feedback"

**Behavior:**
- Dismissible (can close)
- Persists dismissal state in localStorage
- Reappears if status changes

#### 3. JavaScript Logic
**File:** `frontend/js/farmer.js`

**Functions:**
- `loadVerificationStatus()` - Fetch and display current status
- `openVerificationRequestModal()` - Open request modal
- `uploadToCloudinary(file)` - Upload image to Cloudinary with auto-optimization (quality: auto, fetch_format: auto)
- `handleVerificationRequest()` - Submit new request with document_url and navigate to chat
- `previewDocumentImage()` - Show preview of uploaded image
- `updateVerificationUI()` - Update dropdown and banner based on status
- `showVerificationBanner()` - Display banner with appropriate message
- `dismissVerificationBanner()` - Handle banner dismissal
- `showRejectionModal(reason)` - Display rejection reason modal
- `closeRejectionModal()` - Close rejection modal
- `handleResubmitRequest()` - Submit new request after rejection

#### 4. Admin Verification Requests UI
**File:** `frontend/admin.html`
**Location:** New section "Verification Requests" in admin sidebar

**Components:**
- **Requests Table:** List all verification requests with columns:
  - Farmer name, shop name, email
  - Request date, status (pending/approved/rejected)
  - Product count, delivered orders count
  - Document uploaded indicator
  - Actions (Approve/Reject buttons)
- **Status Filter:** Tabs for All/Pending/Approved/Rejected
- **Review Modal:** Opens when clicking Approve/Reject
  - Shows farmer details (shop, products, orders)
  - Shows uploaded document image preview (if any)
  - "View Chat" button to open conversation with farmer
  - For rejection: Reason textarea (required)
  - Confirm/Cancel buttons
- **Pagination:** 20 requests per page

**API Integration:**
- Load requests → `GET /api/admin/verification-requests`
- Approve → `PUT /api/admin/verification-requests/:id/review` with status=approved
- Reject → `PUT /api/admin/verification-requests/:id/review` with status=rejected + reason

**Functions:**
- `loadVerificationRequests()` - Fetch and display requests
- `filterVerificationRequests(status)` - Filter by status
- `openReviewModal(requestId, action)` - Open approve/reject modal
- `handleReviewAction()` - Submit approve/reject decision

**Data Flow:**
1. Page load → `loadVerificationStatus()` → GET API
2. Update dropdown button/badge
3. Update overview banner if applicable
4. User clicks request button → `handleVerificationRequest()` → POST API
5. On success → refresh status, show success toast, and automatically navigate to chat section
6. On error → show error toast

### API Endpoints

#### Farmer Endpoints
#### GET /api/farmers/me/verification-request
**Response:**
```json
{
  "request": {
    "id": 1,
    "status": "pending",
    "notes": null,
    "rejection_reason": null,
    "created_at": "2025-06-17T10:00:00Z",
    "reviewed_at": null
  }
}
```

#### POST /api/farmers/me/verification-request
**Request Body:**
```json
{
  "document_url": "https://res.cloudinary.com/.../agricatch/verification/5/20250617-123456.jpg",
  "notes": "Additional information"
}
```

**Response:**
```json
{
  "message": "Verification request submitted successfully",
  "request_id": 1,
  "created_at": "2025-06-17T10:00:00Z"
}
```

#### Admin Endpoints
#### GET /api/admin/verification-requests
**Query Params:** `?status=pending&page=1&limit=20`
**Response:**
```json
{
  "requests": [
    {
      "id": 1,
      "farmer_id": 5,
      "status": "pending",
      "documents": null,
      "notes": null,
      "rejection_reason": null,
      "created_at": "2025-06-17T10:00:00Z",
      "reviewed_at": null,
      "username": "johnfarmer",
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "9123456789",
      "address": "123 Farm St",
      "shop_name": "John's Farm",
      "shop_description": "Organic vegetables",
      "shop_avatar_url": null,
      "product_count": 5,
      "delivered_orders": 12
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

#### PUT /api/admin/verification-requests/:id/review
**Request Body:**
```json
{
  "status": "approved",
  "rejection_reason": null
}
```
or
```json
{
  "status": "rejected",
  "rejection_reason": "Insufficient documentation"
}
```

**Response:**
```json
{
  "message": "Verification request approved"
}
```

## UI Design

### Dropdown Menu Item
```html
<a class="dropdown-item" href="#" id="verification-request-btn">
  <i class="bi bi-shield-check"></i>
  <span>Request Verification</span>
</a>
```

### Verification Request Modal (Farmer)
```html
<div class="modal" id="verification-request-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3>Request Account Verification</h3>
      <button class="close-btn" onclick="closeVerificationRequestModal()">✕</button>
    </div>
    <div class="modal-body">
      <form id="verification-request-form">
        <div class="mb-3">
          <label>Upload ID/Document (optional but recommended)</label>
          <input type="file" class="form-control" id="verification-document" accept="image/jpeg,image/png" />
          <small class="text-muted">JPG/PNG, max 5MB</small>
        </div>
        <div id="document-preview" class="mb-3" style="display:none;">
          <img id="document-preview-img" style="max-width:100%; max-height:200px;" />
        </div>
        <div class="mb-3">
          <label>Additional Notes (optional)</label>
          <textarea class="form-control" id="verification-notes" rows="3"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Submit Request</button>
        <button type="button" class="btn btn-secondary" onclick="closeVerificationRequestModal()">Cancel</button>
      </form>
    </div>
  </div>
</div>
```

### Status Badge (Dropdown)
```html
<span class="badge bg-warning" id="verification-status-badge">
  <i class="bi bi-clock"></i> Pending Review
</span>
```

### Overview Banner
```html
<div class="alert alert-warning alert-dismissible" id="verification-banner">
  <i class="bi bi-info-circle"></i>
  Verification Request Pending - Chat with admin to coordinate payment
  <button type="button" class="btn btn-sm btn-primary ms-2" id="open-chat-btn">Open Chat</button>
  <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
</div>
```

### Rejection Reason Modal
```html
<div class="modal" id="verification-rejection-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3>Verification Request Rejected</h3>
      <button class="close-btn" onclick="closeRejectionModal()">✕</button>
    </div>
    <div class="modal-body">
      <p id="rejection-reason-text"></p>
      <button class="btn btn-primary" id="resubmit-verification-btn">Submit New Request</button>
    </div>
  </div>
</div>
```

### Admin Verification Requests Section
```html
<section id="verification-requests" class="admin-section-card">
  <div class="card-header">
    <h3>Verification Requests</h3>
  </div>
  <div class="card-body">
    <!-- Status Filter Tabs -->
    <div class="verification-tabs mb-3">
      <button class="tab-btn active" data-status="all">All</button>
      <button class="tab-btn" data-status="pending">Pending</button>
      <button class="tab-btn" data-status="approved">Approved</button>
      <button class="tab-btn" data-status="rejected">Rejected</button>
    </div>
    
    <!-- Requests Table -->
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Shop</th>
            <th>Products</th>
            <th>Orders</th>
            <th>Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="verification-requests-table">
          <!-- Dynamic content -->
        </tbody>
      </table>
    </div>
    
    <!-- Pagination -->
    <nav id="verification-pagination"></nav>
  </div>
</section>
```

### Admin Review Modal
```html
<div class="modal" id="admin-review-modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="review-modal-title">Review Verification Request</h3>
      <button class="close-btn" onclick="closeReviewModal()">✕</button>
    </div>
    <div class="modal-body">
      <div id="review-farmer-details"></div>
      <div id="review-document-section" class="mt-3" style="display:none;">
        <h5>Uploaded Document</h5>
        <img id="review-document-img" style="max-width:100%; max-height:300px;" />
      </div>
      <div class="mt-3">
        <button class="btn btn-info" id="view-chat-btn">
          <i class="bi bi-chat"></i> View Chat
        </button>
      </div>
      <div id="rejection-reason-section" class="mt-3" style="display:none;">
        <label>Rejection Reason (required):</label>
        <textarea class="form-control" id="rejection-reason-input" rows="3"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeReviewModal()">Cancel</button>
      <button class="btn btn-success" id="approve-btn">Approve</button>
      <button class="btn btn-danger" id="reject-btn">Reject</button>
    </div>
  </div>
</div>
```

## Error Handling

- **Network error**: Show toast "Failed to connect. Please check your connection."
- **Already verified**: Show toast "Your account is already verified."
- **Pending request exists**: Show status instead of button
- **API error**: Show toast "Something went wrong. Please try again."
- **Duplicate request**: Backend returns 400, show toast "You already have a pending request."

## Testing

### Manual Testing Checklist
**Farmer Side:**
- [ ] Unverified farmer sees "Request Verification" button in dropdown
- [ ] Clicking button opens verification request modal
- [ ] File upload accepts JPG/PNG files up to 5MB
- [ ] Image preview shows after file selection
- [ ] Submitting request with file upload works successfully
- [ ] Submitting request without file works (optional)
- [ ] After submission, automatically navigates to chat section with success toast
- [ ] Button changes to "Pending Review" badge after submission
- [ ] Overview banner shows pending status with payment coordination message
- [ ] "Open Chat" button in banner navigates to chat section
- [ ] Banner can be dismissed and state persists
- [ ] Already verified farmer sees green "Verified" badge
- [ ] Rejected request shows red badge with rejection reason
- [ ] Clicking rejected badge opens modal with rejection reason
- [ ] Modal "Submit New Request" button allows resubmission
- [ ] Error messages display correctly for network failures
- [ ] Toast notifications show for success/error states

**Admin Side:**
- [ ] Admin sees "Verification Requests" section in sidebar
- [ ] Verification requests table loads with all requests
- [ ] Table shows document upload indicator
- [ ] Status filter tabs work (All/Pending/Approved/Rejected)
- [ ] Pagination works correctly
- [ ] Approve button opens review modal with farmer details
- [ ] Review modal shows uploaded document image preview (if uploaded)
- [ ] "View Chat" button opens chat conversation with farmer
- [ ] Reject button opens review modal with reason textarea
- [ ] Approve action successfully verifies farmer
- [ ] Reject action requires reason and successfully rejects
- [ ] Admin receives notification when new request submitted
- [ ] Table refreshes after approve/reject action

## Implementation Notes

- Use existing toast notification system in farmer.js
- Follow existing modal patterns for rejection reason display
- Use localStorage key: `verificationBannerDismissed`
- Match existing alert styles in agricatch-admin.css
- Ensure responsive design works on mobile
- **Image Storage:** Use Cloudinary (existing infrastructure)
- **Cloudinary Folder Structure:** `agricatch/verification/{userId}/{timestamp}`
- **Cloudinary Auto-optimization:** Use `quality: auto, fetch_format: auto` transformation on upload
- **Database Field:** `verification_requests.document_url` stores Cloudinary URL
- **Cloudinary Utils:** Add `publicIdForVerificationDocument(userId)` function to `backend/utils/cloudinary.js`
- Document file size limit: 5MB, formats: JPG/PNG only
- Document upload is optional but recommended for farmers

## Future Enhancements

### Real-time Status Updates
**Current:** Status only updates on page refresh or manual action
**Enhancement:** Add real-time updates when admin approves/rejects
- Option A: Use existing notification system to alert farmer when status changes
- Option B: Add simple polling every 30-60 seconds when status is pending
- Option C: WebSocket integration for instant updates

### Mobile-Specific Behavior
**Current:** Spec assumes desktop-first design
**Enhancement:** Explicit mobile behavior
- Dropdown menu behavior on small screens
- Banner sizing and dismissibility on mobile
- Touch-friendly button sizes
- Modal sizing and positioning on mobile
