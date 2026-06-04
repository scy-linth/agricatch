with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Revert all the colspan changes I made (they were all wrong!)
replacements = [
    ('colspan="7" class="text-center text-muted py-4">No logs found', 'colspan="6" class="text-center text-muted py-4">No logs found'),
    ('colspan="10" class="text-center text-muted py-4">No users found', 'colspan="8" class="text-center text-muted py-4">No users found'),
    ('colspan="11" class="text-center text-muted py-4">No products found', 'colspan="10" class="text-center text-muted py-4">No products found'),
    ('colspan="6" class="table-placeholder">No categories found', 'colspan="5" class="table-placeholder">No categories found'),
    ('colspan="6" style="color:#64748b;">No catalog names yet', 'colspan="5" style="color:#64748b;">No catalog names yet'),
    ('colspan="6" class="table-placeholder">No pending requests', 'colspan="5" class="table-placeholder">No pending requests'),
    ('colspan="8" class="text-center text-muted py-4">No requests found', 'colspan="7" class="text-center text-muted py-4">No requests found'),
    ('colspan="6" class="text-center text-muted py-3 small">No data for this period', 'colspan="5" class="text-center text-muted py-3 small">No data for this period'),
    ('colspan="3" class="text-center text-muted py-3 small">No data for this period', 'colspan="2" class="text-center text-muted py-3 small">No data for this period'),
    ('colspan="7" class="text-center text-muted py-4">No orders found', 'colspan="6" class="text-center text-muted py-4">No orders found'),
    ('colspan="6" class="text-center text-muted py-3 small">No recent sales', 'colspan="5" class="text-center text-muted py-3 small">No recent sales'),
    ('colspan="9" class="text-center text-muted py-4">No farmers found', 'colspan="8" class="text-center text-muted py-4">No farmers found'),
    ('colspan="9" class="text-center text-muted py-4">No verified farmers', 'colspan="8" class="text-center text-muted py-4">No verified farmers'),
    ('colspan="9" class="text-center text-muted py-4"><i class="bi bi-check-circle', 'colspan="8" class="text-center text-muted py-4"><i class="bi bi-check-circle'),
]

count = 0
for new_bad, old_good in replacements:
    if new_bad in content:
        content = content.replace(new_bad, old_good, 1)
        count += 1
        print(f"Reverted: {old_good[:40]}...")
    else:
        print(f"Not found: {new_bad[:40]}...")

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nReverted {count} changes")
