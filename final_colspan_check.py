import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Get all tables and their column counts
tables = re.findall(r'<table[^>]*id="([^"]+)"', html)

issues = []
for tid in tables:
    m = re.search(rf'<table[^>]*id="{re.escape(tid)}".*?</table>', html, re.DOTALL)
    if not m:
        continue
    thead = re.search(r'<thead.*?</thead>', m.group(0), re.DOTALL)
    if not thead:
        continue
    # Count actual <th> tags, not <thead>
    cols = len(re.findall(r'<th[>\s]', thead.group(0)))
    
    tbody_id = tid.replace('-table', '-tbody')
    
    # Find all occurrences of this tbody in JS
    idx = 0
    while True:
        idx = js.find(f"getElementById('{tbody_id}')", idx)
        if idx == -1:
            idx = js.find(f'getElementById("{tbody_id}")', idx)
        if idx == -1:
            break
        nearby = js[idx:idx+500]
        span_match = re.search(r'colspan="(\d+)"', nearby)
        if span_match:
            span = int(span_match.group(1))
            if span != cols:
                line = js[:idx].count('\n') + 1
                issues.append(f'{tid}: HTML has {cols} cols, JS uses colspan={span} (line {line})')
        idx += 1

if issues:
    print('=== Colspan mismatches ===')
    for issue in issues:
        print(f'  {issue}')
else:
    print('No colspan mismatches found!')
