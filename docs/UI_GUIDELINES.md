# AgriCatch UI Guidelines
Version: 2.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document documents the actual UI guidelines in AgriCatch based on the
repository implementation.

Repository implementation is the source of truth.

==============================================================================
DESIGN SYSTEM
==============================================================================

Frameworks
- Bootstrap 5.3.3
- Bootstrap Icons 1.11.3
- Font Awesome 6.5.2
- Simple DataTables

Base Template
- NiceAdmin (BootstrapMade) for admin/farmer dashboards
- Custom design for customer-facing pages

==============================================================================
CSS ARCHITECTURE
==============================================================================

Stylesheets (frontend/css/)
- styles.css - Main customer-facing styles
- nicemain.css - NiceAdmin base template (admin/farmer)
- agricatch-admin.css - Admin/farmer dashboard overrides
- admin.css - Admin-specific styles

Loading Order
1. Bootstrap CSS
2. Bootstrap Icons
3. Font Awesome
4. NiceAdmin CSS (nicemain.css)
5. AgriCatch Admin CSS (agricatch-admin.css)
6. Admin-specific CSS (admin.css)
7. Page-scoped CSS (inline <style>)

==============================================================================
COLOR PALETTE
==============================================================================

Brand Colors (agricatch-admin.css CSS variables)
--ac-primary: #2d7a3a
--ac-primary-dark: #1e5429
--ac-primary-light: #e8f5e9
--ac-primary-muted: #c8e6c9

Loading Screen Colors
--primary-color: #4ade80
--secondary-color: #0ea5e9
--white: #ffffff

Surface Colors
--ac-bg: #f5f7f5
--ac-surface: #ffffff
--ac-border: #e2e8e4
--ac-border-light: #eef2ef

Text Colors
--ac-text: #1a2e1e
--ac-text-muted: #6b7e72
--ac-text-subtle: #95a89c
--ac-heading: #111d14

Sidebar Colors
--ac-sidebar-bg: #ffffff
--ac-sidebar-border: #e8ede9

Status Palette (Order Statuses)
--s-pending: #d97706 / --s-pending-bg: #fffbeb
--s-confirmed: #2563eb / --s-confirmed-bg: #eff6ff
--s-preparing: #7c3aed / --s-preparing-bg: #f5f3ff
--s-preorder_reserved: #9333ea / --s-preorder_reserved-bg: #faf5ff
--s-ready: #059669 / --s-ready-bg: #ecfdf5
--s-delivered: #2d7a3a / --s-delivered-bg: #f0faf2
--s-completed: #2d7a3a / --s-completed-bg: #f0faf2
--s-cancelled: #dc2626 / --s-cancelled-bg: #fef2f2
--s-refunded: #9333ea / --s-refunded-bg: #faf5ff

Bootstrap Override
--bs-primary: #2d7a3a
--bs-primary-rgb: 45, 122, 58

==============================================================================
TYPOGRAPHY
==============================================================================

Fonts
- Open Sans (body text)
- Nunito (headings)
- Google Fonts loaded in admin/farmer dashboards

Font Sizes
- Base: 14px (Open Sans)
- Headings: Nunito with varying weights
- Page title: 24px, weight 600

==============================================================================
LAYOUT STRUCTURE
==============================================================================

Customer Pages (index.html)
- Header with navigation
- Hero section
- Product grid
- Footer

Admin/Farmer Dashboards (admin.html, farmer.html)
- Sidebar navigation
- Main content area
- Mobile menu toggle
- Loading screen

Admin Dashboard Structure
<main id="main" class="main admin-main">
- Page title section
- Content cards
- Data tables
- Forms
</main>

Sidebar Structure
<aside id="farmer-sidebar" class="sidebar admin-sidebar">
- Navigation links
- User account section
- Mobile overlay
</aside>

Farmer Dashboard Sections
- overview
- products
- orders
- reviews
- shop
- chat

All sections use class: admin-section-card

==============================================================================
COMPONENTS
==============================================================================

Buttons
- Bootstrap button classes (btn-primary, btn-secondary, btn-danger)
- Override with --ac-primary color
- Primary actions: btn-primary
- Secondary actions: btn-secondary
- Destructive actions: btn-danger

Cards
- Bootstrap card classes
- Border radius from NiceAdmin
- Shadows from NiceAdmin
- admin-section-card class for dashboard sections

Tables
- Bootstrap table classes
- Simple DataTables for enhanced functionality
- Responsive design support
- Consistent column headers

Forms
- Bootstrap form classes
- maxlength="40" for name fields (shop_name, first_name, middle_name, last_name)
- Client-side validation
- Server-side validation

Modals
- Bootstrap modal classes
- Product preview modal: .product-details-modal.active
- Standard modals: .modal.open
- Customer rating modal: .modal.open
- Avoid deeply nested modals

Badges
- Bootstrap badge classes
- Status badges use status palette colors
- Used for: status, labels, availability, notifications

Icons
- Bootstrap Icons (primary)
- Font Awesome (secondary)
- Consistent icon usage
- Clear action communication

==============================================================================
RESPONSIVE DESIGN
==============================================================================

Breakpoints
- Desktop: > 1199px
- Tablet: 768px - 1199px
- Mobile: < 768px

Mobile Considerations
- Sidebar collapses on mobile
- Mobile menu toggle button
- Sidebar overlay for mobile
- Touch-friendly targets
- Avoid horizontal scrolling

==============================================================================
LOADING STATES
==============================================================================

Loading Screen
- admin-loading-screen element
- Displays during initial load
- Hides when page ready
- Uses primary/secondary colors

API Loading
- Display loading indicators during API requests
- Display during form submissions
- Display during data loading
- Avoid blank screens

==============================================================================
EMPTY STATES
==============================================================================

Provide meaningful empty states:
- Explanation text
- Recommended action
- Icon or illustration
- Avoid empty containers

==============================================================================
ERROR STATES
==============================================================================

Display clear and actionable error messages:
- Form validation errors
- API error messages
- Never expose internal system errors
- User-friendly language

==============================================================================
NOTIFICATIONS
==============================================================================

Notification Display
- Clear and concise
- Relevant to user
- Non-intrusive
- Badge for unread count

Notification Types
- Order status changes
- Product approval/rejection
- Price drops
- Platform announcements

==============================================================================
SPECIAL UI PATTERNS
==============================================================================

Conversation Items (Support Tickets)
- conversation-item--ticket class
- Border-left: 3px solid #6c757d
- Unread: border-left-color: var(--ac-primary)
- conversation-subject for subject text
- ticket-status-control for status dropdown

Chat Thread
- chat-thread-header for header
- chat-thread-identity for user info
- chat-thread-reason for reason text

Order Tabs
- order-tabs class
- tab-content for tab panels
- Consistent tab behavior

Product Form
- product-form class
- Standard form layout
- Image upload handling

==============================================================================
PAGE-SCOPED CSS
==============================================================================

Inline <style> blocks in HTML for:
- Modal overrides
- Product details modal
- Order tabs
- Chat layout
- Admin detail panel
- Mobile sidebar (@media queries)

==============================================================================
UI CONSISTENCY RULES
==============================================================================

Reuse existing:
- Colors (CSS variables)
- Spacing (Bootstrap spacing scale)
- Typography (Open Sans, Nunito)
- Iconography (Bootstrap Icons, Font Awesome)
- Buttons (Bootstrap classes)
- Cards (Bootstrap classes)
- Badges (Bootstrap classes)
- Dialogs (Bootstrap modals)
- Tables (Bootstrap classes)
- Form patterns (Bootstrap classes)

Avoid introducing new UI patterns when suitable ones already exist.

==============================================================================
ACCESSIBILITY
==============================================================================

Provide:
- Keyboard accessibility
- Visible focus indicators
- Sufficient color contrast
- Accessible labels
- Semantic HTML

==============================================================================
UI REVIEW CHECKLIST
==============================================================================

Before completion verify:

□ Existing UI patterns reused

□ Colors remain consistent (CSS variables)

□ Typography remains consistent (Open Sans, Nunito)

□ Responsive behavior verified

□ Accessibility considered

□ Loading states implemented

□ Empty states implemented

□ Error handling implemented

□ No unnecessary redesigns

□ Bootstrap classes used correctly

□ NiceAdmin template preserved (admin/farmer)

□ Name fields have maxlength="40"

==============================================================================
END
==============================================================================