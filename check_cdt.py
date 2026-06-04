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

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Check colspan for cdt-orders-tbody
idx = js.find("'cdt-orders-tbody'")
if idx != -1:
    nearby = js[idx:idx+300]
    span = re.search(r'colspan="(\d+)"', nearby)
    if span:
        print(f'JS colspan for cdt-orders-tbody: {span.group(1)}')
