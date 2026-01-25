const nodemailer = require('nodemailer');
require('dotenv').config();

// Create reusable transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // Your email
    pass: process.env.SMTP_PASSWORD, // Your email password or app password
  },
  // Add timeout and connection options
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Verify SMTP connection
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ SMTP connection error:', error);
  } else {
    console.log('✅ SMTP server is ready to send emails');
  }
});

/**
 * Send OTP email
 * @param {string} to - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} purpose - Purpose: 'login', 'register', 'reset_password'
 * @returns {Promise}
 */
async function sendOtpEmail(to, otp, purpose = 'login') {
  const purposeText = {
    login: 'Login',
    register: 'Registration',
    reset_password: 'Password Reset',
  }[purpose] || 'Verification';

  const mailOptions = {
    from: `"AgriCatch" <${process.env.SMTP_USER}>`,
    to: to,
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
    text: `
      AgriCatch - ${purposeText} Verification
      
      Your OTP code is: ${otp}
      
      This OTP is valid for 10 minutes.
      
      Do not share this code with anyone.
      
      If you didn't request this code, please ignore this email.
    `,
  };

  try {
    console.log(`📧 Preparing to send OTP email to: ${to}`);
    console.log(`📧 SMTP config: host=${process.env.SMTP_HOST}, port=${process.env.SMTP_PORT}, user=${process.env.SMTP_USER}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${to}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    });
    // Return a more descriptive error message
    let errorMsg = error.message || 'Unknown error';
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
