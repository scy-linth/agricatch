const express = require('express');
require('dotenv').config();

const router = express.Router();

/**
 * Send contact form message
 * POST /api/contact
 * Body: { name: string, email: string, subject: string, message: string }
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        message: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format' 
      });
    }

    // Prepare internal notification email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
          .field { margin-bottom: 20px; }
          .field-label { font-weight: bold; color: #2e7d32; margin-bottom: 5px; }
          .field-value { background: white; padding: 10px; border-radius: 4px; border-left: 3px solid #2e7d32; }
          .message-box { background: white; padding: 15px; border-radius: 4px; border-left: 3px solid #0ea5e9; min-height: 100px; white-space: pre-wrap; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 New Contact Form Message</h1>
            <p>AgriCatch Website</p>
          </div>
          <div class="content">
            <div class="field">
              <div class="field-label">👤 Name:</div>
              <div class="field-value">${name}</div>
            </div>
            <div class="field">
              <div class="field-label">📧 Email:</div>
              <div class="field-value">${email}</div>
            </div>
            <div class="field">
              <div class="field-label">📌 Subject:</div>
              <div class="field-value">${subject}</div>
            </div>
            <div class="field">
              <div class="field-label">💬 Message:</div>
              <div class="message-box">${message}</div>
            </div>
            <div class="footer">
              <p>This message was sent from the AgriCatch contact form</p>
              <p>© ${new Date().getFullYear()} AgriCatch. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
New Contact Form Message - AgriCatch Website

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This message was sent from the AgriCatch contact form
© ${new Date().getFullYear()} AgriCatch. All rights reserved.
    `;

    const ackHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px; }
          .summary { background: white; border-left: 4px solid #2e7d32; padding: 12px 14px; border-radius: 6px; margin-top: 14px; }
          .muted { color: #6b7280; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank you for contacting AgriCatch</h1>
            <p>We received your message successfully.</p>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>Thank you for reaching out. We have received your message and our team will review it as soon as possible.</p>
            <div class="summary">
              <strong>Your submitted details</strong><br>
              Name: ${name}<br>
              Email: ${email}<br>
              Subject: ${subject}<br>
              Message: ${message}
            </div>
            <p class="muted">If you need urgent assistance, you may also contact us at agricatchph@gmail.com.</p>
            <p>Best regards,<br>AgriCatch Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const ackTextContent = `
Hello ${name},

Thank you for contacting AgriCatch. We received your message and will review it soon.

Your submitted details:
Name: ${name}
Email: ${email}
Subject: ${subject}
Message: ${message}

Best regards,
AgriCatch Team
    `;

    // Send email to agricatchph@gmail.com
    const recipientEmail = 'agricatchph@gmail.com';
    const nodemailer = require('nodemailer');
    const { Resend } = require('resend');
    
    let emailSent = false;
    let emailError = null;
    
    // Try Resend first (preferred)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'AgriCatch <onboarding@resend.dev>';
        
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: [recipientEmail],
          replyTo: email, // Allow replying directly to the sender
          subject: `Contact Form: ${subject}`,
          html: htmlContent,
          text: textContent,
        });

        if (error) {
          emailError = error.message || 'Resend API error';
          console.error('❌ Resend email error:', error);
        } else {
          emailSent = true;
          console.log(`✅ Contact form email sent via Resend to ${recipientEmail}:`, data.id);
        }
      } catch (err) {
        emailError = err.message;
        console.error('❌ Resend API error:', err);
      }
    }
    
    // Fallback to SMTP if Resend fails or not configured
    if (!emailSent && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        const mailOptions = {
          from: `"AgriCatch Contact Form" <${process.env.SMTP_USER}>`,
          to: recipientEmail,
          replyTo: email,
          subject: `Contact Form: ${subject}`,
          html: htmlContent,
          text: textContent,
        };

        const info = await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log(`✅ Contact form email sent via SMTP to ${recipientEmail}:`, info.messageId);
      } catch (err) {
        emailError = err.message;
        console.error('❌ SMTP email error:', err);
      }
    }

    if (!emailSent) {
      return res.status(500).json({
        message: 'Failed to send contact form message. Please try again later.',
        error: emailError || 'No email service configured'
      });
    }

    // Send acknowledgment email to the user (best effort)
    try {
      const nodemailer = require('nodemailer');
      const { Resend } = require('resend');
      let ackSent = false;

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'AgriCatch <onboarding@resend.dev>';
        const { error } = await resend.emails.send({
          from: fromEmail,
          to: [email],
          subject: `We received your message: ${subject}`,
          html: ackHtmlContent,
          text: ackTextContent,
        });
        if (!error) ackSent = true;
      }

      if (!ackSent && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        await transporter.sendMail({
          from: `"AgriCatch" <${process.env.SMTP_USER}>`,
          to: email,
          subject: `We received your message: ${subject}`,
          html: ackHtmlContent,
          text: ackTextContent,
        });
      }
    } catch (ackError) {
      console.warn('⚠️ Contact acknowledgment email failed:', ackError?.message || ackError);
    }

    res.json({
      message: 'Thank you for contacting us! We will get back to you soon.',
      success: true
    });
  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({ 
      message: 'Server error processing contact form',
      error: error.message 
    });
  }
});

module.exports = router;
