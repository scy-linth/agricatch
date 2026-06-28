# AgriCatch Troubleshooting Guide
Version: 1.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document provides a standard troubleshooting workflow for diagnosing
and resolving issues in AgriCatch.

Always identify the root cause before implementing a fix.

Repository implementation is the source of truth.

==============================================================================
GENERAL TROUBLESHOOTING WORKFLOW
==============================================================================

1. Understand the reported issue

2. Reproduce the issue

3. Read browser console

4. Inspect network requests

5. Inspect related source code

6. Inspect backend logs

7. Inspect database (if applicable)

8. Verify configuration

9. Verify feature flags

10. Verify user role and permissions

11. Identify root cause

12. Implement the smallest safe fix

13. Verify using Chrome DevTools MCP

14. Verify complete workflow using Browser MCP

15. Run Playwright only if regression testing is required

==============================================================================
LOGIN ISSUES
==============================================================================

Verify:

- JWT generation
- Authentication middleware
- User status
- Account approval
- Token expiration
- Environment variables

==============================================================================
API ISSUES
==============================================================================

Verify:

- Request URL
- HTTP Method
- Authentication
- Authorization
- Validation
- Response format
- Backend logs

==============================================================================
DATABASE ISSUES
==============================================================================

Verify:

- Connection
- Query correctness
- Constraints
- Relationships
- Indexes
- Transactions

Never modify production data without approval.

==============================================================================
FRONTEND ISSUES
==============================================================================

Inspect using Chrome DevTools MCP:

- Console
- DOM
- CSS
- Network
- Storage
- Responsive Layout

==============================================================================
UI ISSUES
==============================================================================

Verify:

- Existing components
- Existing styles
- Layout consistency
- Responsive behavior
- Accessibility

Avoid unnecessary redesigns.

==============================================================================
PERFORMANCE ISSUES
==============================================================================

Inspect:

- Duplicate API calls
- Slow queries
- Large payloads
- Memory leaks
- Excessive DOM updates

==============================================================================
HYBRID PRE-ORDER ISSUES
==============================================================================

Verify:

- Reservation logic
- Inventory synchronization
- Checkout validation
- Customer workflow
- Farmer workflow
- Admin workflow

Protect existing architecture.

==============================================================================
WISHLIST ISSUES
==============================================================================

Verify:

- User ownership
- Authentication
- Product availability
- API responses
- UI synchronization

==============================================================================
ORDER ISSUES
==============================================================================

Verify:

- Status transitions
- Inventory updates
- Notifications
- Order history
- Business rules

==============================================================================
MESSAGING ISSUES
==============================================================================

Verify:

- Conversation ownership
- Authorization
- Message delivery
- Notification triggers

==============================================================================
NOTIFICATION ISSUES
==============================================================================

Verify:

- Trigger conditions
- Recipient
- Delivery logic
- Read status

==============================================================================
WHEN STUCK
==============================================================================

Do not repeatedly retry the same solution.

Instead:

- Reproduce again
- Gather more evidence
- Inspect the repository
- Review architecture
- Review business rules
- Explain the root cause
- Recommend the safest solution

==============================================================================
END
==============================================================================