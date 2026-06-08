You are implementing Task 1: Create public settings API endpoint

## Task Description

### Task 1: Create public settings API endpoint

**Files:**
- Create: `backend/routes/settings.js`
- Modify: `backend/server.js:879-883`

- [ ] **Step 1: Create the settings route file**

```javascript
const express = require('express');
const { pool } = require('../utils/db');

const router = express.Router();

// ── GET /api/settings/delivery-fee ─────────────────────────────────────────────
// Public endpoint - no authentication required
// Returns the delivery fee value from platform_settings
router.get('/delivery-fee', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'delivery_fee'`
    );
    
    if (result.rows.length === 0) {
      // Return default if not set
      return res.json({ delivery_fee: 35 });
    }
    
    const value = parseFloat(result.rows[0].value);
    // Treat null/invalid as 0 (no delivery fee)
    const deliveryFee = isNaN(value) ? 0 : value;
    
    res.json({ delivery_fee: deliveryFee });
  } catch (err) {
    console.error('Error fetching delivery fee:', err);
    // Fallback to default on error
    res.json({ delivery_fee: 35 });
  }
});

module.exports = router;
```

- [ ] **Step 2: Register the settings route in server.js**

Find the section where routes are registered (around line 879) and add:

```javascript
try {
  app.use('/api/settings', require('./routes/settings'));
  console.log('✓ Settings route loaded successfully');
} catch (error) {
  console.error('✗ Settings route failed to load:', error.message);
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/settings.js backend/server.js
git commit -m "feat: add public settings API endpoint for delivery fee"
```

## Context

This is the first task in implementing configurable delivery fee. You're creating a new public API endpoint that customers can call to get the current delivery fee without authentication. This endpoint will be called by the frontend to fetch and cache the delivery fee value.

The backend uses Express.js with PostgreSQL. Routes are registered in server.js using app.use(). The pool database connection is available from utils/db.

This task is independent and can be completed before other tasks.

## Before You Begin

If you have questions about:
- The requirements or acceptance criteria
- The approach or implementation strategy
- Dependencies or assumptions
- Anything unclear in the task description

**Ask them now.** Raise any concerns before starting work.

## Your Job

Once you're clear on requirements:
1. Implement exactly what the task specifies
2. Verify implementation works
3. Commit your work
4. Self-review (see below)
5. Report back

Work from: d:\Codings\AgriCatch

**While you work:** If you encounter something unexpected or unclear, **ask questions**.
It's always OK to pause and clarify. Don't guess or make assumptions.

## Code Organization

You reason best about code you can hold in context at once, and your edits are more
reliable when files are focused. Keep this in mind:
- Follow the file structure defined in the plan
- Each file should have one clear responsibility with a well-defined interface
- If a file you're creating is growing beyond the plan's intent, stop and report
  it as DONE_WITH_CONCERNS — don't split files on your own without plan guidance
- If an existing file you're modifying is already large or tangled, work carefully
  and note it as a concern in your report
- In existing codebases, follow established patterns. Improve code you're touching
  the way a good developer would, but don't restructure things outside your task.

## When You're in Over Your Head

It is always OK to stop and say "this is too hard for me." Bad work is worse than
no work. You will not be penalized for escalating.

**STOP and escalate when:**
- The task requires architectural decisions with multiple valid approaches
- You need to understand code beyond what was provided and can't find clarity
- You feel uncertain about whether your approach is correct
- The task involves restructuring existing code in ways the plan didn't anticipate
- You've been reading file after file trying to understand the system without progress

**How to escalate:** Report back with status BLOCKED or NEEDS_CONTEXT. Describe
specifically what you're stuck on, what you've tried, and what kind of help you need.
The controller can provide more context, re-dispatch with a more capable model,
or break the task into smaller pieces.

## Before Reporting Back: Self-Review

Review your work with fresh eyes. Ask yourself:

**Completeness:**
- Did I fully implement everything in the spec?
- Did I miss any requirements?
- Are there edge cases I didn't handle?

**Quality:**
- Is this my best work?
- Are names clear and accurate (match what things do, not how they work)?
- Is the code clean and maintainable?

**Discipline:**
- Did I avoid overbuilding (YAGNI)?
- Did I only build what was requested?
- Did I follow existing patterns in the codebase?

If you find issues during self-review, fix them now before reporting.

## Report Format

When done, report:
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- What you implemented (or what you attempted, if blocked)
- What you tested and test results
- Files changed
- Self-review findings (if any)
- Any issues or concerns

Use DONE_WITH_CONCERNS if you completed the work but have doubts about correctness.
Use BLOCKED if you cannot complete the task. Use NEEDS_CONTEXT if you need
information that wasn't provided. Never silently produce work you're unsure about.
