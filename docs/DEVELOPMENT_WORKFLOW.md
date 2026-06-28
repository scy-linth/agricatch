# AgriCatch Development Workflow
Version: 1.0 Enterprise
Status: Active

==============================================================================
PURPOSE
==============================================================================

This document defines the standard engineering workflow for implementing,
debugging, reviewing, testing, and deploying changes in AgriCatch.

Every task should follow this workflow unless explicitly instructed otherwise.

Repository implementation is always the source of truth.

==============================================================================
STANDARD IMPLEMENTATION WORKFLOW
==============================================================================

1. Understand the request

2. Read AGENTS.md

3. Follow .windsurfrules

4. Inspect the repository

5. Inspect affected files

6. Inspect related modules

7. Inspect architecture

8. Inspect configuration

9. Inspect feature flags (if applicable)

10. Inspect database (if applicable)

11. Consult Context7 (if external documentation is required)

12. Plan implementation

13. Implement

14. Debug using Chrome DevTools MCP

15. Verify workflow using Browser MCP

16. Run Playwright only when automation or regression testing is required

17. Perform self review

18. Complete

Never skip directly to implementation.

==============================================================================
BUG FIX WORKFLOW
==============================================================================

1. Reproduce the issue

2. Identify root cause

3. Verify architecture

4. Implement the smallest safe fix

5. Verify with Chrome DevTools MCP

6. Verify complete workflow using Browser MCP

7. Assess regressions

8. Complete

Never patch blindly.

==============================================================================
NEW FEATURE WORKFLOW
==============================================================================

Before implementation:

- Understand requirements
- Identify affected modules
- Identify architectural impact
- Reuse existing components
- Preserve business rules

Avoid unnecessary redesigns.

==============================================================================
LARGE IMPLEMENTATION POLICY
==============================================================================

Large implementations should:

- Produce an implementation plan
- Split work into logical batches
- Verify each completed batch
- Minimize regression risk

Avoid implementing large architectural changes in a single pass.

==============================================================================
CODE REVIEW WORKFLOW
==============================================================================

Review:

- Correctness
- Maintainability
- Security
- Performance
- Architecture
- Regression risk

Provide evidence-based findings.

==============================================================================
VERIFICATION WORKFLOW
==============================================================================

Preferred verification order:

1. Chrome DevTools MCP

2. Browser MCP

3. Existing automated tests

4. Playwright (if required)

5. Manual verification

==============================================================================
COMPLETION CHECKLIST
==============================================================================

Before completion verify:

□ Requirements satisfied

□ Existing functionality preserved

□ No architectural regressions

□ No duplicate logic

□ No unnecessary files

□ UI consistency maintained

□ Security reviewed

□ Performance reviewed

□ Chrome DevTools verification completed

□ Browser MCP verification completed

□ Playwright executed when appropriate

==============================================================================
END
==============================================================================