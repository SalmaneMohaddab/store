const AppError = require('../utils/appError');

/**
 * Development error response handler
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

/**
 * Production error response handler
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
    // Programming or other unknown error: don't leak error details
  } else {
    // Log error
    console.error('ERROR 💥', err);
    // Send generic message
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong'
    });
  }
};

/**
 * Handle database duplicate key errors
 */
const handleDuplicateFieldsDB = (err) => {
  const match = err.message.match(/Duplicate entry '(.+)' for key/);
  const value = match ? match[1] : 'field';
  const message = `Duplicate value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

/**
 * Handle database connection errors
 */
const handleDBConnectionError = (err) => {
  console.error('Database Connection Error:', err);
  return new AppError('Database connection error. Please try again later.', 503);
};

/**
 * Handle JWT validation errors
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);

/**
 * Handle JWT expiration errors
 */
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.code === 'ER_DUP_ENTRY') error = handleDuplicateFieldsDB(err);
    if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST' || 
        err.code === 'ER_ACCESS_DENIED_ERROR' || err.message.includes('ETIMEDOUT')) {
      error = handleDBConnectionError(err);
    }
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = {
  errorHandler
}; 