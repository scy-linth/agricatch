# AgriCatch Contribution Guide
Version: 1.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document defines the engineering standards for contributing to the
AgriCatch codebase.

Every change should improve the system without compromising stability,
security, or maintainability.

Repository implementation is the source of truth.

==============================================================================
ENGINEERING PRINCIPLES
==============================================================================

Every contribution should prioritize:

1. Correctness
2. Stability
3. Maintainability
4. Security
5. User Experience
6. Performance

Avoid unnecessary redesigns.

==============================================================================
BEFORE WRITING CODE
==============================================================================

Always:

- Read AGENTS.md
- Follow .windsurfrules
- Inspect the repository
- Inspect related modules
- Understand the architecture
- Verify assumptions using the implementation

Never implement based on assumptions.

==============================================================================
IMPLEMENTATION STANDARDS
==============================================================================

Prefer:

- Small focused changes
- Existing utilities
- Existing components
- Existing design patterns
- Existing architecture

Avoid:

- Duplicate logic
- Large refactors without approval
- Unnecessary dependencies
- Breaking existing workflows

==============================================================================
CODE QUALITY
==============================================================================

Code should be:

- Readable
- Maintainable
- Consistent
- Modular
- Well-structured

Avoid unnecessary complexity.

==============================================================================
ARCHITECTURE
==============================================================================

Respect existing architecture.

Never redesign protected modules without explicit approval.

Preserve:

- Authentication
- Authorization
- Orders
- Checkout
- Hybrid Pre-order
- Wishlist
- Messaging
- Notifications
- Platform Settings

==============================================================================
UI CONTRIBUTIONS
==============================================================================

Reuse existing:

- Components
- Colors
- Typography
- Buttons
- Cards
- Forms
- Tables
- Icons
- Modals

Avoid introducing new UI patterns unless necessary.

==============================================================================
DATABASE CHANGES
==============================================================================

Prefer:

- Additive schema changes
- Safe migrations
- Backward compatibility

Avoid destructive changes.

==============================================================================
TESTING
==============================================================================

Every change should be verified using:

1. Chrome DevTools MCP
2. Browser MCP
3. Playwright (when required)

Never skip verification.

==============================================================================
SECURITY
==============================================================================

Never:

- Expose secrets
- Bypass authorization
- Trust client-side validation
- Leak sensitive data

Always validate server-side.

==============================================================================
PULL REQUEST CHECKLIST
==============================================================================

Before submitting changes verify:

□ Feature works correctly

□ Existing functionality preserved

□ Architecture preserved

□ No duplicate logic

□ No unnecessary files

□ UI consistency maintained

□ Security reviewed

□ Performance considered

□ Chrome DevTools verification completed

□ Browser MCP verification completed

□ Playwright executed (if required)

==============================================================================
DEFINITION OF DONE
==============================================================================

A contribution is complete only when:

- Requirements are satisfied.
- Existing functionality continues to work.
- Verification has been completed.
- No obvious regressions exist.
- Code is production-ready.
- Architecture remains consistent.

==============================================================================
END
==============================================================================