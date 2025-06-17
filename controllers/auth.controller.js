const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../config/database');
const AppError = require('../utils/appError');
const twilioService = require('../services/twilio.service');
const dotenv = require('dotenv');
dotenv.config();

// JWT settings from environment
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

/**
 * Generate JWT token for authentication
 * @param {Object} user - User data
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate refresh token for extended sessions
 * @param {number} userId - User ID
 * @returns {string} - Refresh token
 */
const generateRefreshToken = async (userId) => {
  const refreshToken = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  let retries = 3;
  while (retries > 0) {
    try {
      await query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, refreshToken, expiresAt]
      );
      return refreshToken;
    } catch (error) {
      retries--;
      if (error.message && error.message.includes('Lock wait timeout exceeded') && retries > 0) {
        console.log(`Refresh token insertion lock timeout, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
      } else {
        throw error;
      }
    }
  }
  
  return refreshToken;
};

/**
 * Register a new user
 * @route POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  let connection = null;
  
  try {
    connection = await beginTransaction();
    
    const { full_name, email, phone_number, uid } = req.body;
    
    // Validate required fields
    if (!full_name || !email || !phone_number || !uid) {
      return next(new AppError('All fields are required', 400));
    }
    
    // Check if user already exists
    const existingUsers = await query(
      'SELECT * FROM users WHERE email = ? OR phone_number = ?',
      [email, phone_number]
    );
    
    if (existingUsers.length > 0) {
      return next(new AppError('User with this email or phone number already exists', 409));
    }
    
    // Insert user with transaction (including the Firebase UID but no password)
    const result = await connection.execute(
      'INSERT INTO users (uid, full_name, email, phone_number) VALUES (?, ?, ?, ?)',
      [uid, full_name, email, phone_number]
    );
    
    const userId = result[0].insertId;
    
    // Create JWT token
    const user = { id: userId, email, full_name, role: 'user' };
    const token = generateToken(user);
    
    // First commit the user creation transaction
    await commitTransaction(connection);
    connection = null; // Clear connection to prevent double commit/rollback
    
    // Generate refresh token outside the transaction to avoid lock contention
    const refreshToken = await generateRefreshToken(userId);
    
    // Send response without password
    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: userId,
          uid: uid,
          fullName: full_name,
          email,
          phoneNumber: phone_number,
          role: 'user'
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    // Check if this is a Firebase auth login
    if (req.body.firebase_uid && req.body.phone_number) {
      const { firebase_uid, phone_number } = req.body;
      
      console.log(`Firebase login attempt - UID: ${firebase_uid}, Phone: ${phone_number}`);
      
      // Find user by phone number
      const users = await query(
        'SELECT * FROM users WHERE phone_number = ?',
        [phone_number]
      );
      
      if (users.length === 0) {
        return next(new AppError('User not found', 404));
      }
      
      const user = users[0];
      console.log(`User found: ${JSON.stringify(user)}`);
      
      // Check if account is active
      if (user.account_status !== 'active') {
        return next(new AppError('Your account has been suspended or deactivated. Please contact support.', 401));
      }
      
      // Use a dedicated transaction for updating the Firebase UID if needed
      if (!user.uid || user.uid !== firebase_uid) {
        console.log(`Updating Firebase UID for user ${user.id} from "${user.uid}" to "${firebase_uid}"`);
        
        const connection = await beginTransaction();
        try {
          await connection.execute(
            'UPDATE users SET uid = ? WHERE id = ?',
            [firebase_uid, user.id]
          );
          await commitTransaction(connection);
          
          // Update user object
          user.uid = firebase_uid;
        } catch (error) {
          await rollbackTransaction(connection);
          console.error(`Error updating Firebase UID: ${error.message}`);
          // Continue login process even if UID update fails
        }
      }
      
      // Update last login in a separate transaction
      try {
        await query(
          'UPDATE users SET login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?',
          [user.id]
        );
      } catch (error) {
        console.error(`Error updating last login: ${error.message}`);
        // Continue login process even if last login update fails
      }
      
      // Generate tokens
      const token = generateToken(user);
      
      // Generate refresh token with retry logic
      let refreshToken;
      try {
        refreshToken = await generateRefreshToken(user.id);
      } catch (error) {
        console.error(`Error generating refresh token: ${error.message}`);
        // If refresh token generation fails, we can still return the JWT token
        refreshToken = null;
      }
      
      // Remove password from user object
      delete user.password;
      
      console.log(`Login successful for user ${user.id} with Firebase UID ${user.uid}`);
      
      const responseData = {
        user: {
          id: user.id,
          uid: user.uid,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
          role: user.role
        },
        token,
        refreshToken
      };
      
      // Log the response data for debugging (removing sensitive info)
      const debugData = { ...responseData };
      debugData.token = debugData.token ? `${debugData.token.substring(0, 10)}...` : null;
      debugData.refreshToken = debugData.refreshToken ? 'exists' : null;
      console.log(`Sending response: ${JSON.stringify(debugData)}`);
      
      return res.json({
        status: 'success',
        data: responseData
      });
    }
    
    // Regular password-based login
    const { phone_number, password } = req.body;
    
    // Validate required fields
    if (!phone_number || !password) {
      return next(new AppError('Phone number and password are required', 400));
    }
    
    // Find user by phone number
    const users = await query(
      'SELECT * FROM users WHERE phone_number = ?',
      [phone_number]
    );
    
    if (users.length === 0) {
      return next(new AppError('Invalid credentials', 401));
    }
    
    const user = users[0];
    
    // Check if account is active
    if (user.account_status !== 'active') {
      return next(new AppError('Your account has been suspended or deactivated. Please contact support.', 401));
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      // Track failed login attempts
      await query(
        'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?',
        [user.id]
      );
      
      // Lock account after 5 failed attempts
      if (user.login_attempts >= 4) { // This will be the 5th attempt
        await query(
          'UPDATE users SET account_status = "inactive" WHERE id = ?',
          [user.id]
        );
        return next(new AppError('Too many failed login attempts. Your account has been locked for security reasons. Please contact support.', 401));
      }
      
      return next(new AppError('Invalid credentials', 401));
    }
    
    // Reset login attempts on successful login
    await query(
      'UPDATE users SET login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = await generateRefreshToken(user.id);
    
    // Remove password from user object
    delete user.password;
    
    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          uid: user.uid,
          fullName: user.full_name,
          email: user.email,
          phoneNumber: user.phone_number,
          role: user.role
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send OTP to phone number
 * @route POST /api/auth/send-otp
 */
exports.sendOTP = async (req, res, next) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return next(new AppError('Phone number is required', 400));
    }

    // Validate phone number format
    if (!phone_number.match(/^\+212[0-9]{9}$/)) {
      return next(new AppError('Invalid phone number format. Must be +212XXXXXXXXX', 400));
    }

    // Send OTP via Twilio
    const verification = await twilioService.sendOTP(phone_number);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully',
      data: {
        status: verification.status,
        phoneNumber: phone_number,
        validityPeriod: '5 minutes'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP and login/register user
 * @route POST /api/auth/verify-otp
 */
exports.verifyOTP = async (req, res, next) => {
  let connection = null;
  console.log('--- [verifyOTP] Start ---');
  try {
    const { phone_number, code, full_name, email } = req.body;
    console.log('[verifyOTP] Input:', { phone_number, code, full_name, email });

    if (!phone_number || !code) {
      console.log('[verifyOTP] Missing phone_number or code');
      return next(new AppError('Phone number and code are required', 400));
    }

    // Verify OTP via Twilio
    const verificationCheck = await twilioService.verifyOTP(phone_number, code);
    console.log('[verifyOTP] Twilio verificationCheck:', verificationCheck);

    if (verificationCheck.status !== 'approved') {
      console.log('[verifyOTP] OTP not approved');
      return next(new AppError('Invalid OTP code', 400));
    }

    // Start transaction
    connection = await beginTransaction();
    console.log('[verifyOTP] Transaction started');

    // Check if user exists
    const users = await connection.execute(
      'SELECT * FROM users WHERE phone_number = ?',
      [phone_number]
    );
    console.log('[verifyOTP] Users found:', users[0].length);

    let user;
    let userId;

    if (users[0].length === 0) {
      // User doesn't exist - require full_name and email for registration
      if (!full_name || !email) {
        console.log('[verifyOTP] Missing full_name or email for new user');
        return next(new AppError('Full name and email are required for registration', 400));
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return next(new AppError('Invalid email format', 400));
      }

      // Create new user
      const uid = uuidv4();
      const result = await connection.execute(
        'INSERT INTO users (uid, phone_number, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
        [uid, phone_number, full_name, email, 'user']
      );
      userId = result[0].insertId;
      user = {
        id: userId,
        uid,
        phone_number,
        full_name,
        email,
        role: 'user'
      };
      console.log('[verifyOTP] New user created:', user);
    } else {
      // User exists - no need for full_name and email
      user = users[0][0];
      userId = user.id;
      console.log('[verifyOTP] Existing user:', user);
    }

    // Generate tokens
    const token = generateToken(user);
    await commitTransaction(connection);
    connection = null;
    console.log('[verifyOTP] Token generated');

    // Generate refresh token outside transaction
    const refreshToken = await generateRefreshToken(userId);
    console.log('[verifyOTP] Refresh token generated');

    // Update last login
    await query(
      'UPDATE users SET login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
    console.log('[verifyOTP] Last login updated');

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: userId,
          uid: user.uid,
          fullName: user.full_name,
          phoneNumber: user.phone_number,
          email: user.email,
          role: user.role
        },
        token,
        refreshToken
      }
    });
    console.log('--- [verifyOTP] Success ---');
  } catch (error) {
    if (connection) {
      await rollbackTransaction(connection);
    }
    console.error('--- [verifyOTP] Error ---', error);
    next(error);
  }
};

/**
 * Refresh JWT token
 * @route POST /api/auth/refresh-token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }
    
    // Find refresh token in database
    const tokens = await query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW() AND is_revoked = 0',
      [refreshToken]
    );
    
    if (tokens.length === 0) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }
    
    // Get user data
    const users = await query(
      'SELECT * FROM users WHERE id = ?',
      [tokens[0].user_id]
    );
    
    if (users.length === 0) {
      return next(new AppError('User not found', 404));
    }
    
    const user = users[0];
    
    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = await generateRefreshToken(user.id);
    
    // Revoke old refresh token
    await query(
      'UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?',
      [refreshToken]
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Revoke refresh token if provided
      await query(
        'UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?',
        [refreshToken]
      );
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check token validity
 * @route GET /api/auth/check-token
 */
exports.checkToken = async (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Token is valid'
  });
};

/**
 * Update user profile
 * @route PUT /api/auth/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, email } = req.body;
    const userId = req.user.id;
    
    // Update user profile
    await query(
      'UPDATE users SET full_name = ?, email = ? WHERE id = ?',
      [full_name, email, userId]
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 * @route POST /api/auth/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;
    
    // Get user data
    const users = await query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return next(new AppError('User not found', 404));
    }
    
    const user = users[0];
    
    // Check current password
    const isPasswordValid = await bcrypt.compare(current_password, user.password);
    
    if (!isPasswordValid) {
      return next(new AppError('Current password is incorrect', 401));
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 12);
    
    // Update password
    await query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset
 * @route POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(new AppError('Email is required', 400));
    }
    
    // Find user by email
    const users = await query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      // Don't reveal that the user doesn't exist
      return res.json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1);
    
    // Save reset token to database
    await query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, resetTokenExpires, users[0].id]
    );
    
    // TODO: Send email with reset token
    // In a real application, you would send an email here
    
    res.json({
      status: 'success',
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * @route POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return next(new AppError('Token and new password are required', 400));
    }
    
    // Validate password strength
    if (password.length < 8) {
      return next(new AppError('Password must be at least 8 characters long', 400));
    }
    
    // Find user by reset token
    const users = await query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );
    
    if (users.length === 0) {
      return next(new AppError('Invalid or expired token', 400));
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Update user password and clear reset token
    await query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashedPassword, users[0].id]
    );
    
    // Revoke all refresh tokens for this user
    await query(
      'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?',
      [users[0].id]
    );
    
    res.json({
      status: 'success',
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    next(error);
  }
};