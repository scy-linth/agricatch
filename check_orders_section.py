import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

orders_section = content[content.find('id="orders"'):content.find('id="products"')]
buttons = re.findall(r'<button[^>]*onclick="([^"]+)"[^>]*>[^<]*</button>', orders_section)
print('Buttons in orders section:')
for b in buttons:
    print(' ', b)
