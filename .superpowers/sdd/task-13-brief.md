# Task 13: Remove Archive Functionality from farmer.html

## Files
- Modify: `frontend/farmer.html`

## Interfaces
- Consumes: Existing archive-related UI elements
- Produces: Removed archive functionality

## Steps

### Step 1: Find and remove archive-related elements

Search for and remove:
- Archive tab/button in product list
- Archive filter dropdown option
- Archive status badge references
- Any archive-related buttons or actions

### Step 2: Commit

```bash
git add frontend/farmer.html
git commit -m "refactor: remove archive functionality from farmer.html"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
