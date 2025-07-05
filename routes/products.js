const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // Get all products with optional pagination and category filter
  router.get('/', async (req, res, next) => {
    try {
      const { category_id, limit = 20, page = 1 } = req.query;
      const offset = (page - 1) * limit;
      
      let sql = 'SELECT * FROM products';
      let params = [];
      
      if (category_id) {
        sql += ' WHERE category_id = ?';
        params.push(category_id);
      }
      
      sql += ' ORDER BY product_id DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));
      
      const [products] = await pool.execute(sql, params);
      
      // Get total count for pagination
      let countSql = 'SELECT COUNT(*) as total FROM products';
      if (category_id) {
        countSql += ' WHERE category_id = ?';
      }
      
      const [countResult] = await pool.execute(
        countSql, 
        category_id ? [category_id] : []
      );
      
      const total = countResult[0].total;
      const totalPages = Math.ceil(total / limit);
      
      res.json({
        status: 'success',
        data: {
          products,
          pagination: {
            total,
            totalPages,
            currentPage: Number(page),
            limit: Number(limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // Get a single product by ID
  router.get('/:id', async (req, res, next) => {
    try {
      const [product] = await pool.execute(
        'SELECT * FROM products WHERE product_id = ?',
        [req.params.id]
      );
      
      if (product.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }
      
      res.json({
        status: 'success',
        data: product[0]
      });
    } catch (error) {
      next(error);
    }
  });

  // Search products by name
  router.get('/search/:query', async (req, res, next) => {
    try {
      const searchTerm = `%${req.params.query}%`;
      
      const [products] = await pool.execute(
        'SELECT * FROM products WHERE name LIKE ?',
        [searchTerm]
      );
      
      res.json({
        status: 'success',
        data: products
      });
    } catch (error) {
      next(error);
    }
  });

  // Create a new product (admin only)
  router.post('/', async (req, res, next) => {
    try {
      const { name, price, category_id, discount, rating, image_url } = req.body;
      
      if (!name || !price || !category_id) {
        return res.status(400).json({
          status: 'error',
          message: 'Name, price and category_id are required'
        });
      }
      
      const [result] = await pool.execute(
        'INSERT INTO products (name, price, category_id, discount, rating, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        [name, price, category_id, discount || 0, rating || 4.5, image_url || 'assets/images/product.png']
      );
      
      const [newProduct] = await pool.execute(
        'SELECT * FROM products WHERE product_id = ?',
        [result.insertId]
      );
      
      res.status(201).json({
        status: 'success',
        data: newProduct[0]
      });
    } catch (error) {
      next(error);
    }
  });

  // Update a product (admin only)
  router.put('/:id', async (req, res, next) => {
    try {
      const { name, price, category_id, discount, rating, image_url } = req.body;
      const productId = req.params.id;
      
      // Check if product exists
      const [product] = await pool.execute(
        'SELECT * FROM products WHERE product_id = ?',
        [productId]
      );
      
      if (product.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }
      
      await pool.execute(
        `UPDATE products 
         SET name = ?, price = ?, category_id = ?, discount = ?, rating = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = ?`,
        [
          name || product[0].name,
          price || product[0].price,
          category_id || product[0].category_id,
          discount !== undefined ? discount : product[0].discount,
          rating || product[0].rating,
          image_url || product[0].image_url,
          productId
        ]
      );
      
      const [updatedProduct] = await pool.execute(
        'SELECT * FROM products WHERE product_id = ?',
        [productId]
      );
      
      res.json({
        status: 'success',
        data: updatedProduct[0]
      });
    } catch (error) {
      next(error);
    }
  });

  // Delete a product (admin only)
  router.delete('/:id', async (req, res, next) => {
    try {
      const productId = req.params.id;
      
      // Check if product exists
      const [product] = await pool.execute(
        'SELECT * FROM products WHERE product_id = ?',
        [productId]
      );
      
      if (product.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }
      
      await pool.execute(
        'DELETE FROM products WHERE product_id = ?',
        [productId]
      );
      
      res.json({
        status: 'success',
        message: 'Product deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};