const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Inline logo attachment for email clients (fixes broken image in Gmail)
const logoPath = path.join(__dirname, "..", "..", "frontend", "images", "resendlogo.png");
let logoBase64 = "";
let logoAttachmentNodemailer = null;
let logoAttachmentResend = null;
try {
  const logoBuffer = fs.readFileSync(logoPath);
  logoBase64 = logoBuffer.toString("base64");
  logoAttachmentNodemailer = {
    filename: "resendlogo.png",
    path: logoPath,
    cid: "logo@agricatch",
  };
  logoAttachmentResend = {
    filename: "resendlogo.png",
    content: logoBase64,
    content_id: "logo@agricatch",
    content_type: "image/png",
  };
} catch (err) {
  console.warn("⚠️ Email logo not found at", logoPath, "— emails will not include logo");
}

// Check if Resend API key is available (preferred for cloud deployments)
// Use Resend by default if API key is available, only use SMTP as fallback
let useResend = false;
let Resend;
// Only use SMTP if explicitly forced OR if Resend API key is not available
if (process.env.FORCE_SMTP === "true") {
  console.log("🔧 FORCE_SMTP enabled - Using SMTP instead of Resend");
} else {
  try {
    if (process.env.RESEND_API_KEY) {
      const resendModule = require("resend");
      Resend = resendModule.Resend || resendModule; // Handle both { Resend } and default export
      useResend = true;
      console.log("✅ Using Resend API for emails (cloud-friendly)");
    } else {
      console.log("⚠️ RESEND_API_KEY not found in process.env - falling back to SMTP");
      console.log("💡 Tip: Set RESEND_API_KEY in .env to use Resend API for emails");
    }
  } catch (error) {
    console.log("⚠️ Resend package not installed, falling back to SMTP");
    console.log("💡 Tip: Install resend package: npm install resend");
  }
}

// Create reusable transporter using SMTP (fallback only - not used if Resend is available)
let transporter = null;
if (!useResend) {
  console.log("📧 Initializing SMTP transporter (Resend not available, using SMTP fallback)");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // Your email
      pass: process.env.SMTP_PASSWORD, // Your email password or app password
    },
    // Add timeout and connection options (increased for cloud)
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000,
    socketTimeout: 60000,
    // Additional options for better connection
    requireTLS: true,
    // Try different connection approach
    pool: true,
    maxConnections: 1,
    maxMessages: 3
  });

  // Verify SMTP connection (only if using SMTP)
  transporter.verify(function (error, success) {
    if (error) {
      console.error("❌ SMTP connection error:", error);
      console.error("💡 Tip: Set RESEND_API_KEY in .env to use Resend API instead of SMTP");
    } else {
      console.log("✅ SMTP server is ready to send emails (fallback mode)");
    }
  });
} else {
  console.log("✅ Resend API is configured - SMTP will not be used");
}

/**
 * Send OTP email
 * @param {string} to - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} purpose - Purpose: 'login', 'register', 'reset_password'
 * @param {string} firstName - Recipient's first name for personalization
 * @returns {Promise}
 */
async function sendOtpEmail(to, otp, purpose = "login", firstName = null) {
  const purposeText = {
    login: "Login",
    register: "Registration",
    reset_password: "Password Reset",
  }[purpose] || "Verification";

  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .logo-img { max-width: 120px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
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
          <img src="cid:logo@agricatch" alt="AgriCatch Logo" class="logo-img" />
          <h1>AgriCatch</h1>
          <p>${purposeText} Verification</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>Your One-Time Password (OTP) for ${purposeText.toLowerCase()} is:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p>This OTP is valid for <strong>10 minutes</strong>.</p>
          <p class="warning">⚠️ Do not share this code with anyone. AgriCatch will never ask for your OTP.</p>
          <p>If you didn\'t request this code, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2026 AgriCatch. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    AgriCatch - ${purposeText} Verification
    
    ${greeting}
    
    Your OTP code is: ${otp}
    
    This OTP is valid for 10 minutes.
    
    Do not share this code with anyone.
    
    If you didn\'t request this code, please ignore this email.
  `;

  // Use Resend API if available (preferred for cloud)
  if (useResend && Resend) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      // Use RESEND_FROM_EMAIL if set, otherwise use default
      const fromEmail = process.env.RESEND_FROM_EMAIL || "AgriCatch <onboarding@resend.dev>";
      
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: `Your ${purposeText} OTP Code`,
        html: htmlContent,
        text: textContent,
        attachments: logoAttachmentResend ? [logoAttachmentResend] : undefined,
      });

      if (error) {
        console.error("❌ Resend email error object:", JSON.stringify(error, null, 2));
        const errorMessage = error.message || error.name || "Resend API error";
        return { success: false, error: errorMessage };
      }

      console.log(`✅ OTP email sent via Resend to ${to}:`, data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error("❌ Resend API error:", error);
      const errorMessage = error.message || "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  // Fallback to SMTP
  if (!transporter) {
    return { success: false, error: "No email service configured. Set RESEND_API_KEY or SMTP credentials." };
  }

  const mailOptions = {
    from: `"AgriCatch" <${process.env.SMTP_USER}>`,
    to: to,
    subject: `Your ${purposeText} OTP Code`,
    html: htmlContent,
    text: textContent,
    attachments: logoAttachmentNodemailer ? [logoAttachmentNodemailer] : undefined,
  };

  try {
    console.log(`📧 Preparing to send OTP email via SMTP to: ${to}`);
    console.log(`📧 SMTP config: host=${process.env.SMTP_HOST}, port=${process.env.SMTP_PORT}, user=${process.env.SMTP_USER}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${to}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    
    // Suggest Resend if SMTP fails
    if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
      console.error("💡 Tip: SMTP connection failed. Consider using Resend API (set RESEND_API_KEY) for cloud deployments.");
    }
    
    let errorMsg = error.message || "Unknown error";
    if (error.code) {
      errorMsg = `${errorMsg} (Code: ${error.code})`;
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Send welcome email after successful registration
 * @param {string} to - Recipient email address
 * @param {string} firstName - Recipient's first name
 * @param {string} role - User role (farmer, customer)
 * @returns {Promise}
 */
async function sendWelcomeEmail(to, firstName, role = "customer") {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .logo-img { max-width: 120px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .benefits { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .benefits ul { list-style: none; padding: 0; }
        .benefits li { padding: 8px 0; }
        .benefits li i { color: #2e7d32; margin-right: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="cid:logo@agricatch" alt="AgriCatch Logo" class="logo-img" />
          <h1>AgriCatch</h1>
          <p>Welcome</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>Welcome to AgriCatch! Your account has been successfully created.</p>
          ${role === 'farmer' ? `
          <div class="benefits">
            <h3>Farmer Benefits:</h3>
            <ul>
              <li>✓ Complete your verification to start selling</li>
              <li>✓ Add up to 10 products on the Free tier</li>
              <li>✓ Upgrade to Premium for unlimited products</li>
            </ul>
          </div>
          ` : `
          <div class="benefits">
            <h3>Customer Benefits:</h3>
            <ul>
              <li>✓ Browse fresh agricultural products</li>
              <li>✓ Order directly from local farmers</li>
              <li>✓ Track your orders in real-time</li>
            </ul>
          </div>
          `}
          <p>Thank you for joining our community!</p>
        </div>
        <div class="footer">
          <p>© 2026 AgriCatch. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    AgriCatch - Welcome
    
    ${greeting}
    
    Welcome to AgriCatch! Your account has been successfully created.
    
    ${role === 'farmer' ? `
    Farmer Benefits:
    - Complete your verification to start selling
    - Add up to 10 products on the Free tier
    - Upgrade to Premium for unlimited products
    ` : `
    Customer Benefits:
    - Browse fresh agricultural products
    - Order directly from local farmers
    - Track your orders in real-time
    `}
    
    Thank you for joining our community!
    
    © 2026 AgriCatch. All rights reserved.
  `;

  return await sendEmail(to, "Welcome to AgriCatch!", htmlContent, textContent);
}

/**
 * Send account verification email
 * @param {string} to - Recipient email address
 * @param {string} firstName - Recipient's first name
 * @returns {Promise}
 */
async function sendVerificationEmail(to, firstName) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .logo-img { max-width: 120px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .benefits { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .benefits ul { list-style: none; padding: 0; }
        .benefits li { padding: 8px 0; }
        .benefits li i { color: #2e7d32; margin-right: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="cid:logo@agricatch" alt="AgriCatch Logo" class="logo-img" />
          <h1>AgriCatch</h1>
          <p>Account Verification</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>Congratulations! Your farmer account has been verified.</p>
          <div class="benefits">
            <h3>You can now:</h3>
            <ul>
              <li>✓ Sell products (up to 10 on the Free tier)</li>
              <li>✓ Access basic analytics</li>
              <li>✓ Receive customer orders</li>
            </ul>
          </div>
          <div class="benefits">
            <h3>Upgrade to Premium for:</h3>
            <ul>
              <li>✓ Unlimited products</li>
              <li>✓ Priority search ranking</li>
              <li>✓ Custom product names</li>
              <li>✓ Advanced analytics</li>
            </ul>
          </div>
          <p>Thank you for joining AgriCatch!</p>
        </div>
        <div class="footer">
          <p>© 2026 AgriCatch. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    AgriCatch - Account Verification
    
    ${greeting}
    
    Congratulations! Your farmer account has been verified.
    
    You can now:
    - Sell products (up to 10 on the Free tier)
    - Access basic analytics
    - Receive customer orders
    
    Upgrade to Premium for:
    - Unlimited products
    - Priority search ranking
    - Custom product names
    - Advanced analytics
    
    Thank you for joining AgriCatch!
    
    © 2026 AgriCatch. All rights reserved.
  `;

  return await sendEmail(to, "Your AgriCatch Account Has Been Verified!", htmlContent, textContent);
}

/**
 * Send account unverification email
 * @param {string} to - Recipient email address
 * @param {string} firstName - Recipient's first name
 * @param {string} reason - Reason for unverification
 * @returns {Promise}
 */
async function sendUnverificationEmail(to, firstName, reason) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .logo-img { max-width: 120px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="cid:logo@agricatch" alt="AgriCatch Logo" class="logo-img" />
          <h1>AgriCatch</h1>
          <p>Account Status Update</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>Your farmer account verification has been revoked.</p>
          <div class="warning">
            <strong>Reason:</strong> ${reason}
          </div>
          <p>Product creation and sales features are now disabled. If you believe this is an error, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>© 2026 AgriCatch. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    AgriCatch - Account Status Update
    
    ${greeting}
    
    Your farmer account verification has been revoked.
    
    Reason: ${reason}
    
    Product creation and sales features are now disabled. If you believe this is an error, please contact our support team.
    
    © 2026 AgriCatch. All rights reserved.
  `;

  return await sendEmail(to, "Important: Your AgriCatch Account Verification Has Been Revoked", htmlContent, textContent);
}

/**
 * Send premium upgrade email
 * @param {string} to - Recipient email address
 * @param {string} firstName - Recipient's first name
 * @returns {Promise}
 */
async function sendPremiumUpgradeEmail(to, firstName) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #9333ea; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .logo-img { max-width: 120px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .benefits { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .benefits ul { list-style: none; padding: 0; }
        .benefits li { padding: 8px 0; }
        .benefits li i { color: #9333ea; margin-right: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="cid:logo@agricatch" alt="AgriCatch Logo" class="logo-img" />
          <h1>AgriCatch</h1>
          <p>Premium Upgrade</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>Congratulations! You are now a Premium Partner.</p>
          <div class="benefits">
            <h3>Your Premium benefits:</h3>
            <ul>
              <li>✓ Unlimited products</li>
              <li>✓ Priority search ranking</li>
              <li>✓ Custom product names</li>
              <li>✓ Advanced analytics</li>
              <li>✓ Premium badge on customer page</li>
            </ul>
          </div>
          <p>Thank you for your support!</p>
        </div>
        <div class="footer">
          <p>© 2026 AgriCatch. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    AgriCatch - Premium Upgrade
    
    ${greeting}
    
    Congratulations! You are now a Premium Partner.
    
    Your Premium benefits:
    - Unlimited products
    - Priority search ranking
    - Custom product names
    - Advanced analytics
    - Premium badge on customer page
    
    Thank you for your support!
    
    © 2026 AgriCatch. All rights reserved.
  `;

  return await sendEmail(to, "Welcome to AgriCatch Premium!", htmlContent, textContent);
}

/**
 * Send premium expired email
 * @param {string} to - Recipient email address
 * @param {string} firstName - Recipient's first name
 * @param {string} reason - Optional reason for expiration
 * @returns {Promise}
 */
async function sendPremiumExpiredEmail(to, firstName, reason = null) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f57c00; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .logo-img { max-width: 120px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .benefits { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .benefits ul { list-style: none; padding: 0; }
        .benefits li { padding: 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="cid:logo@agricatch" alt="AgriCatch Logo" class="logo-img" />
          <h1>AgriCatch</h1>
          <p>Premium Status Update</p>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>Your Premium subscription has expired.</p>
          ${reason ? `<div class="warning"><strong>Reason:</strong> ${reason}</div>` : ''}
          <div class="benefits">
            <h3>Your account has been downgraded to the Free tier:</h3>
            <ul>
              <li>• Product limit: 10 products</li>
              <li>• Standard search ranking</li>
              <li>• Basic analytics only</li>
            </ul>
          </div>
          <p><strong>To restore Premium benefits:</strong></p>
          <ul>
            <li>• Renew your subscription from your dashboard</li>
            <li>• Contact support if you believe this is an error</li>
          </ul>
          <p>Thank you for being part of AgriCatch!</p>
        </div>
        <div class="footer">
          <p>© 2026 AgriCatch. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    AgriCatch - Premium Status Update
    
    ${greeting}
    
    Your Premium subscription has expired.
    ${reason ? `Reason: ${reason}` : ''}
    
    Your account has been downgraded to the Free tier:
    - Product limit: 10 products
    - Standard search ranking
    - Basic analytics only
    
    To restore Premium benefits:
    - Renew your subscription from your dashboard
    - Contact support if you believe this is an error
    
    Thank you for being part of AgriCatch!
    
    © 2026 AgriCatch. All rights reserved.
  `;

  return await sendEmail(to, "Your AgriCatch Premium Subscription Has Expired", htmlContent, textContent);
}

/**
 * Generic email sender function (used by all email functions)
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text content
 * @returns {Promise}
 */
async function sendEmail(to, subject, html, text) {
  // Use Resend API if available (preferred for cloud)
  if (useResend && Resend) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = process.env.RESEND_FROM_EMAIL || "AgriCatch <onboarding@resend.dev>";
      
      console.log(`📧 Sending email via Resend to: ${to}, subject: ${subject}`);
      
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: html,
        text: text,
        attachments: logoAttachmentResend ? [logoAttachmentResend] : undefined,
      });

      if (error) {
        console.error("❌ Resend email error:", error);
        const errorMessage = error.message || error.name || "Resend API error";
        return { success: false, error: errorMessage };
      }

      console.log(`✅ Email sent via Resend to ${to}:`, data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error("❌ Resend API error:", error);
      const errorMessage = error.message || "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  // Fallback to SMTP
  if (!transporter) {
    return { success: false, error: "No email service configured. Set RESEND_API_KEY or SMTP credentials." };
  }

  const mailOptions = {
    from: `"AgriCatch" <${process.env.SMTP_USER}>`,
    to: to,
    subject: subject,
    html: html,
    text: text,
    attachments: logoAttachmentNodemailer ? [logoAttachmentNodemailer] : undefined,
  };

  try {
    console.log(`📧 Sending email via SMTP to: ${to}, subject: ${subject}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    let errorMsg = error.message || "Unknown error";
    if (error.code) {
      errorMsg = `${errorMsg} (Code: ${error.code})`;
    }
    return { success: false, error: errorMsg };
  }
}

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendUnverificationEmail,
  sendPremiumUpgradeEmail,
  sendPremiumExpiredEmail,
  transporter,
};
