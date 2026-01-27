# Fix Netlify + Render Setup for OTP

## Problem
Server error when sending OTP during registration on Netlify.

## Root Causes
1. **SMTP environment variables not set on Render**
2. **Incorrect Render backend URL in netlify.toml**
3. **CORS not allowing Netlify domain**

---

## Step 1: Verify Your Render Backend URL

1. Go to your Render dashboard: https://dashboard.render.com
2. Find your backend service (should be named something like "agricatch" or "backend")
3. Copy the **Service URL** (e.g., `https://agricatch-xxxx.onrender.com`)

---

## Step 2: Update netlify.toml

Update the `netlify.toml` file with your correct Render URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-ACTUAL-RENDER-URL.onrender.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/images/uploads/*"
  to = "https://YOUR-ACTUAL-RENDER-URL.onrender.com/images/uploads/:splat"
  status = 200
  force = true
```

**Replace `YOUR-ACTUAL-RENDER-URL` with your actual Render service URL.**

---

## Step 3: Configure Environment Variables on Render

Go to your Render service → **Environment** tab and add these variables:

### Required Environment Variables:

```
# Database (if using Render Postgres)
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=your-db-host.onrender.com
DB_PORT=5432
DB_NAME=your_db_name

# JWT & Session
JWT_SECRET=your_super_secret_jwt_key_here
SESSION_SECRET=your_session_secret_key_here

# Server
PORT=10000
NODE_ENV=production

# Frontend URL (your Netlify URL)
FRONTEND_URL=https://your-netlify-site.netlify.app

# SMTP Configuration (CRITICAL for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Important: SMTP Setup

For Gmail:
1. Enable 2-Factor Authentication on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate an "App Password" for "Mail"
4. Use that app password as `SMTP_PASSWORD` (not your regular Gmail password)

For other email providers:
- **Outlook/Hotmail**: `smtp-mail.outlook.com`, port `587`
- **Yahoo**: `smtp.mail.yahoo.com`, port `587`
- **Custom SMTP**: Use your provider's SMTP settings

---

## Step 4: Update CORS on Backend

Make sure your Render backend allows your Netlify domain.

In `backend/server.js`, the CORS is already configured to use `FRONTEND_URL`:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
```

So just set `FRONTEND_URL` on Render to your Netlify URL.

---

## Step 5: Redeploy

### On Render:
1. After adding environment variables, Render will auto-redeploy
2. Wait for deployment to complete
3. Check logs for any errors

### On Netlify:
1. After updating `netlify.toml`, commit and push to GitHub
2. Netlify will auto-deploy
3. Or manually trigger a deploy

---

## Step 6: Test

1. Go to your Netlify site
2. Try to register a new account
3. Check browser console (F12) for errors
4. Check Render logs for backend errors

---

## Troubleshooting

### Error: "Failed to send OTP email"

**Check:**
1. SMTP credentials are correct on Render
2. SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD are all set
3. For Gmail: Using App Password (not regular password)
4. Check Render logs for detailed SMTP errors

### Error: "Network error" or "CORS error"

**Check:**
1. `FRONTEND_URL` is set correctly on Render (your Netlify URL)
2. `netlify.toml` has correct Render backend URL
3. Render service is running and accessible

### Error: "Cannot connect to email server"

**Check:**
1. SMTP_HOST is correct
2. SMTP_PORT is correct (587 for TLS, 465 for SSL)
3. Firewall/network allows outbound SMTP connections
4. Try different SMTP provider if Gmail doesn't work

### Check Render Logs

1. Go to Render dashboard → Your service → Logs
2. Look for:
   - "✅ SMTP server is ready to send emails" (good)
   - "❌ SMTP connection error" (bad - check credentials)
   - Database connection errors
   - Route loading errors

---

## Quick Checklist

- [ ] Render backend URL is correct in `netlify.toml`
- [ ] All environment variables set on Render
- [ ] SMTP credentials are correct (especially App Password for Gmail)
- [ ] `FRONTEND_URL` set to your Netlify URL on Render
- [ ] Render service is running (check status)
- [ ] Netlify has latest `netlify.toml` (redeploy if needed)
- [ ] Test OTP sending from Netlify site

---

## Alternative: Use Environment Variable for API URL

If proxy isn't working, you can set the API URL directly in the frontend:

In `frontend/js/app.js`, change:
```javascript
this.apiBase = '/api';
```

To:
```javascript
this.apiBase = process.env.API_URL || 'https://your-render-url.onrender.com/api';
```

Then set `API_URL` in Netlify environment variables.

---

**After fixing, commit and push changes, then test again!**
