const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/auth.middleware');

/**
 * @route GET /api/users/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', authenticate, (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});

/**
 * @route PUT /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', authenticate, (req, res) => {
  // This would typically call a controller method
  // For now, return a placeholder response
  res.json({
    status: 'success',
    message: 'Profile updated successfully'
  });
});

/**
 * @route GET /api/users
 * @desc Get all users (admin only)
 * @access Private/Admin
 */
router.get('/', authenticate, restrictTo('admin'), (req, res) => {
  // This would typically call a controller method
  // For now, return a placeholder response
  res.json({
    status: 'success',
    data: {
      users: []
    }
  });
});

module.exports = router; 