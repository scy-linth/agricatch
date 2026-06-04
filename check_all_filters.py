import re

with open('d:/Codings/AgriCatch/frontend/js/admin.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Check each filter function for issues

issues = []

# 1. Check renderOrders exists and is a function definition
renderOrders_def = re.search(r'^\s+renderOrders\s*\(\s*orders\s*\)\s*\{', js, re.MULTILINE)
if not renderOrders_def:
    issues.append("CRITICAL: renderOrders(orders) function definition is MISSING")

# 2. Check applyOrderFilters calls renderOrders
applyOrder = re.search(r'applyOrderFilters\(\).*?\{.*?\}', js, re.DOTALL)
if applyOrder:
    if 'renderOrders' not in applyOrder.group(0):
        issues.append("applyOrderFilters doesn't call renderOrders")

# 3. Check loadOrders calls applyOrderFilters
loadOrders = re.search(r'loadOrders\(.*\).*?\{.*?\}', js, re.DOTALL)
if loadOrders:
    if 'applyOrderFilters' not in loadOrders.group(0):
        issues.append("loadOrders doesn't call applyOrderFilters")

# 4. Check if event listeners reference non-existent elements
# This is hard to check programmatically without the HTML

# 5. Check each render function has tbody guard
render_funcs = ['renderUsers', 'renderProducts', 'renderFarmers', 'renderCategories', 
                'renderCatalogNames', 'renderCategoryRequests', 'renderAuditLogs']
for func in render_funcs:
    pattern = rf'{func}\s*\([^)]*\)\s*\{{'
    match = re.search(pattern, js)
    if match:
        start = match.end()
        # Get next ~10 lines
        snippet = js[start:start+500]
        if 'getElementById' not in snippet:
            issues.append(f"{func} might be missing tbody getElementById")
        elif 'if (!tbody)' not in snippet and 'if(!tbody)' not in snippet:
            issues.append(f"{func} might be missing tbody null guard")
    else:
        issues.append(f"Could not find {func} definition")

# 6. Check for functions that call renderXxx but might not exist
calls = re.findall(r'this\.(render\w+)\(', js)
calls = set(calls)
defs = re.findall(r'\s+(render\w+)\s*\(', js)
defs = set(defs)

for call in calls:
    if call not in defs:
        issues.append(f"Function {call} is CALLED but not DEFINED")

for issue in issues:
    print(issue)

if not issues:
    print("No obvious issues found in filter/render chain")
