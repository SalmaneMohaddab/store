# Store API Backend

This is the RESTful API backend for the Store e-commerce application, built with Node.js, Express, and MySQL following the MVC (Model-View-Controller) architectural pattern.

## Architecture

The API is designed using the MVC architecture pattern:

- **Models**: Handle data logic, database interactions, and business rules
- **Controllers**: Process requests, interact with models, and send responses
- **Routes**: Define API endpoints and connect them to controllers

## Requirements

- Node.js 14+ 
- MySQL 5.7+ or MariaDB 10.3+

## Setup Instructions

1. **Clone the repository**

2. **Install dependencies**
   ```
   cd api
   npm install
   ```

3. **Create the database**
   
   Create a MySQL database on the specified server (192.168.1.12) and import the schema:
   ```
   mysql -u root -p -h 192.168.1.12
   CREATE DATABASE store_db;
   exit;
   mysql -u root -p -h 192.168.1.12 store_db < store_database.sql
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the root directory with the following variables:
   ```
   # API Configuration
   NODE_ENV=development
   PORT=3000
   FRONTEND_URL=http://localhost:3000

   # Database Configuration (MySQL server at 192.168.1.12)
   DB_HOST=192.168.1.12
   DB_USER=store_user
   DB_PASSWORD=store_password
   DB_NAME=store_db

   # JWT Configuration
   JWT_SECRET=your_super_secure_jwt_secret_key_change_this_in_production
   JWT_EXPIRES_IN=1h
   JWT_COOKIE_EXPIRES_IN=90

   # Security
   RATE_LIMIT_WINDOW_MS=15*60*1000  # 15 minutes
   RATE_LIMIT_MAX=100  # 100 requests per window

   # Logging
   LOG_LEVEL=info
   ```

5. **Start the development server**
   ```
   npm run dev
   ```

6. **Access the API**
   
   The API will be available at `http://localhost:3000/api`

## Security Features

This API implements several security best practices:

- **JWT Authentication**: Secure token-based authentication
- **Refresh Tokens**: Allows for session extension without re-authentication
- **Password Hashing**: All passwords are hashed using bcrypt
- **Rate Limiting**: Prevents brute force attacks by limiting request frequency
- **XSS Protection**: Sanitizes input to prevent cross-site scripting attacks
- **Helmet**: Sets HTTP headers appropriately for security
- **CORS**: Configurable Cross-Origin Resource Sharing
- **Parameter Pollution Prevention**: Prevents HTTP parameter pollution attacks
- **Error Handling**: Secure error handling that doesn't leak information
- **Input Validation**: Validates user input at multiple levels
- **Role-Based Access Control**: Restricts access to endpoints based on user roles
- **Failed Login Protection**: Locks accounts after multiple failed attempts

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and receive JWT token
- `POST /api/auth/refresh-token` - Refresh an expired JWT token
- `POST /api/auth/logout` - Logout and invalidate refresh token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (requires auth)

### Users

- `GET /api/users/profile` - Get current user profile (requires auth)
- `PUT /api/users/profile` - Update user profile (requires auth)

### Products

- `GET /api/products` - Get products (with optional pagination and filters)
- `GET /api/products/:id` - Get a single product
- `GET /api/products/search/:query` - Search products
- `POST /api/products` - Create a new product (admin only)
- `PUT /api/products/:id` - Update a product (admin only)
- `DELETE /api/products/:id` - Delete a product (admin only)

### Categories

- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get a single category
- `GET /api/categories/:id/products` - Get products in a category
- `POST /api/categories` - Create a new category (admin only)
- `PUT /api/categories/:id` - Update a category (admin only)
- `DELETE /api/categories/:id` - Delete a category (admin only)

### Cart

- `GET /api/cart` - Get user's cart items (requires auth)
- `POST /api/cart` - Add item to cart (requires auth)
- `PUT /api/cart/:id` - Update cart item quantity (requires auth)
- `DELETE /api/cart/:id` - Remove item from cart (requires auth)

### Orders

- `GET /api/orders` - Get user's orders (requires auth)
- `GET /api/orders/:id` - Get order details (requires auth)
- `POST /api/orders` - Create new order (requires auth)
- `PUT /api/orders/:id/status` - Update order status (admin only)

### Addresses

- `GET /api/addresses` - Get user's addresses (requires auth)
- `POST /api/addresses` - Add new address (requires auth)
- `PUT /api/addresses/:id` - Update address (requires auth)
- `DELETE /api/addresses/:id` - Delete address (requires auth)

## Database Schema

The database is defined in `store_database.sql` and includes the following tables:

- **users**: Customer information with enhanced security fields
- **refresh_tokens**: Manages refresh tokens for extended sessions
- **categories**: Product categories with localized names
- **products**: Product details with inventory management
- **user_addresses**: Customer addresses
- **cart_items**: Items in user carts
- **orders**: Order information with payment and tracking details
- **order_items**: Items in orders

## Development

### Code Style

This project uses ESLint to enforce code style. Run the linter with:

```
npm run lint
```

### Testing

Run tests with:

```
npm test
``` 