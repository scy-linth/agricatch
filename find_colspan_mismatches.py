import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Count columns for each table
tables = re.findall(r'<table[^>]*id="([^"]+)"', html)

colspans = {}
for tid in tables:
    m = re.search(rf'<table[^>]*id="{re.escape(tid)}".*?</table>', html, re.DOTALL)
    if m:
        thead = re.search(r'<thead.*?</thead>', m.group(0), re.DOTALL)
        if thead:
            ths = len(re.findall(r'<th', thead.group(0)))
            colspans[tid] = ths

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Check each tbody in JS for colspan mismatches
print('=== Colspan mismatches ===')
mismatches = []
for tid, cols in colspans.items():
    tbody_id = tid.replace('-table', '-tbody')
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
                # Find line number
                line = js[:idx].count('\n') + 1
                mismatches.append((tid, cols, span, line))
                print(f'{tid}: HTML={cols} cols, JS colspan={span} (line ~{line})')
        idx += 1

print(f'\nTotal: {len(mismatches)} mismatches')

# Print fix commands
print('\n=== Fixes needed in JS ===')
for tid, cols, span, line in mismatches:
    print(f'Line {line}: change colspan="{span}" to colspan="{cols}" for {tid}')
