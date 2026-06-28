# AgriCatch Coding Standards
Version: 1.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document defines the coding standards for AgriCatch.

Every implementation should prioritize readability, consistency,
maintainability, and production quality.

Repository implementation is the source of truth.

==============================================================================
GENERAL PRINCIPLES
==============================================================================

Write code that is:

- Readable
- Maintainable
- Consistent
- Modular
- Reusable

Prefer clarity over cleverness.

==============================================================================
NAMING CONVENTIONS
==============================================================================

Use descriptive names.

Prefer:

- productId
- farmerProfile
- orderStatus
- wishlistItems

Avoid:

- data1
- temp2
- value
- obj
- x

==============================================================================
FILE ORGANIZATION
==============================================================================

Modify existing files whenever appropriate.

Avoid creating unnecessary files.

Group related functionality together.

==============================================================================
FUNCTIONS
==============================================================================

Functions should:

- Have one responsibility
- Be reusable
- Be easy to understand
- Avoid unnecessary complexity

Prefer small focused functions.

==============================================================================
VARIABLES
==============================================================================

Prefer:

- const whenever possible
- let only when reassignment is required

Avoid var.

==============================================================================
CODE REUSE
==============================================================================

Before creating new logic:

- Search existing utilities
- Search existing helpers
- Search existing components

Reuse existing implementations whenever possible.

==============================================================================
ERROR HANDLING
==============================================================================

Handle errors gracefully.

Provide meaningful error messages.

Never silently ignore errors.

==============================================================================
COMMENTS
==============================================================================

Write comments only when necessary.

Explain:

- Why

Avoid explaining:

- What obvious code already explains

==============================================================================
FORMATTING
==============================================================================

Maintain consistent:

- Indentation
- Spacing
- Line breaks
- Bracket placement

Avoid formatting-only commits.

==============================================================================
SECURITY
==============================================================================

Never:

- Hardcode secrets
- Expose credentials
- Trust client-side validation

Validate server-side.

==============================================================================
PERFORMANCE
==============================================================================

Prefer:

- Efficient algorithms
- Existing utilities
- Minimal DOM updates

Avoid unnecessary optimization.

==============================================================================
UI CONSISTENCY
==============================================================================

Reuse existing:

- Components
- Buttons
- Cards
- Tables
- Forms
- Modals
- Icons

Avoid duplicate UI patterns.

==============================================================================
DATABASE
==============================================================================

Prefer:

- Existing queries
- Existing repositories
- Safe schema changes

Avoid destructive modifications.

==============================================================================
CODE REVIEW CHECKLIST
==============================================================================

Before completion verify:

□ Naming is descriptive

□ Functions have single responsibility

□ Existing code reused

□ No duplicate logic

□ Readability maintained

□ Security considered

□ Performance considered

□ Architecture preserved

==============================================================================
END
==============================================================================