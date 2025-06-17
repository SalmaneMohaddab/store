const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/auth.middleware');
const Category = require('../models/CategoryModel');

/**
 * @route GET /api/categories
 * @desc Get all categories
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    // Get categories from the database
    const categories = await Category.findAll();
    
    // Log API response to the backend console
    console.log('=============================================');
    console.log('API RESPONSE - GET /api/categories');
    console.log('Total Categories:', categories.length);
    console.log('Categories:', JSON.stringify(categories, null, 2));
    console.log('=============================================');
    
    // Return the response
    res.json({
      status: 'success',
      data: {
        categories
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching categories'
    });
  }
});

/**
 * @route GET /api/categories/:id
 * @desc Get a single category
 * @access Public
 */
router.get('/:id', (req, res) => {
  // This would typically call a controller method
  // For now, return a placeholder response
  res.json({
    status: 'success',
    data: {
      category: {}
    }
  });
});

/**
 * @route GET /api/categories/:id/products
 * @desc Get products in a category
 * @access Public
 */
router.get('/:id/products', (req, res) => {
  // This would typically call a controller method
  // For now, return a placeholder response
  res.json({
    status: 'success',
    data: {
      products: []
    }
  });
});

/**
 * @route POST /api/categories
 * @desc Create a new category
 * @access Admin only
 */
router.post('/', authenticate, restrictTo('admin'), (req, res) => {
  // This would typically call a controller method
  // For now, return a placeholder response
  res.status(201).json({
    status: 'success',
    data: {
      category: {}
    }
  });
});

/**
 * @route PUT /api/categories/:id
 * @desc Update a category
 * @access Admin only
 */
router.put('/:id', authenticate, restrictTo('admin'), (req, res) => {
  // This would typically call a controller method
  // For now, return a placeholder response
  res.json({
    status: 'success',
    data: {
      category: {}
    }
  });
});

/**
 * @route DELETE /api/categories/:id
 * @desc Delete a category
 * @access Admin only
 */
router.delete('/:id', authenticate, restrictTo('admin'), (req, res) => {
  // This would typically call a controller method
  // For now, return a placeholder response
  res.json({
    status: 'success',
    message: 'Category deleted successfully'
  });
});

module.exports = router; 