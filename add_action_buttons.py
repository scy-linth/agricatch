import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Button group HTML to add after each filter bar
button_group_template = '''
                <div class="d-flex justify-content-end gap-2 mb-2">
                    <button id="{prefix}-refresh-btn" class="btn btn-outline-secondary btn-sm" type="button"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
                    <button id="{prefix}-clear-btn" class="btn btn-outline-secondary btn-sm" type="button"><i class="bi bi-x-lg"></i> Clear</button>
                </div>'''

# Sections to add buttons to
sections = [
    ('orders', 'order'),
    ('users', 'users'),
    ('products', 'products'),
    ('categories', 'categories'),
    ('catalog-products', 'catalog'),
    ('farmers', 'farmers'),
    ('category-requests', 'cat-req'),
]

for section_id, prefix in sections:
    # Find the section
    section_start = content.find(f'id="{section_id}"')
    if section_start == -1:
        print(f"Section {section_id} not found")
        continue
    
    # Find the filter bar closing tag within this section
    section_end = content.find('</section>', section_start)
    section_html = content[section_start:section_end]
    
    # Find the filter bar div closing
    filter_bar_match = re.search(r'class="section-filter-bar[^"]*".*?</div>', section_html, re.DOTALL)
    if not filter_bar_match:
        print(f"Filter bar not found in {section_id}")
        continue
    
    # Check if buttons already exist
    if f'{prefix}-refresh-btn' in section_html:
        print(f"Buttons already exist in {section_id}")
        continue
    
    # Insert buttons after the filter bar closing div
    # Find the position in the full content
    filter_bar_end_in_section = filter_bar_match.end()
    insert_pos = section_start + filter_bar_end_in_section
    
    button_html = button_group_template.format(prefix=prefix)
    content = content[:insert_pos] + button_html + content[insert_pos:]
    print(f"Added buttons to {section_id}")

# Add visit-site button to header
header_end = content.find('</header>')
if header_end != -1 and 'visit-site-btn' not in content:
    # Find the profile dropdown area and add before it
    profile_dropdown = content.find('<!-- Profile dropdown -->')
    if profile_dropdown != -1:
        visit_btn = '''            <li class="nav-item pe-3">
                <button id="visit-site-btn" class="btn btn-outline-primary btn-sm" type="button">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Visit Site
                </button>
            </li>
'''
        content = content[:profile_dropdown] + visit_btn + content[profile_dropdown:]
        print("Added visit-site-btn to header")

# Add id="logout-btn" to the existing sign out link
if 'id="logout-btn"' not in content:
    content = content.replace(
        '<a class="dropdown-item d-flex align-items-center text-danger" href="#"\n                           onclick="adminDashboard&&adminDashboard.logout();return false;">',
        '<a id="logout-btn" class="dropdown-item d-flex align-items-center text-danger" href="#"\n                           onclick="adminDashboard&&adminDashboard.logout();return false;">'
    )
    print("Added logout-btn id to sign out link")

with open('d:/Codings/AgriCatch/frontend/admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
