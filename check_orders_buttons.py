with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('id="orders"')
end = content.find('</section>', start)
section = content[start:end]

# Find the area after the search button in orders
sb = section.find('order-search-btn')
if sb != -1:
    print(section[sb-20:sb+300])
else:
    print("Search button not found")
