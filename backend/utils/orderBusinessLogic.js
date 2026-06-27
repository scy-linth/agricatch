/**
 * Order Business Logic - Unified Business Rules
 * 
 * This module contains centralized business logic for order operations.
 * All order status changes (cancel, deliver) should use these functions
 * to ensure consistent behavior across Farmer and Admin workflows.
 * 
 * No API changes - these are internal utility functions.
 * No schema changes - uses existing tables and columns.
 */

const { pool } = require('./db');

/**
 * Restore inventory when an order is cancelled.
 * 
 * Handles all order types:
 * - Regular available products: restores stock_quantity
 * - Pre-order (not converted): releases reserved_quantity
 * - Pre-order (converted): restores allocated stock_quantity from fulfilled_quantity
 * 
 * @param {Object} client - PostgreSQL client (must be in transaction)
 * @param {Object} order - Order object with fields:
 *   - id: order ID
 *   - product_id: product ID
 *   - quantity: order quantity
 *   - is_preorder: boolean
 *   - preorder_converted_at: timestamp or null
 *   - preorder_fulfilled_quantity: number
 *   - preorder_reserved_quantity: number
 */
async function restoreInventoryOnCancel(client, order) {
  if (!order) return;

  if (order.is_preorder) {
    // Preorder cancellation
    if (order.preorder_converted_at) {
      // Already converted: restore allocated quantity to stock
      if (order.preorder_fulfilled_quantity > 0) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
          [order.preorder_fulfilled_quantity, order.product_id]
        );
        // Reset fulfilled quantity to prevent double restoration (idempotent)
        await client.query(
          'UPDATE orders SET preorder_fulfilled_quantity = 0 WHERE id = $1',
          [order.id]
        );
      }
    } else {
      // Not yet converted: release reservation
      if (order.preorder_reserved_quantity > 0) {
        await client.query(
          'UPDATE products SET reserved_quantity = reserved_quantity - $1 WHERE id = $2',
          [order.preorder_reserved_quantity, order.product_id]
        );
        // Reset reserved quantity to prevent double release (idempotent)
        await client.query(
          'UPDATE orders SET preorder_reserved_quantity = 0 WHERE id = $1',
          [order.id]
        );
      }
    }
  } else {
    // Regular order cancellation: restore stock
    await client.query(
      'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
      [order.quantity, order.product_id]
    );
  }
}

/**
 * Update statistics when an order is delivered.
 * 
 * Updates:
 * - products.sales_count (increment by order quantity)
 * - users.total_sales (increment by order quantity)
 * - users.total_revenue (increment by order total_amount)
 * 
 * @param {Object} client - PostgreSQL client (must be in transaction)
 * @param {Object} order - Order object with fields:
 *   - product_id: product ID
 *   - quantity: order quantity
 *   - total_amount: order total amount
 *   - farmer_id: farmer user ID
 */
async function updateStatisticsOnDeliver(client, order) {
  if (!order) return;

  // Update product sales count
  await client.query(
    'UPDATE products SET sales_count = COALESCE(sales_count, 0) + $1 WHERE id = $2',
    [order.quantity, order.product_id]
  );

  // Update farmer total sales and revenue
  await client.query(
    `UPDATE users
     SET total_sales = COALESCE(total_sales, 0) + $1,
         total_revenue = COALESCE(total_revenue, 0) + $2
     WHERE id = $3`,
    [order.quantity, order.total_amount || 0, order.farmer_id]
  );
}

/**
 * Get order details with all fields needed for business logic.
 * 
 * @param {Object} client - PostgreSQL client
 * @param {number} orderId - Order ID
 * @returns {Promise<Object|null>} Order object or null
 */
async function getOrderForBusinessLogic(client, orderId) {
  const result = await client.query(
    `SELECT 
       o.id,
       o.product_id,
       o.quantity,
       o.total_amount,
       o.is_preorder,
       o.preorder_converted_at,
       o.preorder_fulfilled_quantity,
       o.preorder_reserved_quantity,
       p.farmer_id
     FROM orders o
     JOIN products p ON o.product_id = p.id
     WHERE o.id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

module.exports = {
  restoreInventoryOnCancel,
  updateStatisticsOnDeliver,
  getOrderForBusinessLogic
};
