/**
 * Activity Logs Cleanup Script
 * 
 * This script automatically cleans up old activity logs based on retention settings.
 * It should be scheduled to run daily (e.g., via cron or node-cron).
 * 
 * Usage: node backend/scripts/cleanup-activity-logs.js
 */

const activityLogger = require('../services/activityLogger');

async function runCleanup() {
    console.log('Starting activity logs cleanup...');
    console.log('Timestamp:', new Date().toISOString());

    try {
        // Get retention settings (in production, these would come from a settings table)
        const settings = {
            retentionDays: 90,        // Keep logs for 90 days
            maxRecords: 100000,       // Maximum 100,000 records
            autoDelete: true          // Enable automatic deletion
        };

        console.log('Cleanup settings:', settings);

        // Run cleanup
        const result = await activityLogger.cleanupOldLogs(settings);

        console.log('Cleanup completed:', result);

        if (result.deleted > 0) {
            console.log(`✅ Deleted ${result.deleted} old activity log(s)`);
        } else {
            console.log('ℹ️  No logs needed to be deleted');
        }

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }

    console.log('Cleanup job finished');
    process.exit(0);
}

// Run the cleanup
runCleanup();
