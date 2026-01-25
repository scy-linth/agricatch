# 🔄 How to Restart the Server

## The Problem
The OTP route is returning **404 Not Found** because the server was started before the route was added. The server needs to be restarted to load the new route.

## Solution: Restart the Server

### Option 1: Using the Batch Script (Windows)
1. Double-click `backend/restart-server.bat`
2. Or run from command prompt:
   ```bash
   cd backend
   restart-server.bat
   ```

### Option 2: Manual Restart

#### Step 1: Stop the Current Server
1. Find the terminal/command prompt where the server is running
2. Press `Ctrl + C` to stop it
3. Or kill the process:
   ```powershell
   # Find the process
   netstat -ano | findstr :3000
   
   # Kill it (replace PID with the actual process ID)
   taskkill /F /PID <PID>
   ```

#### Step 2: Start the Server Again
```bash
cd "d:\Program Files\Coding\imtired\backend"
node server.js
```

You should see:
```
✅ OTP route loaded successfully
Server running on port 3000
```

### Option 3: Using Nodemon (Auto-restart on changes)
If you have nodemon installed:
```bash
cd backend
npm run dev
```

This will automatically restart the server when you make changes.

## Verify It's Working

After restarting, test the OTP route:
```bash
cd backend
node test-otp-route.js
```

You should see:
- ✅ Route is working! (instead of ❌ Route not found!)

Or test in browser console:
```javascript
fetch('/api/otp/send', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: 'test@example.com', purpose: 'register'})
})
.then(r => r.json())
.then(d => console.log(d));
```

## After Restart

Once the server is restarted:
1. The OTP route will be available at `/api/otp/send`
2. Registration will work properly
3. OTP codes will be displayed for testing (in development mode)
