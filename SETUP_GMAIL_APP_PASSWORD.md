# Setup Gmail App Password for SMTP

## Why You Need an App Password

Gmail requires an **App Password** (not your regular password) when using SMTP from cloud services like Render. This is a security feature.

---

## Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: https://myaccount.google.com
2. Click **Security** (left sidebar)
3. Under "Signing in to Google", find **2-Step Verification**
4. If not enabled, click **Get Started** and follow the steps
5. You'll need to verify with your phone

**⚠️ Important:** You MUST enable 2-Step Verification before you can create App Passwords.

---

## Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords

2. You might be asked to sign in again

3. Under "Select app", choose **Mail**

4. Under "Select device", choose **Other (Custom name)**

5. Type a name like: **"Render Backend"** or **"AgriCatch SMTP"**

6. Click **Generate**

7. **Copy the 16-character password** (it looks like: `abcd efgh ijkl mnop`)
   - Remove spaces when using it: `abcdefghijklmnop`

8. **⚠️ Important:** You can only see this password once! Save it immediately.

---

## Step 3: Configure on Render

Go to Render Dashboard → Your Backend Service → Environment tab

Add these environment variables:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
```

**Important:**
- `SMTP_USER` = Your full Gmail address (e.g., `agricatchph@gmail.com`)
- `SMTP_PASSWORD` = The 16-character App Password (no spaces)

---

## Step 4: Test

After setting environment variables on Render:
1. Render will auto-redeploy
2. Check Render logs for: "✅ SMTP server is ready to send emails"
3. Test OTP sending from your Netlify site

---

## Troubleshooting

### "Invalid login" or "Authentication failed"

**Check:**
- ✅ 2-Step Verification is enabled
- ✅ Using App Password (not regular password)
- ✅ App Password has no spaces
- ✅ SMTP_USER is your full email address

### Still getting timeout errors

Gmail may still block connections from Render's IPs. If this happens:
- Try port 465 with SSL:
  ```
  SMTP_PORT=465
  SMTP_SECURE=true
  ```
- Or consider using Resend (more reliable for cloud)

---

## Alternative: Use Port 465 (SSL)

If port 587 doesn't work, try:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

**After generating the App Password and setting it on Render, your OTP emails should work!**
