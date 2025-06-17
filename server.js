const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import DB connection
const { connectDB } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth.routes.js');
const userRoutes = require('./routes/user.routes.js');
const productRoutes = require('./routes/product.routes.js');
const categoryRoutes = require('./routes/category.routes.js');
const cartRoutes = require('./routes/cart.routes.js');
const orderRoutes = require('./routes/order.routes.js');
const addressRoutes = require('./routes/address.routes.js');

// Import middleware
const { errorHandler } = require('./middleware/error.middleware');
const { authenticate } = require('./middleware/auth.middleware');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Set trust proxy if behind a proxy (like Nginx)
app.set('trust proxy', 1);

// Security and performance middleware
app.use(helmet()); // Set security HTTP headers
app.use(xss()); // Prevent XSS attacks
app.use(hpp()); // Prevent HTTP parameter pollution
app.use(compression()); // Compress responses

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { status: 'error', message: 'Too many requests, please try again later' }
});
app.use('/api', limiter);

// CORS config
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true
};
app.use(cors(corsOptions));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/products', productRoutes); // No auth for product browsing
app.use('/api/categories', categoryRoutes); // No auth for category browsing
app.use('/api/cart', authenticate, cartRoutes);
app.use('/api/orders', authenticate, orderRoutes);
app.use('/api/addresses', authenticate, addressRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API documentation route
app.get('/api/docs', (req, res) => {
  res.redirect(process.env.API_DOCS_URL || '/api-docs');
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('\n🔥 UNHANDLED REJECTION! Shutting down...\n');
  console.error('Error Details:');
  console.error('- Name:', err.name);
  console.error('- Message:', err.message);
  console.error('- Stack Trace:');
  console.error(err.stack);
  console.error('\n- Error Object:', JSON.stringify(err, null, 2));
  console.error('\n- Location:', err.fileName || 'Unknown File');
  console.error('- Line Number:', err.lineNumber || 'Unknown');
  console.error('- Column:', err.columnNumber || 'Unknown');
  
  // Log the full error object for debugging
  console.error('\nFull Error Object Properties:');
  for (let prop in err) {
    console.error(`${prop}:`, err[prop]);
  }
  
  server.close(() => {
    console.error('\n💥 Server shutting down due to unhandled rejection');
    process.exit(1);
  });
});

// Also add uncaught exception handler for synchronous errors
process.on('uncaughtException', (err) => {
  console.error('\n💥 UNCAUGHT EXCEPTION! Shutting down...\n');
  console.error('Error Details:');
  console.error('- Name:', err.name);
  console.error('- Message:', err.message);
  console.error('- Stack Trace:');
  console.error(err.stack);
  console.error('\n- Error Object:', JSON.stringify(err, null, 2));
  
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});

module.exports = app; 