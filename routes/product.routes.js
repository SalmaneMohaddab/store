const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticate, restrictTo } = require('../middleware/auth.middleware');

/**
 * @route GET /api/products
 * @desc Get all products with filtering and pagination
 * @access Public
 */
router.get('/', productController.getAllProducts);

/**
 * @route GET /api/products/search/:query
 * @desc Search products by name
 * @access Public
 */
router.get('/search/:query', productController.searchProducts);

/**
 * @route GET /api/products/:id
 * @desc Get a single product by ID
 * @access Public
 */
router.get('/:id', productController.getProductById);

/**
 * @route POST /api/products
 * @desc Create a new product
 * @access Admin only
 */
router.post('/', authenticate, restrictTo('admin'), productController.createProduct);

/**
 * @route PUT /api/products/:id
 * @desc Update a product
 * @access Admin only
 */
router.put('/:id', authenticate, restrictTo('admin'), productController.updateProduct);

/**
 * @route DELETE /api/products/:id
 * @desc Delete a product
 * @access Admin only
 */
router.delete('/:id', authenticate, restrictTo('admin'), productController.deleteProduct);

module.exports = router; 