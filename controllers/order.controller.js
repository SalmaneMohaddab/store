const database = require('../config/database');
const AppError = require('../utils/appError');

// Get all orders for a user
exports.getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    console.log('[getUserOrders] userId:', userId);
    
    const orders = await database.query(`
      SELECT o.*, 
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'product_price', oi.product_price,
            'quantity', oi.quantity,
            'discount_amount', COALESCE(oi.discount_amount, 0),
            'image_url', COALESCE(oi.image_url, '')
          )
        ) as order_items
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.user_id = ?
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
    `, [userId]);

    console.log('[getUserOrders] orders result:', orders);

    // Make sure orders is an array
    const ordersList = Array.isArray(orders) ? orders : orders[0] || [];

    // Parse the items if needed (should already be parsed by MySQL)
    ordersList.forEach(order => {
      if (order.order_items === null) {
        order.order_items = [];
      }
      // For compatibility with frontend
      order.items = order.order_items;
    });

    res.json({
      status: 'success',
      data: {
        orders: ordersList
      }
    });
  } catch (error) {
    console.error('Error in getUserOrders:', error);
    next(new AppError('Error fetching orders', 500));
  }
};

// Get order details
exports.getOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    console.log(`Fetching order details for order ID: ${id}, user ID: ${userId}`);
    
    // First, check if the order exists and belongs to the user
    const [orderCheck] = await database.query(`
      SELECT * FROM orders WHERE order_id = ? AND user_id = ?
    `, [id, userId]);

    if (!orderCheck || orderCheck.length === 0) {
      return next(new AppError('Order not found', 404));
    }

    console.log('Order found:', orderCheck[0]);

    // Then get the order with its items
    const [orderResult] = await database.query(`
      SELECT 
        o.*,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'product_price', oi.product_price,
            'quantity', oi.quantity,
            'discount_amount', COALESCE(oi.discount_amount, 0),
            'image_url', COALESCE(oi.image_url, '')
          )
        ) as order_items
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.order_id = ? AND o.user_id = ?
      GROUP BY o.order_id
    `, [id, userId]);

    console.log('Query result:', orderResult);

    if (!orderResult) {
      return next(new AppError('Order not found', 404));
    }

    // Create a new object with the order data
    const order = {
      order_id: orderResult.order_id,
      user_id: orderResult.user_id,
      address: orderResult.address,
      phone_number: orderResult.phone_number,
      total_amount: orderResult.total_amount,
      status: orderResult.status,
      created_at: orderResult.created_at,
      updated_at: orderResult.updated_at,
      tracking_number: orderResult.tracking_number,
      notes: orderResult.notes,
      order_items: orderResult.order_items // MySQL will return this already parsed
    };

    console.log('Final order object:', order);

    res.json({
      status: 'success',
      data: order
    });
  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    console.error('Stack trace:', error.stack);
    next(new AppError('Error fetching order details', 500));
  }
};

// Create new order
exports.createOrder = async (req, res, next) => {
  let connection;
  
  try {
    connection = await database.beginTransaction();
    
    const { items, totalAmount, address, phoneNumber } = req.body;
    const userId = req.user.user_id;
    
    // Create order
    const [orderResult] = await connection.execute(`
      INSERT INTO orders (user_id, address, phone_number, total_amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `, [userId, address, phoneNumber, totalAmount]);
    
    const orderId = orderResult.insertId;
    
    // Create order items
    for (const item of items) {
      await connection.execute(`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_price, 
          quantity, discount_amount, image_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        item.productId,
        item.productName,
        item.price,
        item.quantity,
        item.discountAmount || 0,
        item.imageUrl
      ]);
    }
    
    // Clear user's cart
    await connection.execute(`
      DELETE FROM cart_items WHERE user_id = ?
    `, [userId]);
    
    await database.commitTransaction(connection);
    
    // Get the created order with items
    const orders = await database.query(`
      SELECT o.*, 
        COUNT(oi.id) as items_count,
        GROUP_CONCAT(
          JSON_OBJECT(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'product_price', oi.product_price,
            'quantity', oi.quantity,
            'discount_amount', oi.discount_amount,
            'image_url', oi.image_url
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.order_id = ?
      GROUP BY o.order_id
    `, [orderId]);
    
    const order = orders[0];
    if (order) {
      try {
    order.items = order.items ? JSON.parse(`[${order.items}]`) : [];
      } catch (parseError) {
        console.error('Error parsing order items:', parseError);
        order.items = [];
      }
    }
    
    res.status(201).json({
      status: 'success',
      data: {
        order
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    if (connection) {
      await database.rollbackTransaction(connection);
    }
    next(new AppError('Error creating order', 500));
  }
};

// Update order status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return next(new AppError('Invalid order status', 400));
    }
    
    const [result] = await database.query(`
      UPDATE orders 
      SET status = ?
      WHERE order_id = ?
    `, [status, id]);
    
    if (result.affectedRows === 0) {
      return next(new AppError('Order not found', 404));
    }
    
    res.json({
      status: 'success',
      message: 'Order status updated successfully'
    });
  } catch (error) {
    next(new AppError('Error updating order status', 500));
  }
};

// Cancel order
exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Check if order exists and belongs to user
    const [orders] = await database.query(`
      SELECT status FROM orders 
      WHERE order_id = ? AND user_id = ?
    `, [id, userId]);
    
    if (orders.length === 0) {
      return next(new AppError('Order not found', 404));
    }
    
    const order = orders[0];
    if (order.status !== 'pending' && order.status !== 'processing') {
      return next(new AppError('Cannot cancel order in current status', 400));
    }
    
    // Update order status to cancelled
    await database.query(`
      UPDATE orders 
      SET status = 'cancelled'
      WHERE order_id = ?
    `, [id]);
    
    res.json({
      status: 'success',
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    next(new AppError('Error cancelling order', 500));
  }
};