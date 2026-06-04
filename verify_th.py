import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Check actual th count for orders-table
m = re.search(r'<table[^>]*id="orders-table".*?</table>', html, re.DOTALL)
if m:
    thead = re.search(r'<thead.*?</thead>', m.group(0), re.DOTALL)
    if thead:
        th_text = thead.group(0)
        # Count <th> tags but not <thead>
        count = len(re.findall(r'<th[>\s]', th_text))
        print(f'orders-table actual <th> count: {count}')
        print('Elements:', re.findall(r'<th[^>]*>(.*?)</th>', th_text))

# Check all tables
print("\n=== Correct column counts ===")
tables = ['orders-table', 'users-table', 'products-table', 'categories-table', 
          'catalog-products-table', 'farmers-all-table', 'farmers-verified-table',
          'farmers-pending-table', 'logs-table', 'category-requests-table',
          'recent-sales-table', 'top-products-table', 'top-farmers-table']
for tid in tables:
    m = re.search(rf'<table[^>]*id="{re.escape(tid)}".*?</table>', html, re.DOTALL)
    if m:
        thead = re.search(r'<thead.*?</thead>', m.group(0), re.DOTALL)
        if thead:
            count = len(re.findall(r'<th[>\s]', thead.group(0)))
            print(f'{tid}: {count} cols')
