# Fix SMTP Connection Timeout on Render

## Problem
```
❌ SMTP connection error: Error: Connection timeout
code: 'ETIMEDOUT'
```

This happens because:
1. Render's network may block outbound SMTP connections
2. Gmail blocks connections from cloud hosting IPs
3. Firewall restrictions on Render

## Solution: Use a Cloud-Friendly Email Service

### Option 1: Resend (Recommended - Easiest)

**Resend** is designed for cloud deployments and works perfectly with Render.

#### Setup Steps:

1. **Sign up for Resend**: https://resend.com
2. **Get API Key**: Dashboard → API Keys → Create API Key
3. **Update Environment Variables on Render**:
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=resend
   SMTP_PASSWORD=your-resend-api-key
   ```

4. **Verify your domain** (optional but recommended) or use Resend's test domain

**Resend is free for up to 3,000 emails/month!**

---

### Option 2: SendGrid

1. **Sign up**: https://sendgrid.com
2. **Create API Key**: Settings → API Keys → Create API Key
3. **Update Environment Variables on Render**:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASSWORD=your-sendgrid-api-key
   ```

---

### Option 3: Mailgun

1. **Sign up**: https://www.mailgun.com
2. **Get SMTP credentials**: Sending → Domain Settings → SMTP credentials
3. **Update Environment Variables on Render**:
   ```
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-mailgun-username
   SMTP_PASSWORD=your-mailgun-password
   ```

---

### Option 4: Use Nodemailer with Resend API (Best for Cloud)

Instead of SMTP, use Resend's API directly. This is more reliable.

#### Install Resend package:
```bash
npm install resend
```

#### Update `backend/utils/emailService.js`:

```javascript
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOtpEmail(to, otp, purpose = 'login') {
  const purposeText = {
    login: 'Login',
    register: 'Registration',
    reset_password: 'Password Reset',
  }[purpose] || 'Verification';

  try {
    const { data, error } = await resend.emails.send({
      from: 'AgriCatch <onboarding@resend.dev>', // Change to your verified domain
      to: [to],
      subject: `Your ${purposeText} OTP Code`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .otp-box { background: white; border: 2px solid #2e7d32; border-radius: 5px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #2e7d32; letter-spacing: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { color: #d32f2f; font-size: 14px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>AgriCatch</h1>
              <p>${purposeText} Verification</p>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Your One-Time Password (OTP) for ${purposeText.toLowerCase()} is:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p>This OTP is valid for <strong>10 minutes</strong>.</p>
              <p class="warning">⚠️ Do not share this code with anyone. AgriCatch will never ask for your OTP.</p>
              <p>If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} AgriCatch. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend email error:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ OTP email sent via Resend:', data);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('❌ Failed to send OTP email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOtpEmail };
```

#### Update Environment Variables on Render:
```
RESEND_API_KEY=re_your_api_key_here
```

#### Update `backend/routes/otp.js`:
Remove the SMTP transporter code and just use the Resend function.

---

## Quick Fix: Try Different SMTP Settings

If you want to keep using Gmail, try these settings:

### Option A: Use Port 465 with SSL
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Option B: Use OAuth2 (More Complex)
Gmail OAuth2 requires more setup but is more reliable.

---

## Recommended: Use Resend (Easiest & Most Reliable)

1. **Sign up**: https://resend.com (free tier: 3,000 emails/month)
2. **Get API key** from dashboard
3. **Set on Render**: `RESEND_API_KEY=re_xxxxx`
4. **Update code** to use Resend API (see Option 4 above)
5. **Redeploy** on Render

Resend is specifically designed for cloud deployments and won't have connection timeout issues!

---

## After Fixing

1. Update environment variables on Render
2. Redeploy (Render auto-redeploys when env vars change)
3. Check logs for: "✅ SMTP server is ready" or "✅ OTP email sent"
4. Test OTP sending from your Netlify site

---

**I recommend using Resend - it's the easiest and most reliable solution for cloud deployments!**
