import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Count columns for each table
tables = re.findall(r'<table[^>]*id="([^"]+)"', html)

colspans = {}
for tid in tables:
    # Find the table
    m = re.search(rf'<table[^>]*id="{re.escape(tid)}".*?</table>', html, re.DOTALL)
    if m:
        thead = re.search(r'<thead.*?</thead>', m.group(0), re.DOTALL)
        if thead:
            ths = len(re.findall(r'<th', thead.group(0)))
            colspans[tid] = ths
            print(f'{tid}: {ths} cols')

# Now check JS colspan values
with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

print("\n=== JS colspan mismatches ===")
mismatches = []
for tid, cols in colspans.items():
    tbody_id = tid.replace('-table', '-tbody')
    # Find colspan value in JS for this tbody
    pattern = rf"getElementById\\(['\"]?{re.escape(tbody_id)}['\"]?)\\).*?colspan=\\\"(\\d+)\\\""
    matches = re.findall(pattern, js, re.DOTALL)
    for span in matches:
        if int(span) != cols:
            mismatches.append((tid, tbody_id, cols, int(span)))
            print(f'{tid} ({tbody_id}): HTML={cols} cols, JS colspan={span}')

print(f"\nTotal mismatches: {len(mismatches)}")
