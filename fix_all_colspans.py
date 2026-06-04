with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Simple direct replacements - each old string should be unique
replacements = [
    # (old, new, description)
    ('colspan="6" class="text-center text-muted py-4">No logs found', 'colspan="7" class="text-center text-muted py-4">No logs found', 'logs'),
    ('colspan="8" class="text-center text-muted py-4">No users found', 'colspan="10" class="text-center text-muted py-4">No users found', 'users'),
    ('colspan="10" class="text-center text-muted py-4">No products found', 'colspan="11" class="text-center text-muted py-4">No products found', 'products'),
    ('colspan="5" class="table-placeholder">No categories found', 'colspan="6" class="table-placeholder">No categories found', 'categories'),
    ('colspan="5" style="color:#64748b;">No catalog names yet', 'colspan="6" style="color:#64748b;">No catalog names yet', 'catalog'),
    ('colspan="5" class="table-placeholder">No pending requests', 'colspan="6" class="table-placeholder">No pending requests', 'cat-req preview'),
    ('colspan="7" class="text-center text-muted py-4">No requests found', 'colspan="8" class="text-center text-muted py-4">No requests found', 'cat-req main'),
    ('colspan="5" class="text-center text-muted py-3 small">No data for this period', 'colspan="6" class="text-center text-muted py-3 small">No data for this period', 'top-products'),
    ('colspan="2" class="text-center text-muted py-3 small">No data for this period', 'colspan="3" class="text-center text-muted py-3 small">No data for this period', 'top-farmers'),
    ('colspan="6" class="text-center text-muted py-4">No orders found', 'colspan="7" class="text-center text-muted py-4">No orders found', 'orders'),
    ('colspan="5" class="text-center text-muted py-3 small">No recent sales', 'colspan="6" class="text-center text-muted py-3 small">No recent sales', 'recent-sales'),
    ('colspan="8" class="text-center text-muted py-4">No farmers found', 'colspan="9" class="text-center text-muted py-4">No farmers found', 'farmers-all'),
    ('colspan="8" class="text-center text-muted py-4">No verified farmers', 'colspan="9" class="text-center text-muted py-4">No verified farmers', 'farmers-verified'),
    ('colspan="8" class="text-center text-muted py-4"><i class="bi bi-check-circle', 'colspan="9" class="text-center text-muted py-4"><i class="bi bi-check-circle', 'farmers-pending'),
]

count = 0
for old, new, desc in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f"Fixed {desc}")
    else:
        print(f"WARNING: Could not find {desc}")

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal fixes: {count}")
