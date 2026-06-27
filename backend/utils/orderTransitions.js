/**
 * Order Transition Matrix - Single Source of Truth
 * 
 * This module defines the canonical order status transition rules
 * for all user roles (customer, farmer, admin).
 * 
 * Status Workflow:
 * - Regular orders: pending → confirmed → preparing → scheduled → out_for_delivery → delivered
 * - Pre-orders: preorder_reserved → confirmed → preparing → scheduled → out_for_delivery → delivered
 * - Cancellation: Available at specific stages based on user role
 */

// All valid order statuses
const VALID_STATUSES = [
  'pending',
  'accepted',
  'preorder_reserved',
  'confirmed',
  'preparing',
  'scheduled',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled'
];

// Canonical status transition matrix
// Defines allowed forward transitions for each status
const TRANSITION_MATRIX = {
  pending: ['confirmed', 'cancelled'],
  accepted: ['confirmed', 'cancelled'],
  preorder_reserved: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['scheduled', 'cancelled'],
  scheduled: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['completed'], // Can transition to completed after delivery
  completed: [], // Terminal state
  cancelled: [] // Terminal state
};

// Role-based cancellation rules
// Defines which statuses each role can cancel from
const CANCELLATION_RULES = {
  customer: ['pending', 'preorder_reserved'],
  farmer: ['pending', 'confirmed', 'preparing'],
  admin: VALID_STATUSES.filter(s => s !== 'delivered' && s !== 'completed' && s !== 'cancelled'),
  super_admin: VALID_STATUSES.filter(s => s !== 'delivered' && s !== 'completed' && s !== 'cancelled')
};

/**
 * Validate a status transition
 * @param {string} currentStatus - Current order status
 * @param {string} newStatus - Target status
 * @param {string} role - User role (customer, farmer, admin, super_admin)
 * @returns {object} Validation result with valid flag and message
 */
function validateTransition(currentStatus, newStatus, role = 'admin') {
  // Validate input statuses
  if (!VALID_STATUSES.includes(currentStatus)) {
    return {
      valid: false,
      message: `Invalid current status: ${currentStatus}`
    };
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    return {
      valid: false,
      message: `Invalid target status: ${newStatus}`
    };
  }

  // Check if status is terminal
  if (currentStatus === 'cancelled') {
    return {
      valid: false,
      message: 'Cannot change status from cancelled. Create a new order instead.'
    };
  }

  if (currentStatus === 'completed') {
    return {
      valid: false,
      message: 'Cannot change status from completed. This order is already complete.'
    };
  }

  // Handle cancellation separately with role-based rules
  if (newStatus === 'cancelled') {
    const allowedCancellations = CANCELLATION_RULES[role] || CANCELLATION_RULES.admin;
    
    if (!allowedCancellations.includes(currentStatus)) {
      return {
        valid: false,
        message: `${role.charAt(0).toUpperCase() + role.slice(1)} cannot cancel orders in ${currentStatus} status. Allowed: ${allowedCancellations.join(', ')}`
      };
    }
    
    return { valid: true };
  }

  // Handle regular forward transitions
  const allowedTransitions = TRANSITION_MATRIX[currentStatus] || [];
  
  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      message: `Invalid status transition: Cannot change from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Get allowed next statuses for a given current status
 * @param {string} currentStatus - Current order status
 * @param {string} role - User role (for cancellation permissions)
 * @returns {array} Array of allowed next statuses
 */
function getAllowedTransitions(currentStatus, role = 'admin') {
  const forwardTransitions = TRANSITION_MATRIX[currentStatus] || [];
  const cancellationRules = CANCELLATION_RULES[role] || CANCELLATION_RULES.admin;
  
  // Add cancellation if allowed for this role and status
  const allowed = [...forwardTransitions];
  if (cancellationRules.includes(currentStatus) && !allowed.includes('cancelled')) {
    allowed.push('cancelled');
  }
  
  return allowed;
}

/**
 * Check if a status is terminal (no outgoing transitions)
 * @param {string} status - Order status
 * @returns {boolean} True if terminal
 */
function isTerminalStatus(status) {
  const transitions = TRANSITION_MATRIX[status] || [];
  return transitions.length === 0;
}

/**
 * Get all valid statuses
 * @returns {array} Array of all valid status strings
 */
function getValidStatuses() {
  return [...VALID_STATUSES];
}

/**
 * Get cancellation rules for a specific role
 * @param {string} role - User role
 * @returns {array} Array of statuses from which the role can cancel
 */
function getCancellationRules(role) {
  return CANCELLATION_RULES[role] || CANCELLATION_RULES.admin;
}

module.exports = {
  VALID_STATUSES,
  TRANSITION_MATRIX,
  CANCELLATION_RULES,
  validateTransition,
  getAllowedTransitions,
  isTerminalStatus,
  getValidStatuses,
  getCancellationRules
};
