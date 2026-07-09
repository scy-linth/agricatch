$content = Get-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -Raw
$insert = @"

        // Export Dashboard button
        const exportBtn = document.getElementById('export-dashboard-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.exportDashboard();
            });
        }
"@
$content = $content -replace '(setupEventListeners\(\) \{)', "`$1$insert"
$content | Set-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -NoNewline
