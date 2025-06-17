const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', authController.register);

/**
 * @route POST /api/auth/login
 * @desc Login a user
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh JWT token using a refresh token
 * @access Public
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @route POST /api/auth/logout
 * @desc Logout a user
 * @access Public
 */
router.post('/logout', authController.logout);

/**
 * @route GET /api/auth/check-token
 * @desc Check if JWT token is valid
 * @access Private (requires authentication)
 */
router.get('/check-token', authenticate, authController.checkToken);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @route POST /api/auth/change-password
 * @desc Change password while logged in
 * @access Private
 */
router.post('/change-password', authenticate, authController.changePassword);

/**
 * @route POST /api/auth/send-otp
 * @desc Send OTP to phone number
 * @access Public
 */
router.post('/send-otp', authController.sendOTP);

/**
 * @route POST /api/auth/verify-otp
 * @desc Verify OTP and login/register user
 * @access Public
 */
router.post('/verify-otp', authController.verifyOTP);

module.exports = router; 