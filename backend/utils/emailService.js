const nodemailer = require("nodemailer");
require("dotenv").config();

// Check if Resend API key is available (preferred for cloud deployments)
// TEMPORARILY DISABLED FOR SMTP TESTING - Set FORCE_SMTP=true to test SMTP
let useResend = false;
let Resend;
if (process.env.FORCE_SMTP !== "true") {
  try {
    if (process.env.RESEND_API_KEY) {
      console.log("DEBUG: RESEND_API_KEY detected. Length:", process.env.RESEND_API_KEY.length);
      const resendModule = require("resend");
      Resend = resendModule.Resend || resendModule; // Handle both { Resend } and default export
      useResend = true;
      console.log("✅ Using Resend API for emails (cloud-friendly)");
    } else {
      console.log("DEBUG: RESEND_API_KEY not found in process.env");
    }
  } catch (error) {
    console.log("⚠️ Resend package not installed, falling back to SMTP");
  }
} else {
  console.log("🔧 FORCE_SMTP enabled - Using SMTP instead of Resend");
}

// Create reusable transporter using SMTP (fallback)
let transporter = null;
if (!useResend) {
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

  // Verify SMTP connection
  transporter.verify(function (error, success) {
    if (error) {
      console.error("❌ SMTP connection error:", error);
      console.error("💡 Tip: Consider using Resend API (RESEND_API_KEY) for cloud deployments");
    } else {
      console.log("✅ SMTP server is ready to send emails");
    }
  });
}

/**
 * Send OTP email
 * @param {string} to - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} purpose - Purpose: 'login', 'register', 'reset_password'
 * @returns {Promise}
 */
async function sendOtpEmail(to, otp, purpose = "login") {
  const purposeText = {
    login: "Login",
    register: "Registration",
    reset_password: "Password Reset",
  }[purpose] || "Verification";

  const htmlContent = `
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
          <p>If you didn\'t request this code, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AgriCatch. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    AgriCatch - ${purposeText} Verification
    
    Your OTP code is: ${otp}
    
    This OTP is valid for 10 minutes.
    
    Do not share this code with anyone.
    
    If you didn\'t request this code, please ignore this email.
  `;

  // Use Resend API if available (preferred for cloud)
  if (useResend && Resend) {
    try {
      console.log("DEBUG: Attempting to initialize Resend with API Key:", process.env.RESEND_API_KEY ? "*****" + process.env.RESEND_API_KEY.slice(-4) : "undefined");
      const resend = new Resend(process.env.RESEND_API_KEY);
      console.log(`📧 Sending OTP email via Resend to: ${to}`);
      
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "AgriCatch <onboarding@resend.dev>",
        to: [to],
        subject: `Your ${purposeText} OTP Code`,
        html: htmlContent,
        text: textContent,
      });

      if (error) {
        console.error("❌ Resend email error object:", JSON.stringify(error, null, 2));
        return { success: false, error: error.message || error.name || "Resend API error" };
      }

      console.log(`✅ OTP email sent via Resend to ${to}:`, data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error("❌ Resend API error:", error);
      return { success: false, error: error.message };
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

module.exports = {
  sendOtpEmail,
  transporter,
};
