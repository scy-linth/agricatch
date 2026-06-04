import re

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    content = f.read()

# List of fixes: (tbody_id, old_colspan, new_colspan)
fixes = [
    ('logs-tbody', 'colspan="6"', 'colspan="7"'),
    ('users-tbody', 'colspan="8"', 'colspan="10"'),
    ('products-tbody', 'colspan="10"', 'colspan="11"'),
    ('categories-tbody', 'colspan="5"', 'colspan="6"'),
    ('top-products-tbody', 'colspan="5"', 'colspan="6"'),
    ('top-farmers-tbody', 'colspan="2"', 'colspan="3"'),
    ('orders-tbody', 'colspan="6"', 'colspan="7"'),
    ('recent-sales-tbody', 'colspan="5"', 'colspan="6"'),
    ('farmers-all-tbody', 'colspan="8"', 'colspan="9"'),
    ('farmers-verified-tbody', 'colspan="8"', 'colspan="9"'),
    ('farmers-pending-tbody', 'colspan="8"', 'colspan="9"'),
    ('category-requests-tbody', 'colspan="7"', 'colspan="8"'),
]

count = 0
for tbody_id, old, new in fixes:
    # Only replace the occurrence near this tbody_id
    pattern = rf"(getElementById\(['\"]{re.escape(tbody_id)}['\"]\).*?){re.escape(old)}"
    replacement = r"\1" + new
    new_content, n = re.subn(pattern, replacement, content, count=1)
    if n > 0:
        content = new_content
        count += n
        print(f"Fixed {tbody_id}: {old} -> {new}")
    else:
        print(f"WARNING: Could not find {tbody_id} with {old}")

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal fixes applied: {count}")
