with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Find orders section and look for any example rows or action buttons
start = content.find('id="orders-tbody"')
print(repr(content[start-200:start+500]))
