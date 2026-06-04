import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all panels/asides
panels = re.findall(r'<(aside|div)[^>]*id="([^"]+)"[^>]*class="[^"]*(?:panel|modal|drawer)[^"]*"', content)
print('=== Panels/Modals/Drawers in HTML ===')
for tag, pid in panels:
    print(f'  <{tag}> #{pid}')

# Find all category-request related elements
cat_req = re.findall(r'id="([^"]*cat-req[^"]*)"', content)
print(f'\n=== cat-req elements ({len(cat_req)}) ===')
for el in cat_req:
    print(f'  {el}')

# Find all farmer-chart related elements
farmer_chart = re.findall(r'id="([^"]*[Ff]armer[^"]*[Cc]hart[^"]*)"', content)
print(f'\n=== farmer chart elements ({len(farmer_chart)}) ===')
for el in farmer_chart:
    print(f'  {el}')

# Check for all modal IDs
modals = re.findall(r'id="([^"]*-modal)"', content)
print(f'\n=== All modals ({len(set(modals))}) ===')
for m in sorted(set(modals)):
    print(f'  {m}')
