# Task 15: Add CSS for New Tabbed Interface

## Files
- Modify: `frontend/css/agricatch-admin.css` or add inline styles to `frontend/farmer.html`

## Interfaces
- Consumes: New tabbed HTML structure from Tasks 3, 5, 7, 8
- Produces: CSS styling for nested tabs and confirmation modals

## Steps

### Step 1: Add CSS for nested tabs

Add styles for the nested tabbed management sections:

```css
/* Nested tabbed management sections */
.management-tabs {
    margin-top: 1rem;
}

.management-tabs .nav-tabs {
    border-bottom: 2px solid #dee2e6;
    margin-bottom: 1rem;
}

.management-tabs .nav-link {
    border: none;
    border-bottom: 2px solid transparent;
    color: #6c757d;
    padding: 0.75rem 1rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.management-tabs .nav-link:hover {
    color: #0d6efd;
    border-bottom-color: #0d6efd;
}

.management-tabs .nav-link.active {
    color: #0d6efd;
    border-bottom-color: #0d6efd;
    background-color: transparent;
}

/* Purple progress bar for pre-orders */
.progress-bar.bg-purple {
    background-color: #6f42c1;
}

/* Reservation summary card */
.reservation-summary {
    background-color: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
}

.reservation-summary h6 {
    margin-bottom: 0.5rem;
    font-weight: 600;
}

.reservation-summary .progress {
    height: 8px;
    margin-top: 0.5rem;
}

/* Action buttons in edit modal */
.edit-modal-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 1rem;
}

.edit-modal-actions .btn {
    flex: 1;
    min-width: 120px;
}

/* Confirmation modals */
.modal.open {
    display: flex;
}

.modal-confirm-body {
    text-align: center;
    padding: 2rem;
}

.modal-confirm-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.modal-confirm-icon.text-success {
    color: #198754;
}

.modal-confirm-icon.text-warning {
    color: #ffc107;
}

.modal-confirm-icon.text-danger {
    color: #dc3545;
}

.modal-confirm-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.modal-confirm-text {
    color: #6c757d;
    margin-bottom: 1.5rem;
}

.modal-confirm-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
}
```

### Step 2: Commit

```bash
git add frontend/css/agricatch-admin.css
git commit -m "feat: add CSS for new tabbed interface"
```

Or if adding inline styles to farmer.html:

```bash
git add frontend/farmer.html
git commit -m "feat: add inline CSS for new tabbed interface"
```

## Global Constraints
- Maintain single product record architecture (no database schema changes)
- Use existing database fields: stock_quantity, reserved_quantity, max_preorder_quantity, preorder_availability_date
- Follow existing AgriCatch design system (Bootstrap 5.3.3, agricatch-admin.css)
- Maintain mobile responsiveness
- No new database migrations required
- Preserve existing product approval workflow (status: pending/approved/rejected)
- Keep existing farmer authentication and authorization
