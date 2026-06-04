import re

# Read admin.html
with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Read admin.js  
with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Find all id="..." in HTML
html_ids = set(re.findall(r'id="([^"]+)"', html))

# Check for filter-related IDs
filter_patterns = [
    ('orders', r'order-.*-filter|order-.*-input|order-.*-btn'),
    ('users', r'users-.*-filter|users-.*-input|users-.*-btn'),
    ('products', r'products-.*-filter|products-.*-input|products-.*-btn'),
    ('categories', r'category-.*-filter|category-.*-input|category-.*-btn'),
    ('catalog', r'catalog-.*-filter|catalog-.*-input|catalog-.*-btn'),
    ('farmers', r'farmers-.*-filter|farmers-.*-input|farmers-.*-btn'),
    ('logs', r'logs-.*-filter|logs-.*-input|logs-.*-btn'),
    ('cat-req', r'cat-req-.*-filter|cat-req-.*-input|cat-req-.*-btn'),
]

print("=== HTML Filter Elements ===")
for section, pattern in filter_patterns:
    matches = [id for id in html_ids if re.search(pattern, id)]
    print(f"{section}: {matches}")

print("\n=== JS Event Listeners ===")
for section, pattern in filter_patterns:
    matches = [m for m in re.findall(r"getElementById\('([^']+)'\)", js) if re.search(pattern, m)]
    print(f"{section}: {matches}")

print("\n=== JS Filter Functions ===")
filter_functions = ['applyOrderFilters', 'applyUsersFilter', 'applyProductsFilter', 'applyFarmersFilter', 
                    'runCatalogFilter', 'loadCategoryRequests']
for func in filter_functions:
    exists = func in js
    print(f"{func}: {'EXISTS' if exists else 'MISSING'}")

print("\n=== JS Render Functions ===")
render_functions = ['renderOrders', 'renderUsers', 'renderProducts', 'renderFarmers', 
                    'renderCategories', 'renderCatalogNames', 'renderCategoryRequests', 'renderAuditLogs']
for func in render_functions:
    exists = func in js
    print(f"{func}: {'EXISTS' if exists else 'MISSING'}")
