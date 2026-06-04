import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

issues = []

# 1. Check table column counts match between HTML thead and JS tbody rendering
def count_th_cols(table_id, html):
    pattern = rf'<table[^>]*id="{re.escape(table_id)}".*?</table>'
    match = re.search(pattern, html, re.DOTALL)
    if not match:
        return None
    table_html = match.group(0)
    # Count th elements in thead
    thead = re.search(r'<thead.*?</thead>', table_html, re.DOTALL)
    if thead:
        ths = len(re.findall(r'<th', thead.group(0)))
        return ths
    return None

# Check each table
tables = re.findall(r'<table[^>]*id="([^"]+)"', html)
print("=== Table column checks ===")
for tid in tables:
    col_count = count_th_cols(tid, html)
    if col_count:
        # Check if JS references this table with colspan
        tbody_id = tid.replace('-table', '-tbody')
        # Find colspan in JS for this tbody
        js_colspans = re.findall(rf'getElementById\([\'"]{{0,1}}{re.escape(tbody_id)}[\'"]{{0,1}}\).*?colspan="(\d+)"', js, re.DOTALL)
        if js_colspans:
            for span in js_colspans:
                if int(span) != col_count:
                    issues.append(f"Table #{tid}: {col_count} cols but JS uses colspan={span}")
                    print(f"  {tid}: {col_count} cols, JS colspan={span} MISMATCH")
                else:
                    print(f"  {tid}: {col_count} cols OK")
        else:
            print(f"  {tid}: {col_count} cols (no colspan check in JS)")

# 2. Check all section toggle/visibility logic
print("\n=== Section navigation ===")
nav_sections = re.findall(r'data-section="([^"]+)"', html)
for section in set(nav_sections):
    has_section = f'id="{section}"' in html and 'admin-section-card' in html
    if not has_section:
        issues.append(f"Nav link references missing section: {section}")
    else:
        print(f"  {section}: OK")

# 3. Check for functions referenced in HTML but not in JS
html_funcs = set(re.findall(r'adminDashboard\.(\w+)\(', html))
js_funcs = set(re.findall(r'\b(\w+)\s*\([^)]*\)\s*\{', js))
js_async_funcs = set(re.findall(r'\basync\s+(\w+)\s*\(', js))
all_js_funcs = js_funcs | js_async_funcs

print("\n=== HTML onclick functions ===")
for func in sorted(html_funcs):
    if func not in all_js_funcs:
        issues.append(f"HTML references missing JS function: {func}")
        print(f"  {func}: MISSING")
    else:
        print(f"  {func}: OK")

# 4. Check for critical missing elements that JS expects without null guards
# (elements where JS does NOT use ?. or if(!el) return)
print("\n=== Critical element references (no null guard) ===")
critical_patterns = [
    r'const\s+\w+\s*=\s*document\.getElementById\([\'"]([^\'"]+)[\'"]\)(?!\s*\?)',
    r'let\s+\w+\s*=\s*document\.getElementById\([\'"]([^\'"]+)[\'"]\)(?!\s*\?)',
]
for pattern in critical_patterns:
    for match in re.finditer(pattern, js):
        el_id = match.group(1)
        if f'id="{el_id}"' not in html:
            # Check if it's dynamically created
            if el_id not in ['admin-access-overlay', 'admin-overlay-close', 'admin-overlay-logout',
                            'admin-recover-btn', 'admin-recover-result', 'admin-recover-secret']:
                issues.append(f"JS expects #{el_id} without null guard but not in HTML")
                print(f"  #{el_id}: MISSING (no null guard)")

# 5. Summary
print(f"\n=== SUMMARY: {len(issues)} issues ===")
for issue in issues:
    print(f"  - {issue}")
