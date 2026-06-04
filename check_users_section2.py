with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find users section
start = content.find('id="users"')
end = content.find('</section>', start)
section = content[start:end]

# Find the area around the filter bar end
fb = section.find('section-filter-bar')
if fb != -1:
    # Show the end of the filter bar (after the search button)
    search_btn = section.find('users-search-btn')
    if search_btn != -1:
        print(section[search_btn-50:search_btn+200])
