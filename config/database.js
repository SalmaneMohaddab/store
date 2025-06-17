const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Create a connection pool to the database
const pool = mysql.createPool({
  host:   process.env.DB_HOST || 'localhost',
  user:   process.env.DB_USER || 'root',
  password:  process.env.DB_PASSWORD || '',
  database:  process.env.DB_NAME || 'store_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
  connectTimeout: 10000, // 10 seconds
});

/**
 * Test the database connection
 */
const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL database connected successfully');
    
    // Check the database version
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log(`MySQL version: ${rows[0].version}`);
    
    connection.release();
  } catch (error) {
    console.error('Database connection failed: ', error.message);
    console.log('Make sure your MySQL server is running and properly configured.');
    console.log('The application will continue without database functionality.');
    // Don't exit the process to allow the application to start even without DB
    // process.exit(1); // Exit with failure
  }
};

/**
 * Execute a SQL query with parameters
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Parameters for the query
 * @returns {Promise} - Query result
 */
const query = async (sql, params = []) => {
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error: ', error.message);
    console.error('Query: ', sql);
    console.error('Parameters: ', params);
    throw error;
  }
};

/**
 * Begin a transaction
 * @returns {Object} - Connection with transaction
 */
const beginTransaction = async () => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
};

/**
 * Commit a transaction
 * @param {Object} connection - Connection with transaction
 */
const commitTransaction = async (connection) => {
  await connection.commit();
  connection.release();
};

/**
 * Rollback a transaction
 * @param {Object} connection - Connection with transaction
 */
const rollbackTransaction = async (connection) => {
  await connection.rollback();
  connection.release();
};

module.exports = {
  pool,
  connectDB,
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
};