# AgriCatch Testing Guide
Version: 1.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document defines the standard verification process for all changes.

Every implementation must be verified before completion.

Repository implementation is the source of truth.

==============================================================================
TESTING OBJECTIVES
==============================================================================

Every implementation should verify:

- Correctness
- Stability
- Regression Safety
- Security
- Performance
- User Experience

==============================================================================
STANDARD WORKFLOW
==============================================================================

1. Inspect Repository
2. Implement
3. Chrome DevTools MCP
4. Browser MCP
5. Playwright (if required)
6. Self Review
7. Complete

==============================================================================
CHROME DEVTOOLS MCP
==============================================================================

Use Chrome DevTools MCP to verify:

- Console
- Network
- DOM
- CSS
- Layout
- Responsive Design
- Accessibility
- Performance
- Storage

Fix all critical issues before proceeding.

==============================================================================
BROWSER MCP
==============================================================================

Use Browser MCP to verify:

- Navigation
- User workflows
- Forms
- Checkout
- Wishlist
- Cart
- Orders
- Messaging
- Notifications
- Dashboard functionality

Verify the complete user experience.

==============================================================================
PLAYWRIGHT
==============================================================================

Use Playwright only when:

- Regression testing is required
- End-to-end automation is required
- Multi-role verification is required
- Existing tests need maintenance

Playwright is not the primary debugging tool.

==============================================================================
REGRESSION CHECKLIST
==============================================================================

Customer

□ Login
□ Browse Products
□ Search
□ Category Filter
□ Wishlist
□ Cart
□ Checkout
□ Orders
□ Notifications
□ Messaging
□ Reviews

Farmer

□ Login
□ Dashboard
□ Product Management
□ Inventory
□ Hybrid Pre-order
□ Orders
□ Analytics
□ Messaging

Admin

□ Login
□ Product Approval
□ Farmer Verification
□ User Management
□ Reports

Super Admin

□ Login
□ Platform Settings
□ Administrative Functions
□ Maintenance Features

==============================================================================
SELF REVIEW
==============================================================================

Before completion verify:

□ Request completed

□ Existing functionality preserved

□ No obvious regressions

□ Architecture preserved

□ No duplicate logic

□ No unnecessary files

□ Security considered

□ Production compatibility maintained

==============================================================================
DEFINITION OF DONE
==============================================================================

A task is complete only when:

- Feature works correctly.
- Existing functionality still works.
- Regression assessment completed.
- Verification completed.
- Code is production ready.
- Architecture remains consistent.

==============================================================================
END
==============================================================================