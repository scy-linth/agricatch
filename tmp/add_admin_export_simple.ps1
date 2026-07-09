$content = Get-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -Raw
$insert = @"

    async exportDashboard() {
        try {
            const exportBtn = document.getElementById('export-dashboard-btn');
            if (exportBtn) {
                exportBtn.disabled = true;
                exportBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Generating...';
            }

            const period = this._reportPeriod || 'all';
            const url = `${this.apiBase}/admin/dashboard/export.xlsx?period=${period}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!response.ok) {
                const json = await response.json().catch(() => null);
                throw new Error(json?.message || 'Export failed');
            }

            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'Admin_Dashboard_Report.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            this.showToast('Dashboard report exported successfully!', 'success');
        } catch (error) {
            console.error('Export dashboard error:', error);
            this.showToast('Failed to export dashboard report. Please try again.', 'error');
        } finally {
            const exportBtn = document.getElementById('export-dashboard-btn');
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<i class="bi bi-file-earmark-excel me-2"></i>Export Dashboard Report';
            }
        }
    }
"@
# Insert before the class closing brace (line 12387)
$content = $content -replace '(} catch \(e\) \{ this\.showToast\(\'Error saving pricing\', \'error\'\); \}\s+\})', '$1$insert'
$content | Set-Content 'd:\Codings\AgriCatch\frontend\js\admin.js' -NoNewline
