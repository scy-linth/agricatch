import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Check orders table column count
orders_start = content.find('id="orders-table"')
orders_end = content.find('</table>', orders_start)
orders_html = content[orders_start:orders_end]

ths = len(re.findall(r'<th', orders_html))
print(f'orders-table: {ths} th elements')

for m in re.finditer(r'<th[^>]*>(.*?)</th>', orders_html):
    print(f'  - {m.group(1).strip()}')
