import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

sections = ['orders', 'users', 'products', 'categories', 'catalog-products', 'farmers', 'category-requests', 'logs']

for section in sections:
    start = content.find(f'id="{section}"')
    if start == -1:
        print(f'{section}: SECTION NOT FOUND')
        continue
    end = content.find('</section>', start) + 10
    section_html = content[start:end]
    buttons = re.findall(r'id="([^"]*(?:clear|refresh)[^"]*)"', section_html)
    print(f'{section}: {buttons if buttons else "NONE"}')

# Also check for logout and visit site
print()
print('logout-btn:', 'id="logout-btn"' in content)
print('visit-site-btn:', 'id="visit-site-btn"' in content)

# Check for cat-req-preview-tbody
print('cat-req-preview-tbody:', 'id="cat-req-preview-tbody"' in content)

# Check for farmersRevenueChart  
print('farmersRevenueChart:', 'id="farmersRevenueChart"' in content)

# Check for order-farmers-list
print('order-farmers-list:', 'id="order-farmers-list"' in content)

# Check for category-request elements
for el in ['category-request-category', 'category-request-name', 'category-request-new-category', 
           'category-request-requested-category', 'category-request-review-notes']:
    print(f'{el}: {el in content}')
