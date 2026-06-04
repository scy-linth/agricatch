import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

issues = []

# 1. Check all onclick handlers reference existing methods
onclick_pattern = re.compile(r'onclick="adminDashboard\.([^"(]+)\([^)]*\)"')
onclick_handlers = set()
for match in onclick_pattern.finditer(html):
    onclick_handlers.add(match.group(1))

# Also check inline onkeydown etc.
for attr in ['onclick', 'onkeydown', 'onchange', 'onsubmit']:
    pattern = re.compile(rf'{attr}="adminDashboard\.([^"(]+)\(')
    for match in pattern.finditer(html):
        onclick_handlers.add(match.group(1))

# Find all method definitions in admin.js
method_defs = set()
for match in re.finditer(r'\b(\w+)\s*\([^)]*\)\s*\{', js):
    method_defs.add(match.group(1))

# Also check async methods
for match in re.finditer(r'\basync\s+(\w+)\s*\(', js):
    method_defs.add(match.group(1))

print("=== Onclick handlers in HTML ===")
for handler in sorted(onclick_handlers):
    exists = handler in method_defs
    status = "OK" if exists else "MISSING"
    print(f"  {handler}: {status}")
    if not exists:
        issues.append(f"HTML onclick references missing JS method: {handler}")

# 2. Check for buttons without any action
buttons = re.findall(r'<button[^>]*>(.*?)</button>', html, re.DOTALL)
no_action_buttons = []
for i, btn in enumerate(re.finditer(r'<button[^>]*>.*?</button>', html, re.DOTALL)):
    btn_html = btn.group(0)
    if 'onclick=' not in btn_html and 'type="submit"' not in btn_html and 'id=' not in btn_html:
        # Check if it has an id that might be wired in JS
        if 'data-' not in btn_html:
            no_action_buttons.append(btn_html[:80])

if no_action_buttons:
    print(f"\n=== Buttons with no obvious action ({len(no_action_buttons)}) ===")
    for btn in no_action_buttons[:10]:
        print(f"  {btn}")

# 3. Check all section IDs are referenced in JS
section_ids = set(re.findall(r'<section id="([^"]+)"', html))
print(f"\n=== Sections in HTML ({len(section_ids)}) ===")
for sid in sorted(section_ids):
    referenced = sid in js or sid.replace('-', '_') in js
    print(f"  {sid}: {'referenced' if referenced else 'NOT referenced in JS'}")
    if not referenced:
        issues.append(f"Section '{sid}' not referenced in JS")

# 4. Check modal IDs in HTML vs JS
modal_ids = set(re.findall(r'id="([^"]+-modal)"', html))
print(f"\n=== Modals in HTML ({len(modal_ids)}) ===")
for mid in sorted(modal_ids):
    referenced = mid in js
    print(f"  {mid}: {'referenced' if referenced else 'NOT referenced'}")
    if not referenced:
        issues.append(f"Modal '{mid}' not referenced in JS")

# 5. Check for getElementById references to non-existent IDs
js_ids = set(re.findall(r"getElementById\('([^']+)'\)", js))
html_ids = set(re.findall(r'id="([^"]+)"', html))
missing_ids = js_ids - html_ids
if missing_ids:
    print(f"\n=== IDs referenced in JS but missing in HTML ({len(missing_ids)}) ===")
    for mid in sorted(missing_ids):
        print(f"  {mid}")
        issues.append(f"JS references missing HTML element: #{mid}")

# 6. Check for tbody IDs
html_tbody_ids = set(re.findall(r'<tbody id="([^"]+)"', html))
print(f"\n=== Table bodies in HTML ({len(html_tbody_ids)}) ===")
for tid in sorted(html_tbody_ids):
    print(f"  {tid}")

# 7. Check that each tbody has a corresponding render function
render_funcs_for_tbody = {
    'orders-tbody': 'renderOrders',
    'users-tbody': 'renderUsers', 
    'products-tbody': 'renderProducts',
    'categories-tbody': 'renderCategories',
    'catalog-names-tbody': 'renderCatalogNames',
    'category-requests-tbody': 'renderCategoryRequests',
    'logs-tbody': 'renderAuditLogs',
    'farmers-all-tbody': 'renderFarmers',
    'farmers-verified-tbody': 'renderFarmers',
    'farmers-pending-tbody': 'renderFarmers',
    'recent-sales-tbody': 'renderRecentSalesTable',
    'top-products-tbody': 'renderTopProductsTable',
    'top-farmers-tbody': 'renderTopFarmersTable',
    'recent-activity-list': 'renderRecentActivityList',
    'notifications-list': 'renderNotifications',
    'messages-list': None,  # handled by chat.js
    'notif-list': None,  # handled separately
    'cdt-orders-tbody': None,  # inline in openCustomerDetail
    'cdt-addresses-content': None,
}

print(f"\n=== Render function coverage ===")
for tid in sorted(html_tbody_ids):
    expected = render_funcs_for_tbody.get(tid)
    if expected:
        exists = expected in js
        print(f"  {tid} -> {expected}: {'EXISTS' if exists else 'MISSING'}")
        if not exists:
            issues.append(f"Missing render function {expected} for #{tid}")
    else:
        print(f"  {tid} -> (no dedicated render function expected)")

# 8. Summary
print(f"\n=== SUMMARY ===")
if issues:
    print(f"Found {len(issues)} issue(s):")
    for issue in issues:
        print(f"  - {issue}")
else:
    print("No critical issues found!")
