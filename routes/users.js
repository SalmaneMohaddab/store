const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = (pool) => {
  // Register a new user
  router.post('/register', async (req, res, next) => {
    try {
      const { full_name, email, phone_number, password } = req.body;
      
      // Validate required fields
      if (!full_name || !email || !phone_number || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'All fields are required'
        });
      }
      
      // Check if user already exists
      const [existingUsers] = await pool.execute(
        'SELECT * FROM users WHERE email = ? OR phone_number = ?',
        [email, phone_number]
      );
      
      if (existingUsers.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'User with this email or phone number already exists'
        });
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Insert user
      const [result] = await pool.execute(
        'INSERT INTO users (full_name, email, phone_number, password) VALUES (?, ?, ?, ?)',
        [full_name, email, phone_number, hashedPassword]
      );
      
      // Create JWT token
      const token = jwt.sign(
        { 
          userId: result.insertId,
          email: email,
          fullName: full_name 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      
      res.status(201).json({
        status: 'success',
        data: {
          userId: result.insertId,
          fullName: full_name,
          email: email,
          phoneNumber: phone_number,
        },
        token
      });
    } catch (error) {
      next(error);
    }
  });

  // Login user
  router.post('/login', async (req, res, next) => {
    try {
      const { phone_number, password } = req.body;
      
      if (!phone_number || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Phone number and password are required'
        });
      }
      
      // Find user by phone number
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE phone_number = ?',
        [phone_number]
      );
      
      if (users.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }
      
      const user = users[0];
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials'
        });
      }
      
      // Create JWT token
      const token = jwt.sign(
        { 
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );
      
      res.json({
        status: 'success',
        data: {
          userId: user.user_id,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
        },
        token
      });
    } catch (error) {
      next(error);
    }
  });

  // Get current user profile
  router.get('/profile', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const [users] = await pool.execute(
        'SELECT user_id, uid, full_name, email, phone_number, created_at, updated_at FROM users WHERE user_id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }
      
      // Format response data for frontend compatibility
      const userData = {
        user_id: users[0].user_id,
        uid: users[0].uid,
        fullName: users[0].full_name,
        email: users[0].email,
        phoneNumber: users[0].phone_number,
        createdAt: users[0].created_at,
        updatedAt: users[0].updated_at
      };
      
      res.json({
        status: 'success',
        data: userData
      });
    } catch (error) {
      next(error);
    }
  });

  // Update user profile
  router.put('/profile', authenticate, async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { full_name, email } = req.body;
      
      // Check if user exists
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE user_id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }
      
      // Update user
      await pool.execute(
        'UPDATE users SET full_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [
          full_name || users[0].full_name,
          email || users[0].email,
          userId
        ]
      );
      
      // Get updated user
      const [updatedUsers] = await pool.execute(
        'SELECT user_id, uid, full_name, email, phone_number, created_at, updated_at FROM users WHERE user_id = ?',
        [userId]
      );
      // Format response data for frontend compatibility
      const userData = {
        user_id: updatedUsers[0].user_id,
        uid: updatedUsers[0].uid,
        fullName: updatedUsers[0].full_name,
        email: updatedUsers[0].email,
        phoneNumber: updatedUsers[0].phone_number,
        createdAt: updatedUsers[0].created_at,
        updatedAt: updatedUsers[0].updated_at
      };
      
      res.json({
        status: 'success',
        data: userData
      });
    } catch (error) {
      next(error);
    }
  });

  // Authentication middleware
  function authenticate(req, res, next) {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required'
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Attach user to request
      req.user = decoded;
      
      next();
    } catch (error) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }
  }

  // Export the authenticate middleware
  router.authenticate = authenticate;

  return router;
};