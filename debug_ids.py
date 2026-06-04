import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Check specific IDs
for id_name in ['orders-clear-btn', 'orders-refresh-btn', 'visit-site-btn', 'logout-btn']:
    pattern = f'id="{id_name}"'
    found = pattern in html
    print(f'{id_name}: {found}')
    if not found:
        # Try searching with regex
        regex_found = bool(re.search(rf'id\s*=\s*["\']{re.escape(id_name)}["\']', html))
        print(f'  regex search: {regex_found}')

# Count total IDs
all_ids = re.findall(r'id="([^"]+)"', html)
print(f'\nTotal IDs in HTML: {len(all_ids)}')
print(f'Sample: {all_ids[:10]}')
