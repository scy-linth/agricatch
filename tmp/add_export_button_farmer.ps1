$content = Get-Content 'd:\Codings\AgriCatch\frontend\farmer.html' -Raw
$insert = @"

        <!-- Export Button (Premium Only) -->
        <div class="d-flex justify-content-end mb-3" id="export-dashboard-container" style="display:none;">
            <button id="export-dashboard-btn" class="btn btn-success">
                <i class="bi bi-file-earmark-excel me-2"></i>Export Dashboard Report
            </button>
        </div>
"@
$content = $content -replace '(<!-- OVERVIEW SECTION -->\s*<section id="overview" class="admin-section-card">)', "`$1$insert"
$content | Set-Content 'd:\Codings\AgriCatch\frontend\farmer.html' -NoNewline
