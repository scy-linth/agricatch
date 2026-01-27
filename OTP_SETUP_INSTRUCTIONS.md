# OTP (One-Time Password) Setup Instructions

## Overview
The system now supports OTP (One-Time Password) verification via email using SMTP. Users can receive OTP codes for login, registration, and password reset.

## Step 1: Configure SMTP Settings

1. Open your `.env` file in the `backend` folder (or create one from `env-example.txt`)

2. Add the following SMTP configuration:

```env
# SMTP Configuration for OTP Emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### For Gmail:
- **SMTP_HOST**: `smtp.gmail.com`
- **SMTP_PORT**: `587` (or `465` for SSL)
- **SMTP_SECURE**: `false` (or `true` for port 465)
- **SMTP_USER**: Your Gmail address
- **SMTP_PASSWORD**: **App Password** (not your regular password)

#### How to get Gmail App Password:
1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Go to "App passwords" section
4. Generate a new app password for "Mail"
5. Use that 16-character password as `SMTP_PASSWORD`

### For Other Email Providers:

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Yahoo:**
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Custom SMTP:**
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-password
```

## Step 2: Create OTP Table

Run the migration script:

```bash
cd "d:\Program Files\Coding\imtired"
node database/migrations/create_otp_table.js
```

You should see:
```
✅ OTP table created successfully!
```

## Step 3: Test OTP Functionality

### API Endpoints

#### 1. Send OTP
**POST** `/api/otp/send`

Request body:
```json
{
  "email": "user@example.com",
  "purpose": "login"  // or "register" or "reset_password"
}
```

Response:
```json
{
  "message": "OTP sent successfully to your email",
  "expiresIn": 600
}
```

#### 2. Verify OTP
**POST** `/api/otp/verify`

Request body:
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "login"
}
```

Response:
```json
{
  "message": "OTP verified successfully",
  "verified": true
}
```

### Test with cURL or Postman

**Send OTP:**
```bash
curl -X POST http://localhost:3000/api/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"login"}'
```

**Verify OTP:**
```bash
curl -X POST http://localhost:3000/api/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456","purpose":"login"}'
```

## Step 4: Integration with Frontend

The OTP system is ready to be integrated into your login/register flow. You can:

1. **Add OTP step to login:**
   - User enters email → Send OTP → User enters OTP → Verify → Login

2. **Add OTP step to registration:**
   - User fills registration form → Send OTP to email → User enters OTP → Verify → Complete registration

3. **Password reset:**
   - User requests password reset → Send OTP → Verify OTP → Allow password change

## Features

- ✅ 6-digit OTP codes
- ✅ 10-minute expiration
- ✅ Max 5 verification attempts per OTP
- ✅ Automatic cleanup of expired/used OTPs
- ✅ HTML email templates
- ✅ Support for login, register, and password reset purposes
- ✅ Email validation
- ✅ Prevents duplicate OTPs (invalidates old ones)

## Troubleshooting

### "Failed to send OTP email"
- Check SMTP credentials in `.env`
- Verify SMTP_HOST and SMTP_PORT are correct
- For Gmail: Make sure you're using an App Password, not your regular password
- Check if your email provider requires "Less secure app access" (not recommended, use App Password instead)

### "SMTP connection error"
- Verify your internet connection
- Check firewall settings
- Try different SMTP_PORT (587 or 465)
- For Gmail, ensure 2-Step Verification is enabled

### "OTP has expired"
- OTPs expire after 10 minutes
- Request a new OTP

### "Too many failed attempts"
- Maximum 5 attempts per OTP
- Request a new OTP if you've exceeded attempts

## Security Notes

- OTPs are stored hashed in the database (if you implement hashing)
- OTPs expire after 10 minutes
- Failed attempts are tracked
- Old OTPs are automatically invalidated when a new one is sent
- Email addresses are validated before sending
