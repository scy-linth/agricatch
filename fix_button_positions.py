import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all incorrectly placed button groups inside filter bars
# The pattern is: <div class="section-filter-bar...> ... <div class="d-flex justify-content-end gap-2 mb-2">...buttons...</div> ... still inside filter bar
# We need to remove these and re-add them after the filter bar closes

prefixes = ['order', 'users', 'products', 'categories', 'catalog', 'farmers', 'cat-req']

for prefix in prefixes:
    # Find and remove the incorrectly placed button group
    pattern = rf'(\s+<div class="d-flex justify-content-end gap-2 mb-2">\s+<button id="{prefix}-refresh-btn".*?</button>\s+<button id="{prefix}-clear-btn".*?</button>\s+</div>)'
    content, count = re.subn(pattern, '', content, count=1, flags=re.DOTALL)
    if count > 0:
        print(f"Removed misplaced buttons for {prefix}")
    else:
        print(f"No misplaced buttons found for {prefix}")

# Now add the buttons correctly - after each </div> that closes the filter bar
# The filter bar structure is: <div class="section-filter-bar row g-2 mb-3 align-items-end"> ... </div>
# We need to find the actual closing </div> (not nested divs)

for section_id, prefix in [
    ('orders', 'order'),
    ('users', 'users'),
    ('products', 'products'),
    ('categories', 'categories'),
    ('catalog-products', 'catalog'),
    ('farmers', 'farmers'),
    ('category-requests', 'cat-req'),
]:
    section_start = content.find(f'id="{section_id}"')
    section_end = content.find('</section>', section_start)
    section_html = content[section_start:section_end]
    
    # Check if buttons already exist outside filter bar
    if f'{prefix}-refresh-btn' in section_html:
        fb_end = section_html.find('</div>\n\n                <div class="d-flex justify-content-end gap-2 mb-2">')
        if fb_end == -1:
            # Buttons exist but might be in wrong place - skip
            print(f"Buttons for {section_id} already handled")
            continue
    
    # Find the filter bar - look for the pattern that ends with search button </div></div>
    filter_bar_end_marker = '</div>\n                </div>\n\n'
    fb_pos = section_html.find(filter_bar_end_marker)
    if fb_pos == -1:
        # Try alternate pattern
        filter_bar_end_marker = '</div>\n                </div>'
        fb_pos = section_html.find(filter_bar_end_marker)
    
    if fb_pos == -1:
        print(f"Could not find filter bar end in {section_id}")
        continue
    
    insert_pos = section_start + fb_pos + len(filter_bar_end_marker)
    
    button_html = f'''                <div class="d-flex justify-content-end gap-2 mb-2">
                    <button id="{prefix}-refresh-btn" class="btn btn-outline-secondary btn-sm" type="button"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
                    <button id="{prefix}-clear-btn" class="btn btn-outline-secondary btn-sm" type="button"><i class="bi bi-x-lg"></i> Clear</button>
                </div>

'''
    content = content[:insert_pos] + button_html + content[insert_pos:]
    print(f"Added buttons to {section_id} at correct position")

with open('d:/Codings/AgriCatch/frontend/admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
