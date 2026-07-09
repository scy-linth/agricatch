$content = Get-Content 'd:\Codings\AgriCatch\frontend\js\farmer.js' -Raw
$insert = @"

        // Show/hide export button based on premium status
        const exportContainer = document.getElementById('export-dashboard-container');
        if (exportContainer) {
            exportContainer.style.display = this.isPremium() ? 'flex' : 'none';
        }
"@
# Insert at the end of updateSubscriptionUI method before the closing brace
$lines = $content -split "`r?`n"
$newLines = @()
$inMethod = $false
$braceCount = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $newLines += $line
    
    if ($line -match 'updateSubscriptionUI\(\) \{') {
        $inMethod = $true
        $braceCount = 1
    } elseif ($inMethod) {
        $braceCount += ($line -split '\{' | Measure-Object).Count - 1
        $braceCount -= ($line -split '\}' | Measure-Object).Count - 1
        if ($braceCount -eq 0 -and $line -match '\}') {
            $newLines = $newLines[0..($newLines.Count-2)] + $insert + $line
            $inMethod = $false
        }
    }
}
$newLines -join "`r`n" | Set-Content 'd:\Codings\AgriCatch\frontend\js\farmer.js' -NoNewline
