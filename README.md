# Agricatch: “A Web Application for Pre-Ordering Fresh Produce from Farmers for Trabajo Market”


A modern e-commerce platform connecting farmers directly with consumers for fresh agricultural and fishery products. Features guest browsing, cart functionality, and user authentication for ordering.

## Features

- **Guest Mode**: Browse products and add to cart without registration
- **User Authentication**: Register and login for placing orders
- **Product Categories**: Agricultural Products and Fishery Products
- **Shopping Cart**: Persistent cart for both guest and logged-in users
- **Cash on Delivery**: Philippine payment method
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Cart Updates**: Live cart count and totals
- **Product Search & Filtering**: Find products by category and search terms

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Authentication**: JWT (JSON Web Tokens)
- **Styling**: Custom CSS with responsive design

## Project Structure

```
agri-fishery-marketplace/
├── backend/                 # Node.js backend
│   ├── routes/             # API route handlers
│   ├── middleware/         # Custom middleware
│   ├── config/            # Configuration files
│   ├── server.js          # Main server file
│   └── package.json       # Backend dependencies
├── frontend/               # Frontend files
│   └── index.html         # Main HTML file
├── public/                 # Static assets
│   ├── css/
│   │   └── styles.css     # Main stylesheet
│   └── js/
│       └── app.js         # Frontend JavaScript
├── database/               # Database scripts
│   ├── schema.sql         # Database schema
│   └── seed.js           # Sample data seeder
└── README.md              # This file
```

## Prerequisites

Before running this application, make sure you have the following installed:

1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **PostgreSQL** (v12 or higher) - [Download here](https://www.postgresql.org/download/)
3. **Git** (optional, for cloning) - [Download here](https://git-scm.com/)

## Installation & Setup

### 1. Clone or Download the Project

If you have git installed:
```bash
git clone <repository-url>
cd agri-fishery-marketplace
```

Or simply download and extract the ZIP file to your desired location.

### 2. Install Backend Dependencies

Open a terminal/command prompt and navigate to the backend folder:

```bash
cd backend
npm install
```

### 3. Setup PostgreSQL Database

1. **Start PostgreSQL**: Make sure PostgreSQL is running on your system
2. **Create Database**: Open PostgreSQL command line or pgAdmin and create a database:
   ```sql
   CREATE DATABASE agri_fishery_marketplace;
   ```
3. **Update Database Credentials**: Create a `.env` file in the backend folder:
   ```
   DB_USER=postgres
   DB_PASSWORD=your_password_here
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=agri_fishery_marketplace
   JWT_SECRET=your_jwt_secret_key_here
   SESSION_SECRET=your_session_secret_here
   PORT=3000
   ```

### 4. Initialize Database Schema

Run the schema script to create tables:

```bash
# Using psql command line
psql -U postgres -d agri_fishery_marketplace -f ../database/schema.sql

# Or run the seed script to populate with sample data
cd ../database
node seed.js
```

### 5. Start the Server

From the backend directory:

```bash
npm start
```

The server will start on `http://localhost:3000`

### 6. Open the Website

Open your web browser and navigate to:
```
http://localhost:3000
```

## Usage Guide

### For Guests:
1. **Browse Products**: Scroll through the homepage or use search/filter
2. **Add to Cart**: Click "Add to Cart" on any product
3. **View Cart**: Click the cart icon to see items and totals
4. **Login Required**: To checkout, you must register/login first

### For Registered Users:
1. **Register**: Click "Register" and fill in your details
2. **Login**: Use your email and password to login
3. **Place Orders**: Add items to cart and proceed to checkout
4. **Cash on Delivery**: Pay when your order arrives

### Sample Accounts:

The database includes sample farmer accounts:
- **Email**: juan@farm.ph / **Password**: password123 (Farmer)
- **Email**: maria@seafood.ph / **Password**: password123 (Fishery)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

### Products
- `GET /api/products` - Get all products (with pagination/filtering)
- `GET /api/products/:id` - Get single product

### Cart
- `GET /api/cart` - Get cart items
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:id` - Update cart item quantity
- `DELETE /api/cart/:id` - Remove item from cart

### Orders
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order

## Features in Detail

### Guest Cart
- Uses browser session storage for persistence
- Cart items are preserved until browser is closed
- Migrates to user account upon login

### Product Catalog
- **Agricultural Products**: Vegetables, fruits, grains, eggs
- **Fishery Products**: Fish, seafood, aquaculture products
- Product details include farmer info, location, and freshness dates

### Order Process
1. Add products to cart
2. Login/register when ready to checkout
3. Fill delivery details
4. Place order with cash on delivery
5. Receive confirmation

### Responsive Design
- Desktop, tablet, and mobile optimized
- Modern UI with smooth animations
- Intuitive navigation

## Troubleshooting

### Common Issues:

1. **"npm command not found"**
   - Make sure Node.js is properly installed
   - Restart your terminal/command prompt
   - Check if Node.js is in your system PATH

2. **Database connection error**
   - Ensure PostgreSQL is running
   - Check database credentials in `.env` file
   - Verify database name exists

3. **Port 3000 already in use**
   - Change the PORT in `.env` file to another available port
   - Or stop other applications using port 3000

4. **CORS errors in browser**
   - Make sure the server is running on the correct port
   - Check browser console for detailed error messages

### Database Issues:

If you encounter database issues:

```bash
# Drop and recreate database
DROP DATABASE IF EXISTS agri_fishery_marketplace;
CREATE DATABASE agri_fishery_marketplace;

# Re-run schema
psql -U postgres -d agri_fishery_marketplace -f database/schema.sql

# Re-seed data
cd database
node seed.js
```

## Development

### Adding New Features:
1. Backend changes in `/backend` folder
2. Frontend changes in `/frontend` and `/public` folders
3. Database changes in `/database` folder

### Running in Development Mode:
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For questions or issues:
- Check the troubleshooting section above
- Review browser console for error messages
- Ensure all prerequisites are properly installed

---

**Happy shopping with AgriFishery Market! 🛒**