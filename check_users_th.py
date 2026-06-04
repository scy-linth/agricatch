import re

with open('d:/Codings/AgriCatch/frontend/admin.html', 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'<table[^>]*id="users-table".*?</table>', html, re.DOTALL)
if m:
    thead = re.search(r'<thead.*?</thead>', m.group(0), re.DOTALL)
    if thead:
        th_text = thead.group(0)
        print('Raw thead:')
        print(th_text)
        print()
        print('TH count:', len(re.findall(r'<th[>\s]', th_text)))
        print('Matches:', re.findall(r'<th[^>]*>(.*?)</th>', th_text))
