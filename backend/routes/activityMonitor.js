const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const activityLogger = require('../services/activityLogger');
const requireRole = require('../middleware/requireRole');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * Helper function to broadcast new activity to all connected clients
 * This should be called after logging a new activity
 */
function broadcastNewActivity(activity) {
    if (!global.activityMonitorClients || global.activityMonitorClients.size === 0) {
        return;
    }

    const message = JSON.stringify({
        type: 'new_activity',
        data: activity
    });

    for (const [clientId, res] of global.activityMonitorClients.entries()) {
        try {
            res.write(`data: ${message}\n\n`);
        } catch (error) {
            // Remove dead connections
            global.activityMonitorClients.delete(clientId);
        }
    }
}

// Set broadcast function in activityLogger to avoid circular dependency
activityLogger.setBroadcastFunction(broadcastNewActivity);

/**
 * GET /api/activity-monitor/activities
 * Get activities with filtering, pagination, and search
 */
router.get('/activities', requireRole('admin', 'super_admin'), async (req, res) => {
    console.log('[Activity Monitor] /activities endpoint called');
    console.log('[Activity Monitor] req.user:', req.user);
    try {
        const {
            page = 1,
            limit = 25,
            search = '',
            role = '',
            action = '',
            status = '',
            dateFrom = '',
            dateTo = '',
            session = ''
        } = req.query;

        const offset = (page - 1) * limit;
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // Build WHERE clause
        if (search) {
            conditions.push(`(
                al.description ILIKE $${paramIndex} OR
                al.action ILIKE $${paramIndex} OR
                al.current_page ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (role) {
            conditions.push(`al.role = $${paramIndex}`);
            params.push(role);
            paramIndex++;
        }

        if (action) {
            conditions.push(`al.action = $${paramIndex}`);
            params.push(action);
            paramIndex++;
        }

        if (status) {
            conditions.push(`al.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (dateFrom) {
            conditions.push(`al.created_at >= $${paramIndex}`);
            params.push(new Date(dateFrom));
            paramIndex++;
        }

        if (dateTo) {
            conditions.push(`al.created_at <= $${paramIndex}`);
            params.push(new Date(dateTo + 'T23:59:59'));
            paramIndex++;
        }

        if (session === 'active') {
            conditions.push(`al.created_at >= NOW() - INTERVAL '30 minutes'`);
        } else if (session === 'inactive') {
            conditions.push(`al.created_at < NOW() - INTERVAL '30 minutes'`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM activity_logs al
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Get activities with user details
        const activitiesQuery = `
            SELECT 
                al.*,
                u.username,
                u.email,
                u.full_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        params.push(limit, offset);

        const activitiesResult = await pool.query(activitiesQuery, params);

        res.json({
            activities: activitiesResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

/**
 * GET /api/activity-monitor/activities/:id
 * Get activity details by ID
 */
router.get('/activities/:id',  requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                al.*,
                u.username,
                u.email,
                u.full_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching activity details:', error);
        res.status(500).json({ error: 'Failed to fetch activity details' });
    }
});

/**
 * GET /api/activity-monitor/session/:sessionId/timeline
 * Get session timeline
 */
router.get('/session/:sessionId/timeline',  requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { sessionId } = req.params;

        const timeline = await activityLogger.getSessionTimeline(sessionId);

        res.json({ timeline });
    } catch (error) {
        console.error('Error fetching session timeline:', error);
        res.status(500).json({ error: 'Failed to fetch session timeline' });
    }
});

/**
 * GET /api/activity-monitor/dashboard
 * Get dashboard summary statistics
 */
router.get('/dashboard',  requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const summary = await activityLogger.getDashboardSummary();

        res.json(summary);
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard summary' });
    }
});

/**
 * GET /api/activity-monitor/online-users
 * Get online users count
 */
router.get('/online-users',  requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const query = `
            SELECT COUNT(DISTINCT user_id) as count 
            FROM activity_logs 
            WHERE created_at >= NOW() - INTERVAL '30 minutes'
            AND user_id IS NOT NULL
        `;

        const result = await pool.query(query);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error fetching online users count:', error);
        res.status(500).json({ error: 'Failed to fetch online users count' });
    }
});

/**
 * GET /api/activity-monitor/errors-today
 * Get today's errors count
 */
router.get('/errors-today',  requireRole('admin', 'super_admin'), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const query = `
            SELECT COUNT(*) as count 
            FROM activity_logs 
            WHERE created_at >= $1 AND status = 'failed'
        `;

        const result = await pool.query(query, [today]);
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error fetching errors count:', error);
        res.status(500).json({ error: 'Failed to fetch errors count' });
    }
});

/**
 * GET /api/activity-monitor/settings
 * Get activity monitor settings from database
 */
router.get('/settings',  requireRole('super_admin'), async (req, res) => {
    try {
        const query = 'SELECT setting_key, setting_value FROM activity_monitor_settings';
        const result = await pool.query(query);
        
        const settings = {};
        result.rows.forEach(row => {
            // Parse values appropriately
            const value = row.setting_value.toLowerCase();
            if (value === 'true') {
                settings[row.setting_key] = true;
            } else if (value === 'false') {
                settings[row.setting_key] = false;
            } else if (!isNaN(Number(value))) {
                settings[row.setting_key] = Number(value);
            } else {
                settings[row.setting_key] = row.setting_value;
            }
        });

        // Return in a format compatible with frontend expectations
        const responseSettings = {
            enableMonitoring: settings.deduplication_enabled !== false,
            retentionDays: settings.retention_days || 90,
            maxRecords: settings.max_records || 100000,
            autoDelete: settings.auto_delete !== false,
            enableCustomer: settings.enabled_roles?.includes('customer') !== false,
            enableFarmer: settings.enabled_roles?.includes('farmer') !== false,
            enableAdmin: settings.enabled_roles?.includes('admin') !== false,
            // Include raw settings for advanced configuration
            raw: settings
        };

        res.json({ settings: responseSettings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/activity-monitor/settings
 * Update activity monitor settings in database
 */
router.put('/settings',  requireRole('super_admin'), async (req, res) => {
    try {
        const {
            enableMonitoring,
            retentionDays,
            maxRecords,
            autoDelete,
            enableCustomer,
            enableFarmer,
            enableAdmin
        } = req.body;

        // Build enabled_roles list
        const enabledRoles = [];
        if (enableCustomer !== false) enabledRoles.push('customer');
        if (enableFarmer !== false) enabledRoles.push('farmer');
        if (enableAdmin !== false) enabledRoles.push('admin');
        enabledRoles.push('super_admin'); // Always include super_admin

        // Settings to update with their database keys
        const settingsToUpdate = [
            { key: 'retention_days', value: String(retentionDays || 90) },
            { key: 'max_records', value: String(maxRecords || 100000) },
            { key: 'auto_delete', value: String(autoDelete !== false) },
            { key: 'deduplication_enabled', value: String(enableMonitoring !== false) },
            { key: 'enabled_roles', value: enabledRoles.join(',') }
        ];

        // Upsert each setting
        for (const setting of settingsToUpdate) {
            const upsertQuery = `
                INSERT INTO activity_monitor_settings (setting_key, setting_value, description)
                VALUES ($1, $2, $3)
                ON CONFLICT (setting_key) 
                DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP
            `;
            
            // Get description from existing record or use default
            const descQuery = 'SELECT description FROM activity_monitor_settings WHERE setting_key = $1';
            const descResult = await pool.query(descQuery, [setting.key]);
            const description = descResult.rows[0]?.description || 'Activity Monitor setting';
            
            await pool.query(upsertQuery, [setting.key, setting.value, description]);
        }

        // Log the settings change
        const userId = req.user.id;
        const role = req.user.role;
        const sessionId = req.sessionID || 'unknown';

        activityLogger.logAdminSettingsChange(
            userId,
            role,
            sessionId,
            'activity_monitor_settings',
            'previous',
            JSON.stringify(req.body),
            {},
            req.ip || req.connection?.remoteAddress || 'unknown',
            req.headers['user-agent'],
            `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            req.headers['referer'] || req.originalUrl
        );

        // Return updated settings
        const responseSettings = {
            enableMonitoring: enableMonitoring !== false,
            retentionDays: retentionDays || 90,
            maxRecords: maxRecords || 100000,
            autoDelete: autoDelete !== false,
            enableCustomer: enableCustomer !== false,
            enableFarmer: enableFarmer !== false,
            enableAdmin: enableAdmin !== false
        };

        res.json({ settings: responseSettings, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * POST /api/activity-monitor/cleanup
 * Trigger manual cleanup of old logs
 */
router.post('/cleanup',  requireRole('super_admin'), async (req, res) => {
    try {
        const settings = req.body || {};
        const result = await activityLogger.cleanupOldLogs(settings);

        res.json(result);
    } catch (error) {
        console.error('Error running cleanup:', error);
        res.status(500).json({ error: 'Failed to run cleanup' });
    }
});

/**
 * GET /api/activity-monitor/storage
 * Get storage usage statistics
 */
router.get('/storage',  requireRole('super_admin'), async (req, res) => {
    try {
        // Get table size
        const sizeQuery = `
            SELECT 
                pg_size_pretty(pg_total_relation_size('activity_logs')) as total_size,
                pg_size_pretty(pg_relation_size('activity_logs')) as table_size,
                pg_size_pretty(pg_total_relation_size('activity_logs') - pg_relation_size('activity_logs')) as indexes_size
        `;

        const sizeResult = await pool.query(sizeQuery);

        // Get record count
        const countQuery = 'SELECT COUNT(*) as count FROM activity_logs';
        const countResult = await pool.query(countQuery);

        res.json({
            totalSize: sizeResult.rows[0].total_size,
            tableSize: sizeResult.rows[0].table_size,
            indexesSize: sizeResult.rows[0].indexes_size,
            recordCount: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching storage stats:', error);
        res.status(500).json({ error: 'Failed to fetch storage statistics' });
    }
});

/**
 * GET /api/activity-monitor/stream
 * SSE endpoint for realtime activity updates
 */
router.get('/stream', async (req, res) => {
    // Custom authentication for SSE (EventSource doesn't support custom headers)
    const token = req.query.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

    if (!token) {
        return res.status(401).end();
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await pool.query(
            'SELECT id, role FROM users WHERE id = $1',
            [decoded.id]
        );

        if (!result.rows.length) {
            return res.status(403).end();
        }

        const user = result.rows[0];
        if (!['admin', 'super_admin'].includes(user.role)) {
            return res.status(403).end();
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Activity Monitor stream connected' })}\n\n`);

        // Store the response object for broadcasting
        const clientId = Date.now() + Math.random();
        req.activityMonitorClientId = clientId;

        // Add to clients list (in-memory, will be lost on restart)
        if (!global.activityMonitorClients) {
            global.activityMonitorClients = new Map();
        }
        global.activityMonitorClients.set(clientId, res);

        // Send keepalive every 30 seconds
        const keepalive = setInterval(() => {
            res.write(`: keepalive\n\n`);
        }, 30000);

        // Clean up on disconnect
        req.on('close', () => {
            clearInterval(keepalive);
            global.activityMonitorClients?.delete(clientId);
        });

        req.on('end', () => {
            clearInterval(keepalive);
            global.activityMonitorClients?.delete(clientId);
        });
    } catch (error) {
        console.error('SSE authentication error:', error);
        return res.status(401).end();
    }
});

// Export the broadcast function for use in activityLogger
module.exports.broadcastNewActivity = broadcastNewActivity;
module.exports = router;
