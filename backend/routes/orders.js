const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../utils/db');
const { broadcastEvent } = require('../utils/realtime');

const router = express.Router();

// Status workflow: pending → confirmed → preparing → out_for_delivery → delivered
// Can be cancelled at any point (except delivered)

// Get user orders
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    } catch (_) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Per-item orders: each order represents one product/item
    const result = await pool.query(`
      SELECT o.*,
             p.name as product_name,
             p.unit,
             p.image_url,
             p.farmer_id,
            f.full_name as farmer_name,
            f.address as farm_location
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users f ON p.farmer_id = f.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `, [decoded.id]);

    console.log(`[Get Orders] User ${decoded.id}: Found ${result.rows.length} orders`);

    // Format orders to match frontend expectations (each order is already one item)
    const orders = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      product_id: row.product_id,
      quantity: row.quantity,
      price: row.price,
      total_amount: row.total_amount,
      status: row.status,
      delivered_at: row.delivered_at,
      delivery_address: row.delivery_address,
      delivery_date: row.delivery_date,
      special_instructions: row.special_instructions,
      created_at: row.created_at,
      updated_at: row.updated_at,
      items: [{
        product_id: row.product_id,
        product_name: row.product_name,
        quantity: row.quantity,
        price: row.price,
        unit: row.unit,
        image_url: row.image_url,
        farmer_id: row.farmer_id,
        farmer_name: row.farmer_name,
        farm_location: row.farm_location,
        status: row.status,
        delivered_at: row.delivered_at,
        cancellation_reason: row.cancellation_reason
      }]
    }));

    res.json({ orders });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error fetching orders' });
  }
});

// Get farmer orders
router.get('/farmer/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { status } = req.query;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    } catch (_) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Verify the user is the farmer (defensive: decoded.id may be string/number)
    if (Number(decoded.id) !== Number(farmerId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Per-item orders: query orders where product belongs to this farmer
    let query = `
      SELECT 
        o.id,
        o.user_id,
        o.product_id,
        o.quantity,
        o.price,
        o.total_amount,
        o.status,
        o.delivery_address,
        o.delivery_date,
        o.special_instructions,
        o.cancellation_reason,
        o.created_at,
        o.updated_at,
        u.full_name as customer_name,
        o.user_id as customer_id,
        p.name as product_name,
        p.unit,
        p.image_url,
        o.price,
        o.quantity
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE p.farmer_id = $1
    `;

    const params = [farmerId];

    if (status) {
      // Filter by exact status (supporting all 6 statuses individually)
      query += ` AND o.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);
    
    console.log(`[Farmer Orders] Farmer ID: ${farmerId}, Status: ${status || 'all'}, Found ${result.rows.length} orders`);

    // Format orders for frontend (each order is one item)
    const orders = result.rows.map(row => ({
      id: row.id,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      product_id: row.product_id,
      quantity: row.quantity,
      price: row.price,
      total_amount: row.total_amount,
      status: row.status,
      created_at: row.created_at,
      delivery_address: row.delivery_address,
      delivery_date: row.delivery_date,
      special_instructions: row.special_instructions,
      cancellation_reason: row.cancellation_reason,
      product_name: row.product_name,
      product_image: row.image_url,
      price: row.price,
      unit: row.unit,
      items: [{
        order_item_id: row.id, // Use order id as item id for compatibility
        product_id: row.product_id,
        product_name: row.product_name,
        quantity: row.quantity,
        price: row.price,
        unit: row.unit,
        image_url: row.image_url,
        total_amount: row.total_amount,
        status: row.status,
        cancellation_reason: row.cancellation_reason
      }]
    }));

    res.json({ orders });

  } catch (error) {
    console.error('Get farmer orders error:', error);
    res.status(500).json({ message: 'Server error fetching farmer orders' });
  }
});

// Update order status (for farmers/admins) - per-item orders
// IMPORTANT: This route must come BEFORE /:id to ensure proper matching
router.put('/:orderId/items/:orderItemId/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    const orderItemId = parseInt(req.params.orderItemId, 10);
    const { status, note } = req.body || {};
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // In per-item system, orderItemId should match orderId (each order is one item)
    // Validate orderId is a valid number
    if (!orderId || isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid order id' });
    }
    
    // In per-item system, we use orderId (orderItemId is just for API compatibility)
    // If orderItemId is provided and doesn't match, that's okay - we'll use orderId
    const actualOrderId = orderId;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    const roleResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);
    const role = roleResult.rows[0]?.role;

    // Get order with product info (per-item order)
    const orderResult = await pool.query(`
      SELECT o.id, o.product_id, o.quantity, o.status, o.user_id as customer_id,
             p.farmer_id
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = $1
    `, [actualOrderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderResult.rows[0];
    if (role !== 'staff' && Number(order.farmer_id) !== Number(decoded.id)) {
      return res.status(403).json({ message: 'You can only update your own orders' });
    }

    if (order.status === 'cancelled' && status !== 'cancelled') {
      return res.status(400).json({ message: 'Cancelled orders cannot be updated' });
    }

    if (order.status === 'delivered' && status !== 'delivered') {
      return res.status(400).json({ message: 'Delivered orders cannot be updated' });
    }

    // Strict status transition matrix - enforce workflow: pending → confirmed → preparing → out_for_delivery → delivered
    // Cancellation allowed from any status except delivered
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: [], // Terminal state - no transitions allowed
      cancelled: [] // Terminal state - no transitions allowed
    };

    // Validate status transition
    if (status !== 'cancelled') {
      const allowedNextStatuses = validTransitions[order.status] || [];
      if (!allowedNextStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status transition: Cannot change from ${order.status} to ${status}. Allowed transitions: ${allowedNextStatuses.join(', ')}` 
        });
      }
    } else {
      // Cancellation allowed from any status except delivered
      if (order.status === 'delivered') {
        return res.status(400).json({ message: 'Cannot cancel a delivered order' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update order directly (per-item system)
      await client.query(`
        UPDATE orders
        SET status = $1::varchar,
            updated_at = CURRENT_TIMESTAMP,
            delivered_at = CASE WHEN $1::varchar = 'delivered'::varchar THEN CURRENT_TIMESTAMP ELSE delivered_at END,
            cancelled_at = CASE WHEN $1::varchar = 'cancelled'::varchar THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
            cancelled_by = CASE WHEN $1::varchar = 'cancelled'::varchar THEN 'farmer'::varchar ELSE cancelled_by END
        WHERE id = $2
      `, [status, actualOrderId]);

      if (status === 'cancelled' && order.status !== 'cancelled') {
        await client.query(`
          UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2
        `, [order.quantity, order.product_id]);
      }

      const message = `Order #${orderId} is now ${status}.`;
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, order_id, product_id)
        VALUES ($1, 'order_update', 'Order update', $2, $3, $4)
      `, [order.customer_id, message, orderId, order.product_id]);

      await client.query('COMMIT');

      // Broadcast real-time event with new status for synchronization
      broadcastEvent('order.updated', {
        order_id: actualOrderId,
        customer_id: order.customer_id,
        farmer_ids: [Number(order.farmer_id)],
        new_status: status,
        old_status: order.status
      });

      res.json({
        message: 'Order status updated successfully',
        order_id: actualOrderId,
        status
      });
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
      }
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error updating order status' });
  }
});

// Get single order
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

    // Per-item order: order directly contains product info
    const result = await pool.query(`
      SELECT o.*,
             p.name as product_name,
             p.unit,
             p.image_url,
             p.farmer_id,
             f.full_name as farmer_name,
                  f.address as farm_location
      FROM orders o
      JOIN products p ON o.product_id = p.id
      LEFT JOIN users f ON p.farmer_id = f.id
      WHERE o.id = $1 AND o.user_id = $2
    `, [id, decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const row = result.rows[0];
    // Format to match frontend expectations
    const order = {
      ...row,
      items: [{
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name,
        quantity: row.quantity,
        price: row.price,
        unit: row.unit,
        image_url: row.image_url,
        farmer_id: row.farmer_id,
        farmer_name: row.farmer_name,
        farm_location: row.farm_location
      }]
    };

    res.json({ order });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error fetching order' });
  }
});

// Create new order
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required for ordering' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    const {
      delivery_address,
      delivery_date,
      special_instructions,
      sessionId: payloadSessionId
    } = req.body;
    const sessionId = payloadSessionId || null;

    // Validate required fields
    if (!delivery_address || !delivery_address.trim()) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }
    if (!delivery_date) {
      return res.status(400).json({ message: 'Delivery date is required' });
    }

    // Start transaction early to ensure consistency
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // Get user's cart items INSIDE transaction (include cart_id for deletion)
      const userCartQuery = `
        SELECT c.id as cart_id, c.quantity, p.id as product_id, p.price, p.stock_quantity, p.name
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = $1 AND p.is_available = true
      `;
      const sessionCartQuery = `
        SELECT c.id as cart_id, c.quantity, p.id as product_id, p.price, p.stock_quantity, p.name
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.session_id = $1 AND p.is_available = true
      `;
      let cartResult = await client.query(userCartQuery, [decoded.id]);

      if (cartResult.rows.length === 0 && sessionId) {
        cartResult = await client.query(sessionCartQuery, [sessionId]);
      }

      if (cartResult.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ message: 'Cart is empty' });
      }

      // Validate cart items have all required fields
      for (const item of cartResult.rows) {
        if (!item.product_id || !item.price || !item.quantity) {
          console.error('[Create Order] Invalid cart item:', item);
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ 
            message: 'Invalid cart item. Please refresh your cart and try again.' 
          });
        }
      }

      // Check stock availability
      for (const item of cartResult.rows) {
        if (item.quantity > item.stock_quantity) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({
            message: `Not enough stock for ${item.name}. Available: ${item.stock_quantity}`
          });
        }
      }

      console.log(`[Create Order] User ${decoded.id}, Cart items: ${cartResult.rows.length}, Creating one order per item`);

      // Create one order per cart item (per-item order system)
      const createdOrderIds = [];
      let totalAmount = 0;

      for (const item of cartResult.rows) {
        // Calculate item total
        const itemTotal = parseFloat(item.price) * parseInt(item.quantity);
        if (isNaN(itemTotal) || itemTotal <= 0) {
          throw new Error(`Invalid price or quantity for product ${item.product_id}`);
        }
        totalAmount += itemTotal;

        console.log(`[Create Order] Creating order for item: Product ${item.product_id}, Qty: ${item.quantity}, Price: ${item.price}, Total: ${itemTotal}`);
        
        // Create order for this item
        const orderResult = await client.query(`
          INSERT INTO orders (user_id, product_id, quantity, price, total_amount, delivery_address, delivery_date, special_instructions)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          decoded.id,
          item.product_id,
          item.quantity,
          item.price,
          itemTotal,
          delivery_address,
          delivery_date || null,
          special_instructions || null
        ]);

        const orderId = orderResult.rows[0].id;
        createdOrderIds.push(orderId);
        console.log(`[Create Order] Order #${orderId} created for product ${item.product_id}`);

        // Update product stock
        const stockResult = await client.query(`
          UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2
        `, [item.quantity, item.product_id]);
        console.log(`[Create Order] Stock updated for product ${item.product_id}, rows affected: ${stockResult.rowCount}`);

        // Get farmer for this product and send notification
        const farmerResult = await client.query(`
          SELECT farmer_id FROM products WHERE id = $1 AND farmer_id IS NOT NULL
        `, [item.product_id]);

        if (farmerResult.rows.length > 0 && farmerResult.rows[0].farmer_id) {
          const farmerId = farmerResult.rows[0].farmer_id;
          try {
            await client.query('SAVEPOINT create_order_notify_sp');
            const message = `You have a new order #${orderId} from a customer.`;
            await client.query(`
              INSERT INTO notifications (user_id, type, title, message, order_id)
              VALUES ($1, 'order_placed', 'New Order Received', $2, $3)
            `, [farmerId, message, orderId]);
            await client.query('RELEASE SAVEPOINT create_order_notify_sp');
            console.log(`[Create Order] Notification sent to farmer ${farmerId} for order #${orderId}`);
          } catch (notifError) {
            try {
              await client.query('ROLLBACK TO SAVEPOINT create_order_notify_sp');
            } catch (savepointError) {
              console.error('[Create Order] Savepoint rollback error:', savepointError);
            }
            // Log notification error but don't fail the order
            console.error('[Create Order] Notification error:', notifError);
          }
        }
      }

      // Clear user's cart - delete the specific cart items we used
      const cartIds = cartResult.rows.map(item => item.cart_id).filter(id => id != null);
      if (cartIds.length > 0) {
        const deleteResult = await client.query('DELETE FROM cart WHERE id = ANY($1::int[])', [cartIds]);
        console.log(`[Create Order] Deleted ${deleteResult.rowCount} cart items by ID`);
      } else {
        // Fallback: delete by user_id or session_id
        let deleteResult;
        if (sessionId) {
          deleteResult = await client.query('DELETE FROM cart WHERE user_id = $1 OR session_id = $2', [decoded.id, sessionId]);
        } else {
          deleteResult = await client.query('DELETE FROM cart WHERE user_id = $1', [decoded.id]);
        }
        console.log(`[Create Order] Deleted ${deleteResult.rowCount} cart items by user_id/session_id`);
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Orders placed successfully',
        orderIds: createdOrderIds,
        orderCount: createdOrderIds.length,
        totalAmount
      });

    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('[Create Order] Rollback error:', rollbackError);
        }
      }
      console.error('[Create Order] Transaction rolled back:', error);
      console.error('[Create Order] Transaction error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }

  } catch (error) {
    console.error('[Create Order] Error:', error);
    console.error('[Create Order] Error message:', error.message);
    console.error('[Create Order] Error stack:', error.stack);
    
    // Return more specific error message if it's a known issue
    if (error.message && error.message.includes('violates foreign key constraint')) {
      return res.status(400).json({ 
        message: 'Invalid product or user. Please refresh and try again.',
        details: error.message 
      });
    }
    if (error.message && error.message.includes('null value')) {
      return res.status(400).json({ 
        message: 'Missing required information. Please check all fields.',
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error creating order. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update order status (for farmers/staff) - alternative endpoint
router.put('/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!orderId) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

    // Check if user is staff or farmer who owns the products in the order
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);

    if (userResult.rows[0].role !== 'staff') {
      // Check if user is a farmer who owns the product in this order (per-item order)
      const farmerCheck = await pool.query(`
        SELECT p.farmer_id
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = $1
      `, [orderId]);

      if (farmerCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Defensive: DB/JWT ids can be string/number
      const isFarmer = Number(farmerCheck.rows[0].farmer_id) === Number(decoded.id);

      if (!isFarmer) {
        return res.status(403).json({ message: 'You can only update orders containing your products' });
      }
    }

    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const orderInfo = await pool.query('SELECT user_id FROM orders WHERE id = $1', [orderId]);
    if (orderInfo.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get order details for farmer_id
    const orderDetails = await pool.query(`
      SELECT o.user_id, o.product_id, o.quantity, o.total_amount, p.farmer_id
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = $1
    `, [orderId]);

    if (orderDetails.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderData = orderDetails.rows[0];

    // Get current order status for validation
    const currentOrderStatus = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
    if (currentOrderStatus.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const currentStatus = currentOrderStatus.rows[0].status;

    // Strict status transition validation (same as main endpoint)
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    if (status !== 'cancelled') {
      const allowedNextStatuses = validTransitions[currentStatus] || [];
      if (!allowedNextStatuses.includes(status)) {
        return res.status(400).json({ 
          message: `Invalid status transition: Cannot change from ${currentStatus} to ${status}` 
        });
      }
    } else {
      if (currentStatus === 'delivered') {
        return res.status(400).json({ message: 'Cannot cancel a delivered order' });
      }
    }

    if (currentStatus === 'cancelled' && status !== 'cancelled') {
      return res.status(400).json({ message: 'Cancelled orders cannot be updated' });
    }

    if (currentStatus === 'delivered' && status !== 'delivered') {
      return res.status(400).json({ message: 'Delivered orders cannot be updated' });
    }

    // Use transaction for consistency
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update order status
      await client.query(`
        UPDATE orders 
        SET status = $1, 
            updated_at = CURRENT_TIMESTAMP,
            delivered_at = CASE WHEN $1 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
            cancelled_at = CASE WHEN $1 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
            cancelled_by = CASE WHEN $1 = 'cancelled' THEN 'farmer' ELSE cancelled_by END
        WHERE id = $2
      `, [status, orderId]);

      // Restore stock if cancelled
      if (status === 'cancelled' && currentStatus !== 'cancelled') {
        await client.query(`
          UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2
        `, [orderData.quantity, orderData.product_id]);
      }

      // Send notification to customer
      const statusMessage = `Your order #${orderId} status is now ${status}.`;
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, order_id, product_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderInfo.rows[0].user_id,
          'order_update',
          'Order status update',
          statusMessage,
          orderId,
          orderData.product_id
        ]
      );

      // Update sales stats if delivered
      if (status === 'delivered') {
        await client.query(`
          UPDATE products p
          SET sales_count = sales_count + o.quantity
          FROM orders o
          WHERE o.id = $1 AND p.id = o.product_id
        `, [orderId]);

        await client.query(`
          UPDATE users u
          SET total_sales = total_sales + o.quantity,
              total_revenue = total_revenue + o.total_amount
          FROM orders o
          JOIN products p ON o.product_id = p.id
          WHERE o.id = $1 AND u.id = p.farmer_id
        `, [orderId]);
      }

      await client.query('COMMIT');

      // Broadcast real-time event for sync with new status (after commit)
      broadcastEvent('order.updated', {
        order_id: orderId,
        customer_id: orderInfo.rows[0].user_id,
        farmer_ids: orderData.farmer_id ? [Number(orderData.farmer_id)] : [],
        new_status: status,
        old_status: currentStatus
      });

      res.json({ message: 'Order status updated successfully' });
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
      }
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error updating order status' });
  }
});


// Cancel order (for customers)
router.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');

    // Check if order belongs to user and can be cancelled
    const { reason } = req.body;
    const orderResult = await pool.query(
      `SELECT o.status, o.product_id, p.name AS product_name
       FROM orders o
       JOIN products p ON p.id = o.product_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, decoded.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderStatus = orderResult.rows[0].status;
    // CRITICAL: Customer can ONLY cancel when status is 'pending' - after farmer confirms, cancellation is blocked
    if (orderStatus !== 'pending') {
      return res.status(400).json({ message: 'Order cannot be cancelled at this stage. Only pending orders can be cancelled by customers.' });
    }

    // Start transaction to restore stock
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update order status
      await client.query(
        `UPDATE orders
         SET status = $1,
             cancelled_at = CURRENT_TIMESTAMP,
             cancellation_reason = $2,
             cancelled_by = $3,
             refund_status = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        ['cancelled', reason || null, 'customer', 'none', id]
      );

      // Restore product stock (per-item order)
      await client.query(`
        UPDATE products
        SET stock_quantity = stock_quantity + o.quantity
        FROM orders o
        WHERE o.id = $1 AND products.id = o.product_id
      `, [id]);

      await client.query('COMMIT');

      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, order_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [decoded.id, 'order_update', 'Order cancelled', `Order #${id} (${orderResult.rows[0].product_name}) was cancelled.`, id]
      );

      res.json({ message: 'Order cancelled successfully' });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Server error cancelling order' });
  }
});

// Cancel order (for farmers)
router.put('/:id/cancel-farmer', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.id]);

    if (userResult.rows[0].role !== 'staff') {
      const farmerCheck = await pool.query(`
        SELECT p.farmer_id
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.id = $1
      `, [id]);

      if (farmerCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Defensive: DB/JWT ids can be string/number
      const isFarmer = Number(farmerCheck.rows[0].farmer_id) === Number(decoded.id);
      if (!isFarmer) {
        return res.status(403).json({ message: 'You can only cancel orders containing your products' });
      }
    }

    const orderInfo = await pool.query(
      `SELECT o.user_id, o.product_id, p.name AS product_name
       FROM orders o
       JOIN products p ON p.id = o.product_id
       WHERE o.id = $1`,
      [id]
    );
    if (orderInfo.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE orders
         SET status = $1,
             cancelled_at = CURRENT_TIMESTAMP,
             cancellation_reason = $2,
             cancelled_by = $3,
             refund_status = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        ['cancelled', reason || null, 'farmer', 'none', id]
      );

      // Restore product stock (per-item order)
      await client.query(`
        UPDATE products
        SET stock_quantity = stock_quantity + o.quantity
        FROM orders o
        WHERE o.id = $1 AND products.id = o.product_id
      `, [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, order_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderInfo.rows[0].user_id, 'order_update', 'Order cancelled by farmer', `Order #${id} (${orderInfo.rows[0].product_name}) was cancelled by the farmer.`, id]
    );

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Farmer cancel error:', error);
    res.status(500).json({ message: 'Server error cancelling order' });
  }
});

module.exports = router;