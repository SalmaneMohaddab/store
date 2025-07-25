const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { query } = require('../config/database');
const AppError = require('../utils/appError');
const dotenv = require('dotenv');
dotenv.config();

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authentication middleware to protect routes
 * Verifies the JWT token and adds user info to the request
 */
exports.authenticate = async (req, res, next) => {
  try {
    // 1) Check if token exists
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.error('[AUTH] No token found in request headers');
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // 2) Verify token
    let decoded;
    try {
      decoded = await promisify(jwt.verify)(token, JWT_SECRET);
      console.log('[AUTH] Decoded JWT:', decoded);
    } catch (jwtErr) {
      console.error('[AUTH] JWT verification failed:', jwtErr);
      throw jwtErr;
    }

    // 3) Check if user still exists
    const user = await query('SELECT user_id, email, full_name, role, account_status FROM users WHERE user_id = ?', [decoded.userId]);
    console.log('[AUTH] User lookup result:', user);
    
    if (!user || user.length === 0) {
      console.error('[AUTH] No user found for user_id:', decoded.userId);
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Check if user is active
    if (user[0].account_status !== 'active') {
      console.error('[AUTH] User account is not active:', user[0]);
      return next(new AppError('Your account has been suspended or deactivated. Please contact support.', 401));
    }

    // 5) Grant access to protected route
    req.user = user[0];
    next();
  } catch (error) {
    console.error('[AUTH] Error in authenticate middleware:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    return next(error);
  }
};

/**
 * Authorization middleware to restrict access to specific roles
 * @param  {...string} roles - Roles that have access
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // If role is not included in the roles array, return error
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

/**
 * Check if a user is the owner of a resource or an admin
 * @param {string} resourceType - Type of resource (order, address, etc.)
 * @param {string} paramName - Request parameter containing the resource ID
 */
exports.isOwnerOrAdmin = (resourceType, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const userId = req.user.user_id;
      const isAdmin = req.user.role === 'admin';
      console.log(`[AUTH] isOwnerOrAdmin: resourceType=${resourceType}, resourceId=${resourceId}, userId=${userId}, isAdmin=${isAdmin}`);
      // Admins can access any resource
      if (isAdmin) {
        return next();
      }
      // Determine the appropriate table and column based on resource type
      let table, column;
      switch (resourceType) {
        case 'order':
          table = 'orders';
          column = 'order_id';
          break;
        case 'address':
          table = 'user_addresses';
          column = 'address_id'; // changed from 'id' to 'address_id'
          break;
        case 'cart':
          table = 'cart_items';
          column = 'cart_item_id'; // changed from 'id' to 'cart_item_id'
          break;
        default:
          return next(new AppError('Invalid resource type specified', 500));
      }
      // Check if the user owns the resource
      const resource = await query(
        `SELECT * FROM ${table} WHERE ${column} = ? AND user_id = ?`, 
        [resourceId, userId]
      );
      console.log(`[AUTH] Resource ownership check result:`, resource);
      if (!resource || resource.length === 0) {
        console.error('[AUTH] User does not own resource or resource not found');
        return next(new AppError('You do not have permission to access this resource', 403));
      }
      next();
    } catch (error) {
      console.error('[AUTH] Error in isOwnerOrAdmin middleware:', error);
      next(error);
    }
  };
};