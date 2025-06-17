const { query } = require('../config/database');

/**
 * Category Model - Handles category data operations and business logic
 */
class Category {
  /**
   * Find all categories
   * @returns {Promise<Array>} - Categories array
   */
  static async findAll() {
    console.log('CategoryModel.findAll() called');
    const categories = await query('SELECT * FROM categories ORDER BY id');
    console.log(`CategoryModel.findAll() found ${categories.length} categories`);
    return categories;
  }

  /**
   * Find category by ID
   * @param {number} id - Category ID
   * @returns {Promise<Object|null>} - Category or null
   */
  static async findById(id) {
    const categories = await query(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    
    return categories.length > 0 ? categories[0] : null;
  }
  
  /**
   * Create a new category
   * @param {Object} categoryData - Category data
   * @returns {Promise<Object>} - New category
   */
  static async create(categoryData) {
    const { name, name_en, icon } = categoryData;
    
    // Validation
    if (!name || !name_en || !icon) {
      throw new Error('Name, name_en and icon are required');
    }
    
    // Check if category with the same name exists
    const existingCategories = await query(
      'SELECT * FROM categories WHERE name = ? OR name_en = ?',
      [name, name_en]
    );
    
    if (existingCategories.length > 0) {
      throw new Error('Category with this name already exists');
    }
    
    // Insert category
    const result = await query(
      'INSERT INTO categories (name, name_en, icon) VALUES (?, ?, ?)',
      [name, name_en, icon]
    );
    
    return this.findById(result.insertId);
  }
  
  /**
   * Update a category
   * @param {number} id - Category ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated category
   */
  static async update(id, updateData) {
    // Check if category exists
    const category = await this.findById(id);
    
    if (!category) {
      throw new Error('Category not found');
    }
    
    const { name, name_en, icon } = updateData;
    
    // If changing name, check if it's unique
    if ((name && name !== category.name) || (name_en && name_en !== category.name_en)) {
      const existingCategories = await query(
        'SELECT * FROM categories WHERE (name = ? OR name_en = ?) AND id != ?',
        [name || category.name, name_en || category.name_en, id]
      );
      
      if (existingCategories.length > 0) {
        throw new Error('Category with this name already exists');
      }
    }
    
    // Update category
    await query(
      'UPDATE categories SET name = ?, name_en = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        name || category.name,
        name_en || category.name_en,
        icon || category.icon,
        id
      ]
    );
    
    return this.findById(id);
  }
  
  /**
   * Delete a category
   * @param {number} id - Category ID
   * @returns {Promise<boolean>} - Success
   */
  static async delete(id) {
    // Check if category exists
    const category = await this.findById(id);
    
    if (!category) {
      throw new Error('Category not found');
    }
    
    // Check if there are products in this category
    const products = await query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [id]
    );
    
    if (products[0].count > 0) {
      throw new Error('Cannot delete category that contains products');
    }
    
    // Delete category
    await query(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );
    
    return true;
  }
  
  /**
   * Get products by category
   * @param {number} id - Category ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Products and pagination data
   */
  static async getProducts(id, options = {}) {
    const { limit = 20, page = 1 } = options;
    const offset = (page - 1) * limit;
    
    // Check if category exists
    const category = await this.findById(id);
    
    if (!category) {
      throw new Error('Category not found');
    }
    
    // Get products with pagination
    const products = await query(
      `SELECT * FROM products 
       WHERE category_id = ? 
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [id, Number(limit), Number(offset)]
    );
    
    // Get total count for pagination
    const countResult = await query(
      'SELECT COUNT(*) as total FROM products WHERE category_id = ?',
      [id]
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    return {
      category,
      products,
      pagination: {
        total,
        totalPages,
        currentPage: Number(page),
        limit: Number(limit)
      }
    };
  }
}

module.exports = Category; 