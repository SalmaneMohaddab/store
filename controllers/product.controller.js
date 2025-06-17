const Product = require('../models/ProductModel');
const database = require('../config/database');
const AppError = require('../utils/appError');

/**
 * Get all products with filtering and pagination
 * @route GET /api/products
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    console.log('GET /api/products endpoint called');
    
    const { 
      category_id, 
      search,
      min_price, 
      max_price,
      sort, 
      order,
      limit, 
      page
    } = req.query;
    
    console.log('Request query parameters:', req.query);
    
    // Check database connection first
    try {
      const result = await Product.findAll({
        category_id,
        search,
        min_price,
        max_price,
        sort,
        order,
        limit: limit ? Number(limit) : undefined,
        page: page ? Number(page) : undefined
      });
      
      // Log API response to the backend console
      console.log('=============================================');
      console.log('API RESPONSE - GET /api/products');
      console.log('Query Parameters:', req.query);
      console.log('Results:', JSON.stringify(result, null, 2));
      console.log('Total Products:', result.products ? result.products.length : 'N/A');
      console.log('=============================================');
      
      res.json({
        status: 'success',
        data: result
      });
    } catch (dbError) {
      console.error('Database operation failed:', dbError.message);
      
      // Check if it's a connection issue
      if (dbError.code === 'ER_WRONG_ARGUMENTS') {
        // Try a manual query without prepared statements as a fallback
        try {
          console.log('Trying fallback query...');
          const limit = Number(req.query.limit) || 20;
          const page = Number(req.query.page) || 1;
          const offset = (page - 1) * limit;
          
          const { query } = require('../config/database');
          const products = await query(`SELECT * FROM products ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`);
          const countResult = await query('SELECT COUNT(*) as total FROM products');
          const total = countResult[0].total;
          
          const result = {
            products,
            pagination: {
              total,
              totalPages: Math.ceil(total / limit),
              currentPage: page,
              limit
            }
          };
          
          res.json({
            status: 'success',
            data: result
          });
          return;
        } catch (fallbackError) {
          console.error('Fallback query failed:', fallbackError.message);
        }
      }
      
      // If we get here, all attempts failed
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve products due to a database error',
        error: dbError.message
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single product by ID
 * @route GET /api/products/:id
 */
exports.getProductById = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
    
    res.json({
      status: 'success',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new product
 * @route POST /api/products
 * @access Admin only
 */
exports.createProduct = async (req, res, next) => {
  try {
    const productData = req.body;
    
    try {
      const newProduct = await Product.create(productData);
      
      res.status(201).json({
        status: 'success',
        data: newProduct
      });
    } catch (err) {
      // Convert model errors to AppError
      return next(new AppError(err.message, 400));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update a product
 * @route PUT /api/products/:id
 * @access Admin only
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const updateData = req.body;
    
    try {
      const updatedProduct = await Product.update(productId, updateData);
      
      res.json({
        status: 'success',
        data: updatedProduct
      });
    } catch (err) {
      // Handle different error types
      if (err.message === 'Product not found') {
        return next(new AppError(err.message, 404));
      }
      return next(new AppError(err.message, 400));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a product
 * @route DELETE /api/products/:id
 * @access Admin only
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    
    try {
      await Product.delete(productId);
      
      res.json({
        status: 'success',
        message: 'Product deleted successfully'
      });
    } catch (err) {
      if (err.message === 'Product not found') {
        return next(new AppError(err.message, 404));
      }
      return next(new AppError(err.message, 400));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Search products by name
 * @route GET /api/products/search/:query
 */
exports.searchProducts = async (req, res, next) => {
  try {
    const searchTerm = req.params.query;
    const products = await Product.search(searchTerm);
    
    res.json({
      status: 'success',
      data: products
    });
  } catch (error) {
    next(error);
  }
}; 