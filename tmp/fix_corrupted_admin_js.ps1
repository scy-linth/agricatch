$content = Get-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -Raw
# Fix the corrupted line 12767 (change ` to })
$content = $content -replace '    `}', '    }'
# Remove the duplicate exportDashboard method (lines 12768 onwards)
# Find the pattern and remove everything from the duplicate async exportDashboard to the end, then add the closing brace
$content = $content -replace '(}\s+async exportDashboard\(\) \{[\s\S]+$', '$1}'
$content | Set-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -NoNewline
