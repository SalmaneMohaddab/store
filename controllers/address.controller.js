const database = require('../config/database');
const AppError = require('../utils/appError');

// Get all addresses for a user
exports.getUserAddresses = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    
    const addresses = await database.query(`
      SELECT * FROM user_addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, created_at DESC
    `, [userId]);
    
    res.json({
      status: 'success',
      data: {
        addresses
      }
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    next(new AppError('Error fetching addresses', 500));
  }
};

// Get a single address by ID
exports.getAddressById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    const addresses = await database.query(`
      SELECT * FROM user_addresses 
      WHERE address_id = ? AND user_id = ?
    `, [id, userId]);
    
    if (addresses.length === 0) {
      return next(new AppError('Address not found', 404));
    }
    
    res.json({
      status: 'success',
      data: {
        address: addresses[0]
      }
    });
  } catch (error) {
    console.error('Error fetching address:', error);
    next(new AppError('Error fetching address', 500));
  }
};

// Create a new address
exports.createAddress = async (req, res, next) => {
  const connection = await database.beginTransaction();
  
  try {
    const userId = req.user.user_id;
    const { 
      title, 
      street, 
      city, 
      additional_details, 
      is_default,
      latitude,
      longitude,
      place_link
    } = req.body;
    
    // Validate required fields
    if (!street || !city) {
      return next(new AppError('Street and city are required', 400));
    }
    
    // If setting as default, update all other addresses to not be default
    if (is_default) {
      await connection.query(`
        UPDATE user_addresses 
        SET is_default = FALSE 
        WHERE user_id = ?
      `, [userId]);
    }
    
    // Insert the new address
    const [result] = await connection.query(`
      INSERT INTO user_addresses (
        user_id, title, street, city, 
        additional_details, is_default,
        latitude, longitude, place_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, 
      title || 'موقع العمل', // Default title is "Home" in Arabic
      street,
      city,
      additional_details || null,
      is_default || false,
      latitude || null,
      longitude || null,
      place_link || null
    ]);
    
    await database.commitTransaction(connection);
    
    // Get the created address
    const [address] = await database.query(`
      SELECT * FROM user_addresses 
      WHERE address_id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      status: 'success',
      data: {
        address: address[0]
      }
    });
  } catch (error) {
    await database.rollbackTransaction(connection);
    console.error('Error creating address:', error);
    next(new AppError('Error creating address', 500));
  }
};

// Update an address
exports.updateAddress = async (req, res, next) => {
  const connection = await database.beginTransaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const { 
      title, 
      street, 
      city, 
      additional_details, 
      is_default,
      latitude,
      longitude,
      place_link
    } = req.body;
    
    // Check if address exists and belongs to user
    const addresses = await connection.query(`
      SELECT * FROM user_addresses 
      WHERE address_id = ? AND user_id = ?
    `, [id, userId]);
    
    if (addresses.length === 0) {
      await database.rollbackTransaction(connection);
      return next(new AppError('Address not found', 404));
    }
    
    // If setting as default, update all other addresses to not be default
    if (is_default) {
      await connection.query(`
        UPDATE user_addresses 
        SET is_default = FALSE 
        WHERE user_id = ? AND address_id != ?
      `, [userId, id]);
    }
    
    // Update the address
    await connection.query(`
      UPDATE user_addresses 
      SET 
        title = ?,
        street = ?,
        city = ?,
        additional_details = ?,
        is_default = ?,
        latitude = ?,
        longitude = ?,
        place_link = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE address_id = ? AND user_id = ?
    `, [
      title || 'موقع العمل',
      street,
      city,
      additional_details,
      is_default || false,
      latitude || null,
      longitude || null,
      place_link || null,
      id,
      userId
    ]);
    
    await database.commitTransaction(connection);
    
    // Get the updated address
    const [updatedAddress] = await database.query(`
      SELECT * FROM user_addresses 
      WHERE address_id = ?
    `, [id]);
    
    res.json({
      status: 'success',
      data: {
        address: updatedAddress[0]
      }
    });
  } catch (error) {
    await database.rollbackTransaction(connection);
    console.error('Error updating address:', error);
    next(new AppError('Error updating address', 500));
  }
};

// Delete an address
exports.deleteAddress = async (req, res, next) => {
  const connection = await database.beginTransaction();
  
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Check if address exists and belongs to user
    const addresses = await connection.query(`
      SELECT * FROM user_addresses 
      WHERE address_id = ? AND user_id = ?
    `, [id, userId]);
    
    if (addresses.length === 0) {
      await database.rollbackTransaction(connection);
      return next(new AppError('Address not found', 404));
    }
    
    const wasDefault = addresses[0].is_default;
    
    // Delete the address
    await connection.query(`
      DELETE FROM user_addresses 
      WHERE address_id = ? AND user_id = ?
    `, [id, userId]);
    
    // If the deleted address was the default, set another address as default if available
    if (wasDefault) {
      const remainingAddresses = await connection.query(`
        SELECT * FROM user_addresses 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [userId]);
      
      if (remainingAddresses.length > 0) {
        await connection.query(`
          UPDATE user_addresses 
          SET is_default = TRUE 
          WHERE address_id = ?
        `, [remainingAddresses[0].address_id]);
      }
    }
    
    await database.commitTransaction(connection);
    
    res.json({
      status: 'success',
      message: 'Address deleted successfully'
    });
  } catch (error) {
    await database.rollbackTransaction(connection);
    console.error('Error deleting address:', error);
    next(new AppError('Error deleting address', 500));
  }
};