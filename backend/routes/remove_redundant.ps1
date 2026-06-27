$lines = Get-Content "d:\Codings\AgriCatch\backend\routes\orders.js"
$output = @()
$skipNext = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    # Skip redundant cancelled/delivered checks after validation
    if ($line -match "if \(currentStatus === 'cancelled' && status !== 'cancelled'\)") {
        $skipNext = $true
        continue
    }
    if ($skipNext -and $line -match "if \(currentStatus === 'delivered' && status !== 'delivered'\)") {
        $skipNext = $false
        continue
    }
    
    # Also skip the old checks in the first endpoint
    if ($line -match "if \(order\.status === 'cancelled' && status !== 'cancelled'\)") {
        continue
    }
    if ($line -match "if \(order\.status === 'delivered' && status !== 'delivered'\)") {
        continue
    }
    
    $output += $line
}

$output | Set-Content "d:\Codings\AgriCatch\backend\routes\orders.js"
Write-Host "Removed redundant status checks"
