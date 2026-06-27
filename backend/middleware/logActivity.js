const activityLogger = require('../services/activityLogger');

/**
 * Activity Logging Middleware
 * 
 * Automatically logs user activities based on request context.
 * This middleware should be used after authentication to capture user information.
 */
function logActivity(action, options = {}) {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json;

        // Override json method to log after response
        res.json = function(data) {
            // Only log on successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const userId = req.user?.id;
                const role = req.user?.role;
                const sessionId = req.sessionID || req.headers['x-session-id'] || 'unknown';

                // Skip logging if monitoring is disabled or user role is not enabled
                if (!shouldLogActivity(role, action)) {
                    return originalJson.call(this, data);
                }

                // Extract entity information from request
                const entityInfo = extractEntityInfo(req, action);

                // Log the activity
                activityLogger.log({
                    session_id: sessionId,
                    user_id: userId,
                    role: role,
                    action: action,
                    entity_type: entityInfo.type,
                    entity_id: entityInfo.id,
                    description: options.description || generateDescription(action, req, data),
                    current_page: req.headers['referer'] || req.originalUrl,
                    status: data.success !== false ? 'success' : 'failed',
                    metadata: {
                        method: req.method,
                        path: req.originalUrl,
                        ...options.metadata
                    }
                }).catch(err => {
                    console.error('Error logging activity:', err);
                });
            }

            return originalJson.call(this, data);
        };

        next();
    };
}

/**
 * Check if activity should be logged based on role and action
 */
function shouldLogActivity(role, action) {
    // For now, log all activities
    // In production, check settings for each role
    return true;
}

/**
 * Extract entity information from request
 */
function extractEntityInfo(req, action) {
    const entityInfo = { type: null, id: null };

    // Extract from route parameters
    if (req.params) {
        if (req.params.id) {
            entityInfo.id = parseInt(req.params.id);
        }
        if (req.params.productId) {
            entityInfo.id = parseInt(req.params.productId);
            entityInfo.type = 'product';
        }
        if (req.params.orderId) {
            entityInfo.id = parseInt(req.params.orderId);
            entityInfo.type = 'order';
        }
        if (req.params.userId) {
            entityInfo.id = parseInt(req.params.userId);
            entityInfo.type = 'user';
        }
    }

    // Extract from request body
    if (req.body) {
        if (req.body.product_id && !entityInfo.id) {
            entityInfo.id = req.body.product_id;
            entityInfo.type = 'product';
        }
        if (req.body.order_id && !entityInfo.id) {
            entityInfo.id = req.body.order_id;
            entityInfo.type = 'order';
        }
    }

    // Determine entity type based on action if not already set
    if (!entityInfo.type && entityInfo.id) {
        if (action.includes('product')) {
            entityInfo.type = 'product';
        } else if (action.includes('order')) {
            entityInfo.type = 'order';
        } else if (action.includes('user') || action.includes('farmer')) {
            entityInfo.type = 'user';
        }
    }

    return entityInfo;
}

/**
 * Generate description for activity
 */
function generateDescription(action, req, responseData) {
    const descriptions = {
        'login': 'User logged in successfully',
        'logout': 'User logged out',
        'search_product': `Searched for products: ${req.query.search || req.body.search || ''}`,
        'view_product': 'Viewed product details',
        'add_wishlist': 'Added product to wishlist',
        'remove_wishlist': 'Removed product from wishlist',
        'add_cart': 'Added product to cart',
        'remove_cart': 'Removed product from cart',
        'checkout': 'Initiated checkout process',
        'place_order': 'Placed new order',
        'cancel_order': 'Cancelled order',
        'add_product': 'Created new product',
        'edit_product': 'Updated product',
        'delete_product': 'Deleted product',
        'approve_farmer': 'Approved farmer verification',
        'reject_farmer': 'Rejected farmer verification',
        'admin_settings_change': 'Modified platform settings',
        'security_event': 'Security-related event detected'
    };

    return descriptions[action] || `Performed action: ${action}`;
}

/**
 * Log login activity
 */
async function logLogin(req, res, next) {
    const userId = req.user?.id;
    const role = req.user?.role;
    const sessionId = req.sessionID;

    if (userId && role && sessionId) {
        await activityLogger.logLogin(userId, role, sessionId);
    }

    next();
}

/**
 * Log logout activity
 */
async function logLogout(req, res, next) {
    const userId = req.user?.id;
    const role = req.user?.role;
    const sessionId = req.sessionID;

    if (userId && role && sessionId) {
        await activityLogger.logLogout(userId, role, sessionId);
    }

    next();
}

/**
 * Log failed login activity
 */
async function logFailedLogin(req, res, next) {
    const email = req.body?.email;
    const sessionId = req.sessionID;

    if (email && sessionId) {
        await activityLogger.logFailedLogin(email, 'customer', sessionId, 'Invalid credentials');
    }

    next();
}

module.exports = {
    logActivity,
    logLogin,
    logLogout,
    logFailedLogin
};
