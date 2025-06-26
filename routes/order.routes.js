const express = require('express');
const router = express.Router();
const { authenticate, restrictTo, isOwnerOrAdmin } = require('../middleware/auth.middleware');
const orderController = require('../controllers/order.controller');

/**
 * @route GET /api/orders
 * @desc Get user's orders
 * @access Private
 */
router.get('/', authenticate, orderController.getUserOrders);

/**
 * @route GET /api/orders/:id
 * @desc Get order details
 * @access Private
 */
router.get('/:id', authenticate, isOwnerOrAdmin('order'), orderController.getOrderDetails);

/**
 * @route POST /api/orders
 * @desc Create new order
 * @access Private
 */
router.post('/', authenticate, orderController.createOrder);

/**
 * @route PUT /api/orders/:id/status
 * @desc Update order status
 * @access Admin only
 */
router.put('/:id/status', authenticate, restrictTo('admin'), orderController.updateOrderStatus);

/**
 * @route PUT /api/orders/:id/cancel
 * @desc Cancel order
 * @access Private
 */
router.put('/:id/cancel', authenticate, isOwnerOrAdmin('order'), orderController.cancelOrder);

module.exports = router;