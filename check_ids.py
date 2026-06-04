import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

ids = re.findall(r'id="([^"]+)"', content)
seen = {}
for id in ids:
    seen[id] = seen.get(id, 0) + 1

dupes = [(id, count) for id, count in seen.items() if count > 1]
if dupes:
    for id, count in dupes:
        print(f"Duplicate ID: {id} ({count} times)")
else:
    print("No duplicate IDs found")
