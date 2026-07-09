$content = Get-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -Raw
# Remove the duplicate exportDashboard method that's outside the class (after the class closing brace)
# Look for the pattern: } followed by async exportDashboard() { ... } followed by }
$content = $content -replace '(\}\s+)(async exportDashboard\(\) \{[^}]+\}\s+)(\}\s*$)', '$1$3'
$content | Set-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -NoNewline
