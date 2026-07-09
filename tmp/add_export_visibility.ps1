$content = Get-Content 'd:\Codings\AgriCatch\frontend\js\farmer.js' -Raw
$insert = @"

        // Show/hide export button based on premium status
        const exportContainer = document.getElementById('export-dashboard-container');
        if (exportContainer) {
            exportContainer.style.display = this.isPremium() ? 'flex' : 'none';
        }
"@
# Insert at the end of updateSubscriptionUI method before the closing brace
$content = $content -replace '(updateSubscriptionUI\(\) \{[^}]+\}\s*\})', "`$1$insert"
$content | Set-Content 'd:\Codings\AgriCatch\frontend\js\farmer.js' -NoNewline
