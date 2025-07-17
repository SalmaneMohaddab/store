const { query } = require('../config/database');

/**
 * Product Model - Handles product data operations and business logic
 */
class Product {
  /**
   * Find all products with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Products and pagination data
   */
  static async findAll(options = {}) {
    const { 
      category_id, 
      search,
      min_price, 
      max_price,
      sort = 'product_id', 
      order = 'DESC',
      limit = 20, 
      page = 1 
    } = options;
    
    console.log('========= PRODUCTS DEBUG =========');
    console.log('ProductModel.findAll() called with options:', JSON.stringify(options, null, 2));
    
    try {
      // Test database connection first
      const testConnection = await query('SELECT 1 as test');
      console.log('Database connection test:', testConnection);
      
      // Direct count of products in database
      const countCheck = await query('SELECT COUNT(*) as count FROM products');
      console.log('Total products in database:', countCheck[0].count);
      
      const offset = (page - 1) * limit;
      const params = [];
      
      // Build WHERE clause
      let whereClause = '';
      let whereConditions = [];
      
      if (category_id) {
        whereConditions.push('category_id = ?');
        params.push(category_id);
      }
      
      if (search) {
        whereConditions.push('name LIKE ?');
        params.push(`%${search}%`);
      }
      
      if (min_price) {
        whereConditions.push('price >= ?');
        params.push(min_price);
      }
      
      if (max_price) {
        whereConditions.push('price <= ?');
        params.push(max_price);
      }
      
      // Always exclude products with stock_quantity = 0
      whereConditions.push('stock_quantity > 0');
      
      if (whereConditions.length > 0) {
        whereClause = 'WHERE ' + whereConditions.join(' AND ');
      }
      
      // Validate sort and order parameters
      const allowedSortFields = ['product_id', 'name', 'price', 'rating', 'created_at'];
      const sortField = allowedSortFields.includes(sort) ? sort : 'product_id';
      
      const orderDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      // Instead of using prepared statements for LIMIT/OFFSET, use direct string interpolation
      // This is safe for pagination as these are not user-supplied values
      const limitVal = parseInt(limit, 10);
      const offsetVal = parseInt(offset, 10);
      
      // Build query without parameters for LIMIT/OFFSET
      const query1 = `
        SELECT * FROM products
        ${whereClause}
        ORDER BY ${sortField} ${orderDirection}
        LIMIT ${limitVal} OFFSET ${offsetVal}
      `;
      
      console.log('Direct SQL Query:', query1);
      console.log('Query Parameters:', params);
      
      // Execute the query directly without prepared statements for LIMIT/OFFSET
      const products = await query(query1, params);
      console.log('Raw query result type:', typeof products);
      console.log('Raw query result length:', products.length);
      if (products.length > 0) {
        console.log('First product sample:', JSON.stringify(products[0], null, 2));
      } else {
        console.log('No products found in query result');
      }
      
      // Get total count for pagination - also use direct query
      const countQuery = `
        SELECT COUNT(*) as total FROM products
        ${whereClause}
      `;
      
      const countResult = await query(countQuery, params);
      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);
      
      const result = {
        products,
        pagination: {
          total,
          totalPages,
          currentPage: Number(page),
          limit: Number(limit)
        }
      };
      
      console.log(`ProductModel.findAll() returning ${products.length} products out of ${total} total`);
      console.log('========= END PRODUCTS DEBUG =========');
      
      return result;
    } catch (error) {
      console.error('ERROR in ProductModel.findAll():', error);
      // Return empty result on error
      return {
        products: [],
        pagination: {
          total: 0,
          totalPages: 0,
          currentPage: Number(page),
          limit: Number(limit)
        }
      };
    }
  }

  /**
   * Find product by ID
   * @param {number} id - Product ID
   * @returns {Promise<Object|null>} - Product or null
   */
  static async findById(id) {
    const products = await query(
      'SELECT * FROM products WHERE product_id = ? AND stock_quantity > 0',
      [id]
    );
    return products.length > 0 ? products[0] : null;
  }
  
  /**
   * Find products by category
   * @param {number} categoryId - Category ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Products and pagination data
   */
  static async findByCategory(categoryId, options = {}) {
    return this.findAll({
      ...options,
      category_id: categoryId
    });
  }
  
  /**
   * Search products by name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Products array
   */
  static async search(searchTerm) {
    const products = await query(
      'SELECT * FROM products WHERE name LIKE ? AND stock_quantity > 0',
      [`%${searchTerm}%`]
    );
    
    return products;
  }
  
  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @returns {Promise<Object>} - New product
   */
  static async create(productData) {
    const { 
      name, 
      price, 
      category_id, 
      discount = 0, 
      rating = 4.5, 
      image_url = 'assets/images/product.png',
      stock_quantity = 100,
      sku,
      description
    } = productData;
    
    // Validation
    if (!name || !price || !category_id) {
      throw new Error('Name, price and category_id are required');
    }
    
    // Check if category exists
    const categories = await query(
      'SELECT * FROM categories WHERE id = ?',
      [category_id]
    );
    
    if (categories.length === 0) {
      throw new Error('Category not found');
    }
    
    // Check if SKU already exists
    if (sku) {
      const existingSku = await query(
        'SELECT * FROM products WHERE sku = ?',
        [sku]
      );
      
      if (existingSku.length > 0) {
        throw new Error('Product with this SKU already exists');
      }
    }
    
    // Insert product
    const result = await query(
      `INSERT INTO products 
       (name, price, category_id, discount, rating, image_url, stock_quantity, sku, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        price, 
        category_id, 
        discount, 
        rating, 
        image_url,
        stock_quantity,
        sku || null,
        description || null
      ]
    );
    
    return this.findById(result.insertId);
  }
  
  /**
   * Update a product
   * @param {number} id - Product ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated product
   */
  static async update(id, updateData) {
    // Check if product exists
    const product = await this.findById(id);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    const { 
      name, 
      price, 
      category_id, 
      discount, 
      rating, 
      image_url,
      stock_quantity,
      sku,
      description 
    } = updateData;
    
    // If changing category, check if it exists
    if (category_id && category_id !== product.category_id) {
      const categories = await query(
        'SELECT * FROM categories WHERE id = ?',
        [category_id]
      );
      
      if (categories.length === 0) {
        throw new Error('Category not found');
      }
    }
    
    // If changing SKU, check if it's unique
    if (sku && sku !== product.sku) {
      const existingSku = await query(
        'SELECT * FROM products WHERE sku = ? AND product_id != ?',
        [sku, id]
      );
      
      if (existingSku.length > 0) {
        throw new Error('Product with this SKU already exists');
      }
    }
    
    // Update product
    await query(
      `UPDATE products 
       SET name = ?, price = ?, category_id = ?, discount = ?, 
           rating = ?, image_url = ?, stock_quantity = ?, sku = ?, 
           description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE product_id = ?`,
      [
        name || product.name,
        price || product.price,
        category_id || product.category_id,
        discount !== undefined ? discount : product.discount,
        rating || product.rating,
        image_url || product.image_url,
        stock_quantity !== undefined ? stock_quantity : product.stock_quantity,
        sku || product.sku,
        description || product.description,
        id
      ]
    );
    
    return this.findById(id);
  }
  
  /**
   * Delete a product
   * @param {number} id - Product ID
   * @returns {Promise<boolean>} - Success
   */
  static async delete(id) {
    // Check if product exists
    const product = await this.findById(id);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Check if product is in any cart
    const cartItems = await query(
      'SELECT * FROM cart_items WHERE product_id = ?',
      [id]
    );
    
    if (cartItems.length > 0) {
      // Delete from carts first
      await query(
        'DELETE FROM cart_items WHERE product_id = ?',
        [id]
      );
    }
    
    // Delete product
    await query(
      'DELETE FROM products WHERE product_id = ?',
      [id]
    );
    
    return true;
  }
  
  /**
   * Check product stock
   * @param {number} id - Product ID
   * @param {number} quantity - Requested quantity
   * @returns {Promise<boolean>} - Has sufficient stock
   */
  static async hasStock(id, quantity) {
    const product = await this.findById(id);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product.stock_quantity >= quantity;
  }
  
  /**
   * Update product stock
   * @param {number} id - Product ID
   * @param {number} quantity - Quantity to add (negative for reduction)
   * @returns {Promise<Object>} - Updated product
   */
  static async updateStock(id, quantity) {
    const product = await this.findById(id);
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    const newStock = product.stock_quantity + quantity;
    
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }
    
    await query(
      'UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?',
      [newStock, id]
    );
    
    return this.findById(id);
  }
}

module.exports = Product;