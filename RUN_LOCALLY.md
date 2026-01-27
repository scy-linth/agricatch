# Running AgriCatch Locally

## Quick Start Guide

### Prerequisites Check
- ✅ Node.js installed (v24.13.0 detected)
- ✅ Backend dependencies installed
- ⚠️ PostgreSQL database must be running

### Step 1: Ensure PostgreSQL is Running

Make sure PostgreSQL is installed and running on your machine:
- Default port: 5432
- Database name: `agri_fishery_marketplace`
- User: `postgres` (or as configured in `.env`)

### Step 2: Verify Database Configuration

Check `backend/.env` file has correct database credentials:
```
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agri_fishery_marketplace
```

### Step 3: Start the Server

From the project root directory, run:
```bash
cd backend
npm start
```

Or for development with auto-reload:
```bash
cd backend
npm run dev
```

### Step 4: Access the Application

Open your browser and navigate to:
- **Main Site**: http://localhost:3000
- **Farmer Dashboard**: http://localhost:3000/farmer.html
- **Admin Dashboard**: http://localhost:3000/admin.html

### Step 5: Test the System

1. **Browse Products**: Visit http://localhost:3000
2. **Register/Login**: Create an account or login
3. **Add to Cart**: Test the shopping cart functionality
4. **Farmer Dashboard**: Login as a farmer to manage products

## Troubleshooting

### Database Connection Error
If you see database connection errors:
1. Ensure PostgreSQL service is running
2. Check database credentials in `backend/.env`
3. Verify database exists: `CREATE DATABASE agri_fishery_marketplace;`
4. Run schema: `psql -U postgres -d agri_fishery_marketplace -f database/schema.sql`

### Port Already in Use
If port 3000 is busy:
1. Change `PORT` in `backend/.env` to another port (e.g., 3001)
2. Update frontend API calls if needed

### CORS Errors
The server is configured to allow localhost by default. If you see CORS errors:
- Check `FRONTEND_URL` in `backend/.env`
- Ensure it includes `http://localhost:3000`

## Development Mode

For development with auto-reload on file changes:
```bash
cd backend
npm run dev
```

This uses `nodemon` to automatically restart the server when you make changes.

## Environment Variables

Key environment variables in `backend/.env`:
- `DB_*`: Database connection settings
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: Server port (default: 3000)
- `FRONTEND_URL`: Allowed frontend origins for CORS
- `RESEND_API_KEY`: Email service API key (optional)
- `SMTP_*`: SMTP settings for email (fallback)

## Notes

- The server serves both API endpoints (`/api/*`) and static frontend files
- Frontend files are served from the `frontend/` directory
- All API calls from frontend use relative paths (`/api/*`) which work with the proxy setup
