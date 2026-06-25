# Task 14: Remove Archive Functionality from farmer.js

## Files
- Modify: `frontend/js/farmer.js`

## Interfaces
- Consumes: Existing archive-related JavaScript code
- Produces: Removed archive functionality

## Steps

### Step 1: Find and remove archive-related JavaScript

Search for and remove:
- Archive-related functions
- Archive status badge references
- Archive filter logic
- Archive action handlers
- Archive event listeners

### Step 2: Commit

```bash
git add frontend/js/farmer.js
git commit -m "refactor: remove archive functionality from farmer.js"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
