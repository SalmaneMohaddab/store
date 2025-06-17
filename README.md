# Store API Backend

A RESTful API backend for an e-commerce store, built with Node.js, Express, and MySQL, following the MVC (Model-View-Controller) pattern.

---

## Features

- User authentication (JWT, refresh tokens, OTP via Twilio)
- Role-based access control (admin, user)
- Product, category, cart, order, and address management
- Secure password hashing (bcrypt)
- Rate limiting, XSS, and parameter pollution protection
- Centralized error handling
- Input validation
- MySQL connection pooling and transaction support

---

## Directory Structure

```
api/
├── config/           # Database config
├── controllers/      # Route controllers
├── db/               # (Reserved for DB scripts/files)
├── middleware/       # Auth, error, and other middleware
├── migrations/       # (Reserved for DB migrations)
├── models/           # Data models
├── public/           # Static assets
├── routes/           # Express route definitions
├── services/         # External services (e.g., Twilio)
├── utils/            # Utility functions
├── store_database.sql# Database schema
├── .env              # Environment variables (not committed)
├── .gitignore        # Git ignore rules
├── package.json      # NPM dependencies and scripts
├── README.md         # Project documentation
└── server.js         # App entry point
```

---

## Requirements

- Node.js 14+
- MySQL 5.7+ or MariaDB 10.3+

---

## Setup Instructions

1. **Clone the repository**
2. **Install dependencies**

   ```sh
   cd api
   npm install
   ```

3. **Create the database**

   ```sh
   mysql -u <user> -p -h <host>
   CREATE DATABASE store_db;
   exit;
   mysql -u <user> -p -h <host> store_db < store_database.sql
   ```

4. **Configure environment variables**

   Create a `.env` file in the root directory:

   ```ini
   NODE_ENV=development
   PORT=3000
   FRONTEND_URL=http://localhost:3000

   # Database
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_db_password
   DB_NAME=store_db

   # JWT
   JWT_SECRET=your_super_secure_jwt_secret_key
   JWT_EXPIRES_IN=1h
   JWT_COOKIE_EXPIRES_IN=90

   # Security
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX=100

   # Logging
   LOG_LEVEL=info

   # Twilio (for OTP)
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
   ```

5. **Start the development server**

   ```sh
   npm run dev
   ```

6. **Access the API**

   - The API will be available at `http://localhost:3000/api`

---

## Security Features

- JWT authentication and refresh tokens
- Passwords hashed with bcrypt
- Rate limiting (express-rate-limit)
- XSS protection (xss-clean)
- HTTP header security (helmet)
- CORS configuration
- HTTP parameter pollution protection (hpp)
- Centralized error handling
- Input validation
- Role-based access control
- Account lockout after failed logins

---

## API Endpoints

### Authentication

- `POST /api/auth/register`         Register a new user
- `POST /api/auth/login`            Login and receive JWT
- `POST /api/auth/refresh-token`    Refresh JWT
- `POST /api/auth/logout`           Logout and invalidate refresh token
- `POST /api/auth/forgot-password`  Request password reset
- `POST /api/auth/reset-password`   Reset password with token
- `POST /api/auth/change-password`  Change password (auth required)
- `POST /api/auth/send-otp`         Send OTP to phone
- `POST /api/auth/verify-otp`       Verify OTP and login/register

### Users

- `GET /api/users/profile`          Get current user profile (auth required)
- `PUT /api/users/profile`          Update user profile (auth required)
- `GET /api/users`                  Get all users (admin only)

### Products

- `GET /api/products`               List products (public)
- `GET /api/products/:id`           Get product by ID (public)
- `GET /api/products/search/:query` Search products (public)
- `POST /api/products`              Create product (admin only)
- `PUT /api/products/:id`           Update product (admin only)
- `DELETE /api/products/:id`        Delete product (admin only)

### Categories

- `GET /api/categories`             List categories (public)
- `GET /api/categories/:id`         Get category by ID (public)
- `GET /api/categories/:id/products`Get products in category (public)
- `POST /api/categories`            Create category (admin only)
- `PUT /api/categories/:id`         Update category (admin only)
- `DELETE /api/categories/:id`      Delete category (admin only)

### Cart

- `GET /api/cart`                   Get user's cart (auth required)
- `POST /api/cart`                  Add item to cart (auth required)
- `PUT /api/cart/:id`               Update cart item (auth required)
- `DELETE /api/cart/:id`            Remove item from cart (auth required)

### Orders

- `GET /api/orders`                 Get user's orders (auth required)
- `GET /api/orders/:id`             Get order details (auth required)
- `POST /api/orders`                Create order (auth required)
- `PUT /api/orders/:id/status`      Update order status (admin only)

### Addresses

- `GET /api/addresses`              Get user's addresses (auth required)
- `POST /api/addresses`             Add address (auth required)
- `PUT /api/addresses/:id`          Update address (auth required)
- `DELETE /api/addresses/:id`       Delete address (auth required)

---

## Environment Variables

See `.env.example` or the section above for all required environment variables.

---

## Running in Production

- Set `NODE_ENV=production` and use strong secrets.
- Serve static files from `public/` if needed.
- Use a process manager (e.g., PM2) for reliability.
- Secure your `.env` and never commit secrets to version control.

---

## Development

- **Lint:** `npm run lint`
- **Test:** `npm test`

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License

This project is for demonstration and educational purposes. See LICENSE file if present.