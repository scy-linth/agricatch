import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find cdt-orders-table
m = re.search(r'<table[^>]*id="cdt-orders-table".*?</table>', html, re.DOTALL)
if m:
    thead = re.search(r'<thead.*?</thead>', m.group(0), re.DOTALL)
    if thead:
        count = len(re.findall(r'<th[>\s]', thead.group(0)))
        print(f'cdt-orders-table: {count} cols')
        print('Elements:', re.findall(r'<th[^>]*>(.*?)</th>', thead.group(0)))
