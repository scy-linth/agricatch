$content = Get-Content 'd:\Codings\AgriCatch\frontend\admin.html' -Raw
$insert = @"

        <!-- Export Button -->
        <div class="d-flex justify-content-end mb-3">
            <button id="export-dashboard-btn" class="btn btn-success">
                <i class="bi bi-file-earmark-excel me-2"></i>Export Dashboard Report
            </button>
        </div>
"@
$content = $content -replace '(<section id="overview" class="admin-section-card active">)', "`$1$insert"
$content | Set-Content 'd:\Codings\AgriCatch\frontend\admin.html' -NoNewline
