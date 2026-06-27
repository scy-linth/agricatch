const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const ipGeolocation = require('./ipGeolocation');
const browserParser = require('./browserParser');

// Import broadcast function for realtime updates
// Set by activityMonitor.js after initialization to avoid circular dependency
let broadcastNewActivity = null;

// Function to set broadcast function (called by activityMonitor.js)
function setBroadcastFunction(fn) {
    broadcastNewActivity = fn;
}

/**
 * Activity Logger Service
 * 
 * A centralized service for logging user activities across the platform.
 * All modules should use this service instead of writing directly to the database.
 * 
 * Production-grade features:
 * - Asynchronous non-blocking logging
 * - Fail-safe error handling (never affects main application flow)
 * - Configurable settings from database
 * - Metadata size limiting
 * - Duplicate spam prevention
 * - IP Address and User Agent tracking (internal only)
 * - Request ID support for correlation
 * - Activity Monitor page filtering
 */
class ActivityLogger {
    constructor() {
        this.pool = pool;
        this.settings = null;
        this.settingsCache = null;
        this.settingsCacheTime = 0;
        this.deduplicationCache = new Map(); // Key: "userId:action:entityType:entityId", Value: timestamp
    }

    /**
     * Get settings from database with caching
     */
    async getSettings() {
        const now = Date.now();
        const CACHE_TTL = 60000; // 1 minute cache

        if (this.settingsCache && (now - this.settingsCacheTime) < CACHE_TTL) {
            return this.settingsCache;
        }

        try {
            const query = 'SELECT setting_key, setting_value FROM activity_monitor_settings';
            const result = await this.pool.query(query);
            
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

            this.settingsCache = settings;
            this.settingsCacheTime = now;
            return settings;
        } catch (error) {
            console.error('Error fetching activity monitor settings:', error);
            // Return default settings on error
            return this.getDefaultSettings();
        }
    }

    /**
     * Get default settings as fallback
     */
    getDefaultSettings() {
        return {
            retention_days: 90,
            max_records: 100000,
            auto_delete: true,
            deduplication_enabled: true,
            deduplication_interval_seconds: 5,
            max_metadata_size_bytes: 4096,
            log_ip_address: true,
            log_user_agent: true,
            log_request_id: true,
            enabled_roles: 'customer,farmer,admin,super_admin'
        };
    }

    /**
     * Check if role is enabled for logging
     */
    isRoleEnabled(role, settings) {
        const enabledRoles = settings.enabled_roles || 'customer,farmer,admin,super_admin';
        const rolesArray = enabledRoles.split(',').map(r => r.trim());
        return rolesArray.includes(role);
    }

    /**
     * Check if activity should be filtered (Activity Monitor self-generated)
     */
    shouldFilterActivity(action, currentPage) {
        // Filter Activity Monitor page views and refreshes
        const activityMonitorPaths = ['/admin/activity-monitor', '/api/activity-monitor'];
        const isActivityMonitorPage = activityMonitorPaths.some(path => 
            currentPage && currentPage.includes(path)
        );
        
        // Don't log page views or refreshes on Activity Monitor
        if (isActivityMonitorPage && (action === 'view_page' || action === 'refresh')) {
            return true;
        }

        return false;
    }

    /**
     * Calculate risk score and level for an activity
     * @param {Object} data - Activity data
     * @returns {Object} Risk assessment { risk_level, risk_score }
     */
    calculateRisk(data) {
        const { action, status, role, user_id, ip_address, metadata = {} } = data;
        let riskScore = 0;

        // High-risk actions
        const highRiskActions = ['failed_login', 'security_event', 'admin_settings_change'];
        if (highRiskActions.includes(action)) {
            riskScore += 40;
        }

        // Failed status increases risk
        if (status === 'failed') {
            riskScore += 30;
        }

        // Admin/super_admin actions have higher baseline risk
        if (role === 'admin' || role === 'super_admin') {
            riskScore += 10;
        }

        // Check for suspicious patterns in metadata
        if (metadata.reason && metadata.reason.includes('invalid')) {
            riskScore += 20;
        }

        // Check for rapid failed logins (would need session tracking for full implementation)
        // For now, we use a simple heuristic
        if (action === 'failed_login') {
            riskScore += 25;
        }

        // Determine risk level
        let riskLevel = 'low';
        if (riskScore >= 70) {
            riskLevel = 'critical';
        } else if (riskScore >= 50) {
            riskLevel = 'high';
        } else if (riskScore >= 30) {
            riskLevel = 'medium';
        }

        return { risk_level: riskLevel, risk_score: Math.min(riskScore, 100) };
    }

    /**
     * Check for duplicate activity (spam prevention)
     */
    isDuplicateActivity(userId, action, entityType, entityId, settings) {
        if (!settings.deduplication_enabled) {
            return false;
        }

        const key = `${userId}:${action}:${entityType}:${entityId}`;
        const now = Date.now();
        const intervalMs = (settings.deduplication_interval_seconds || 5) * 1000;

        const lastLog = this.deduplicationCache.get(key);
        if (lastLog && (now - lastLog) < intervalMs) {
            return true;
        }

        // Update cache
        this.deduplicationCache.set(key, now);
        
        // Clean up old entries periodically
        if (this.deduplicationCache.size > 1000) {
            const cutoff = now - intervalMs * 2;
            for (const [k, v] of this.deduplicationCache.entries()) {
                if (v < cutoff) {
                    this.deduplicationCache.delete(k);
                }
            }
        }

        return false;
    }

    /**
     * Limit metadata size to prevent oversized payloads
     */
    limitMetadataSize(metadata, settings) {
        const maxSize = settings.max_metadata_size_bytes || 4096;
        const jsonString = JSON.stringify(metadata);
        
        if (Buffer.byteLength(jsonString, 'utf8') <= maxSize) {
            return metadata;
        }

        // Truncate metadata if too large
        const truncated = jsonString.substring(0, maxSize);
        try {
            return JSON.parse(truncated);
        } catch {
            // If invalid JSON after truncation, return minimal metadata
            return { _truncated: true, _original_size: Buffer.byteLength(jsonString, 'utf8') };
        }
    }

    /**
     * Log an activity (asynchronous, non-blocking, fail-safe)
     * 
     * @param {Object} data - Activity data
     * @param {string} data.session_id - Session identifier
     * @param {number} data.user_id - User ID (optional for guest activities)
     * @param {string} data.role - User role ('customer', 'farmer', 'admin', 'super_admin')
     * @param {string} data.action - Action type (login, logout, search_product, etc.)
     * @param {string} data.entity_type - Type of entity being acted upon (product, order, user, etc.)
     * @param {number} data.entity_id - ID of the entity being acted upon
     * @param {string} data.description - Human-readable description
     * @param {string} data.current_page - Current page URL
     * @param {string} data.status - Activity status ('success', 'failed', 'pending')
     * @param {Object} data.metadata - Additional context as key-value pairs
     * @param {string} data.ip_address - Client IP address
     * @param {string} data.user_agent - Client user agent
     * @param {string} data.request_id - Request ID for correlation
     * @returns {Promise<void>} Always resolves, never rejects
     */
    async log(data) {
        // Fire and forget - don't await the result
        this._logInternal(data).catch(err => {
            // Error already logged in _logInternal, just catch to prevent unhandled rejection
        });
    }

    /**
     * Internal logging method with all safety checks
     */
    async _logInternal(data) {
        const {
            session_id,
            user_id = null,
            role,
            action,
            entity_type = null,
            entity_id = null,
            description = '',
            current_page = null,
            status = 'success',
            metadata = {},
            ip_address = null,
            user_agent = null,
            request_id = null
        } = data;

        try {
            // Get settings
            const settings = await this.getSettings();

            // Check if role is enabled for logging
            if (role && !this.isRoleEnabled(role, settings)) {
                return;
            }

            // Filter Activity Monitor self-generated activities
            if (this.shouldFilterActivity(action, current_page)) {
                return;
            }

            // Check for duplicate/spam activities
            if (user_id && this.isDuplicateActivity(user_id, action, entity_type, entity_id, settings)) {
                return;
            }

            // Limit metadata size
            const limitedMetadata = this.limitMetadataSize(metadata, settings);

            // Calculate risk level and score
            const riskAssessment = this.calculateRisk(data);

            // Get IP geolocation (backend-only, non-blocking)
            let geoData = null;
            if (ip_address && settings.log_ip_address !== false) {
                geoData = await ipGeolocation.getGeolocation(ip_address);
            }

            // Parse browser info (backend-only, non-blocking)
            let browserData = null;
            if (user_agent && settings.log_user_agent !== false) {
                browserData = browserParser.parse(user_agent);
            }

            // Determine which fields to log based on settings
            const logIpAddress = settings.log_ip_address !== false;
            const logUserAgent = settings.log_user_agent !== false;
            const logRequestId = settings.log_request_id !== false;

            const query = `
                INSERT INTO activity_logs (
                    session_id, user_id, role, action, entity_type, entity_id,
                    description, current_page, status, metadata,
                    ip_address, user_agent, request_id,
                    risk_level, risk_score,
                    country, city, latitude, longitude,
                    browser_name, browser_version, os_name, os_version, device_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
            `;

            const values = [
                session_id,
                user_id,
                role,
                action,
                entity_type,
                entity_id,
                description,
                current_page,
                status,
                JSON.stringify(limitedMetadata),
                logIpAddress ? ip_address : null,
                logUserAgent ? user_agent : null,
                logRequestId ? request_id : null,
                riskAssessment.risk_level,
                riskAssessment.risk_score,
                geoData?.country || null,
                geoData?.city || null,
                geoData?.latitude || null,
                geoData?.longitude || null,
                browserData?.browser_name || null,
                browserData?.browser_version || null,
                browserData?.os_name || null,
                browserData?.os_version || null,
                browserData?.device_type || null
            ];

            await this.pool.query(query, values);

            // Broadcast to Activity Monitor clients for realtime updates
            if (broadcastNewActivity) {
                try {
                    broadcastNewActivity({
                        id: null, // Would need to return the inserted ID for full implementation
                        session_id,
                        user_id,
                        role,
                        action,
                        entity_type,
                        entity_id,
                        description,
                        current_page,
                        status,
                        metadata: limitedMetadata,
                        ip_address: logIpAddress ? ip_address : null,
                        user_agent: logUserAgent ? user_agent : null,
                        request_id: logRequestId ? request_id : null,
                        risk_level: riskAssessment.risk_level,
                        risk_score: riskAssessment.risk_score,
                        country: geoData?.country || null,
                        city: geoData?.city || null,
                        latitude: geoData?.latitude || null,
                        longitude: geoData?.longitude || null,
                        browser_name: browserData?.browser_name || null,
                        browser_version: browserData?.browser_version || null,
                        os_name: browserData?.os_name || null,
                        os_version: browserData?.os_version || null,
                        device_type: browserData?.device_type || null,
                        created_at: new Date().toISOString()
                    });
                } catch (error) {
                    // Broadcast failure should not affect logging
                    console.error('[ActivityLogger] Error broadcasting activity:', error.message);
                }
            }
        } catch (error) {
            // Never throw - log error silently to avoid affecting main application
            console.error('[ActivityLogger] Error logging activity:', error.message);
        }
    }

    /**
     * Log login activity (asynchronous, non-blocking)
     */
    logLogin(userId, role, sessionId, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'login',
            description: 'User logged in successfully',
            status: 'success',
            metadata,
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log logout activity (asynchronous, non-blocking)
     */
    logLogout(userId, role, sessionId, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'logout',
            description: 'User logged out',
            status: 'success',
            metadata,
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log failed login activity (asynchronous, non-blocking)
     */
    logFailedLogin(email, role, sessionId, reason = 'Invalid credentials', metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: null,
            role: role,
            action: 'failed_login',
            description: `Failed login attempt: ${reason}`,
            status: 'failed',
            metadata: { ...metadata, email, reason },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log product search (asynchronous, non-blocking)
     */
    logSearchProduct(userId, role, sessionId, searchTerm, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'search_product',
            entity_type: 'product',
            description: `Searched for products: ${searchTerm}`,
            status: 'success',
            metadata: { ...metadata, search_term: searchTerm },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log product view (asynchronous, non-blocking)
     */
    logViewProduct(userId, role, sessionId, productId, productName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'view_product',
            entity_type: 'product',
            entity_id: productId,
            description: `Viewed product: ${productName}`,
            status: 'success',
            metadata: { ...metadata, product_name: productName },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log add to wishlist (asynchronous, non-blocking)
     */
    logAddWishlist(userId, role, sessionId, productId, productName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'add_wishlist',
            entity_type: 'product',
            entity_id: productId,
            description: `Added product to wishlist: ${productName}`,
            status: 'success',
            metadata: { ...metadata, product_name: productName },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log remove from wishlist (asynchronous, non-blocking)
     */
    logRemoveWishlist(userId, role, sessionId, productId, productName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'remove_wishlist',
            entity_type: 'product',
            entity_id: productId,
            description: `Removed product from wishlist: ${productName}`,
            status: 'success',
            metadata: { ...metadata, product_name: productName },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log add to cart (asynchronous, non-blocking)
     */
    logAddCart(userId, role, sessionId, productId, productName, quantity, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'add_cart',
            entity_type: 'product',
            entity_id: productId,
            description: `Added to cart: ${productName} (Qty: ${quantity})`,
            status: 'success',
            metadata: { ...metadata, product_name: productName, quantity },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log remove from cart (asynchronous, non-blocking)
     */
    logRemoveCart(userId, role, sessionId, productId, productName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'remove_cart',
            entity_type: 'product',
            entity_id: productId,
            description: `Removed from cart: ${productName}`,
            status: 'success',
            metadata: { ...metadata, product_name: productName },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log checkout initiation (asynchronous, non-blocking)
     */
    logCheckout(userId, role, sessionId, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'checkout',
            entity_type: 'order',
            description: 'Initiated checkout process',
            status: 'success',
            metadata,
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log place order (asynchronous, non-blocking)
     */
    logPlaceOrder(userId, role, sessionId, orderId, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'place_order',
            entity_type: 'order',
            entity_id: orderId,
            description: `Placed order #${orderId}`,
            status: 'success',
            metadata: { ...metadata, order_id: orderId },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log cancel order (asynchronous, non-blocking)
     */
    logCancelOrder(userId, role, sessionId, orderId, reason, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'cancel_order',
            entity_type: 'order',
            entity_id: orderId,
            description: `Cancelled order #${orderId}: ${reason}`,
            status: 'success',
            metadata: { ...metadata, order_id: orderId, reason },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log add product (farmer) - asynchronous, non-blocking
     */
    logAddProduct(userId, role, sessionId, productId, productName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'add_product',
            entity_type: 'product',
            entity_id: productId,
            description: `Created new product: ${productName}`,
            status: 'success',
            metadata: { ...metadata, product_name: productName },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log edit product (farmer) - asynchronous, non-blocking
     */
    logEditProduct(userId, role, sessionId, productId, productName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'edit_product',
            entity_type: 'product',
            entity_id: productId,
            description: `Updated product: ${productName}`,
            status: 'success',
            metadata: { ...metadata, product_name: productName },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log delete product (farmer) - asynchronous, non-blocking
     */
    logDeleteProduct(userId, role, sessionId, productId, productName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'delete_product',
            entity_type: 'product',
            entity_id: productId,
            description: `Deleted product: ${productName}`,
            status: 'success',
            metadata: { ...metadata, product_name: productName },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log approve farmer (admin) - asynchronous, non-blocking
     */
    logApproveFarmer(userId, role, sessionId, farmerId, farmerName, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'approve_farmer',
            entity_type: 'user',
            entity_id: farmerId,
            description: `Approved farmer: ${farmerName}`,
            status: 'success',
            metadata: { ...metadata, farmer_name: farmerName, farmer_id: farmerId },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log reject farmer (admin) - asynchronous, non-blocking
     */
    logRejectFarmer(userId, role, sessionId, farmerId, farmerName, reason, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'reject_farmer',
            entity_type: 'user',
            entity_id: farmerId,
            description: `Rejected farmer: ${farmerName} - ${reason}`,
            status: 'success',
            metadata: { ...metadata, farmer_name: farmerName, farmer_id: farmerId, reason },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log security event - asynchronous, non-blocking
     */
    logSecurityEvent(userId, role, sessionId, eventType, description, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'security_event',
            description: `Security event: ${description}`,
            status: 'success',
            metadata: { ...metadata, event_type: eventType },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Log admin settings change - asynchronous, non-blocking
     */
    logAdminSettingsChange(userId, role, sessionId, settingName, oldValue, newValue, metadata = {}, ipAddress = null, userAgent = null, requestId = null) {
        this.log({
            session_id: sessionId,
            user_id: userId,
            role: role,
            action: 'admin_settings_change',
            entity_type: 'settings',
            description: `Changed setting: ${settingName}`,
            status: 'success',
            metadata: { ...metadata, setting_name: settingName, old_value: oldValue, new_value: newValue },
            ip_address: ipAddress,
            user_agent: userAgent,
            request_id: requestId
        });
    }

    /**
     * Get session timeline
     * 
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Array>} Timeline of activities for the session
     */
    async getSessionTimeline(sessionId) {
        try {
            const query = `
                SELECT * FROM activity_logs
                WHERE session_id = $1
                ORDER BY created_at ASC
            `;
            const result = await this.pool.query(query, [sessionId]);
            return result.rows;
        } catch (error) {
            console.error('Error getting session timeline:', error);
            return [];
        }
    }

    /**
     * Clean up old activity logs based on retention settings
     * 
     * @param {Object} settings - Retention settings (optional, uses DB settings if not provided)
     * @returns {Promise<Object>} Cleanup statistics
     */
    async cleanupOldLogs(settings = {}) {
        try {
            // Use provided settings or fetch from database
            const dbSettings = await this.getSettings();
            const {
                retentionDays = dbSettings.retention_days || 90,
                maxRecords = dbSettings.max_records || 100000,
                autoDelete = dbSettings.auto_delete !== false
            } = settings;

            if (!autoDelete) {
                return { deleted: 0, reason: 'Auto-delete disabled' };
            }

            let deletedCount = 0;

            // Delete logs older than retention period
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const deleteOldQuery = `
                DELETE FROM activity_logs
                WHERE created_at < $1
                RETURNING id
            `;
            const oldResult = await this.pool.query(deleteOldQuery, [cutoffDate]);
            deletedCount += oldResult.rowCount;

            // If still exceeding max records, delete oldest
            const countQuery = 'SELECT COUNT(*) as count FROM activity_logs';
            const countResult = await this.pool.query(countQuery);
            const currentCount = parseInt(countResult.rows[0].count);

            if (currentCount > maxRecords) {
                const excessCount = currentCount - maxRecords;
                const deleteExcessQuery = `
                    DELETE FROM activity_logs
                    WHERE id IN (
                        SELECT id FROM activity_logs
                        ORDER BY created_at ASC
                        LIMIT $1
                    )
                    RETURNING id
                `;
                const excessResult = await this.pool.query(deleteExcessQuery, [excessCount]);
                deletedCount += excessResult.rowCount;
            }

            return {
                deleted: deletedCount,
                reason: 'Retention cleanup completed'
            };
        } catch (error) {
            console.error('[ActivityLogger] Error cleaning up old logs:', error.message);
            return { deleted: 0, error: error.message };
        }
    }

    /**
     * Get dashboard summary statistics
     * 
     * @returns {Promise<Object>} Summary statistics
     */
    async getDashboardSummary() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const queries = {
                todayActivities: 'SELECT COUNT(*) as count FROM activity_logs WHERE created_at >= $1',
                onlineUsers: `
                    SELECT COUNT(DISTINCT user_id) as count 
                    FROM activity_logs 
                    WHERE created_at >= NOW() - INTERVAL '30 minutes'
                    AND user_id IS NOT NULL
                `,
                customerActions: `
                    SELECT COUNT(*) as count 
                    FROM activity_logs 
                    WHERE created_at >= $1 AND role = 'customer'
                `,
                farmerActions: `
                    SELECT COUNT(*) as count 
                    FROM activity_logs 
                    WHERE created_at >= $1 AND role = 'farmer'
                `,
                adminActions: `
                    SELECT COUNT(*) as count 
                    FROM activity_logs 
                    WHERE created_at >= $1 AND role IN ('admin', 'super_admin')
                `,
                errorsToday: `
                    SELECT COUNT(*) as count 
                    FROM activity_logs 
                    WHERE created_at >= $1 AND status = 'failed'
                `
            };

            const results = await Promise.all([
                this.pool.query(queries.todayActivities, [today]),
                this.pool.query(queries.onlineUsers),
                this.pool.query(queries.customerActions, [today]),
                this.pool.query(queries.farmerActions, [today]),
                this.pool.query(queries.adminActions, [today]),
                this.pool.query(queries.errorsToday, [today])
            ]);

            return {
                todayActivities: parseInt(results[0].rows[0].count),
                onlineUsers: parseInt(results[1].rows[0].count),
                customerActions: parseInt(results[2].rows[0].count),
                farmerActions: parseInt(results[3].rows[0].count),
                adminActions: parseInt(results[4].rows[0].count),
                errorsToday: parseInt(results[5].rows[0].count)
            };
        } catch (error) {
            console.error('Error getting dashboard summary:', error);
            return {
                todayActivities: 0,
                onlineUsers: 0,
                customerActions: 0,
                farmerActions: 0,
                adminActions: 0,
                errorsToday: 0
            };
        }
    }
}

// Export singleton instance and helper function
const activityLoggerInstance = new ActivityLogger();
activityLoggerInstance.setBroadcastFunction = setBroadcastFunction;
module.exports = activityLoggerInstance;
