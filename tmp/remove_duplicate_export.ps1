$content = Get-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -Raw
# Remove the duplicate exportDashboard method that's outside the class (after line 12767)
$content = $content -replace '(}\s+async exportDashboard\(\) \{[^}]+\}\s+)', '`$1'
$content | Set-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -NoNewline
