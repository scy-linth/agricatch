with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('id="orders"')
end = content.find('</section>', start)
section = content[start:end]

# Find the refresh/clear buttons area
rb = section.find('order-refresh-btn')
if rb != -1:
    print(section[rb-50:rb+300])
else:
    print("Refresh button not found in orders section")
