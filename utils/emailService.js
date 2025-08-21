const nodemailer = require("nodemailer")

// Create email transporter
const createTransporter = () => {
  // For development, you can use Gmail or any SMTP service
  // In production, use services like SendGrid, AWS SES, etc.
  return nodemailer.createTransporter({
    service: "gmail", // or your preferred email service
    auth: {
      user: process.env.EMAIL_USER, // Your email
      pass: process.env.EMAIL_PASS, // Your email password or app password
    },
  })
}

// Send OTP via email
const sendEmailOTP = async (email, otp, userName = "User") => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        `[EMAIL ERROR] Email service not configured. Missing EMAIL_USER or EMAIL_PASS environment variables.`,
      )
      console.log(`[MOCK EMAIL] OTP ${otp} would be sent to ${email}`)
      console.log(`[SETUP REQUIRED] Please add EMAIL_USER and EMAIL_PASS to your .env file`)
      return false // Return false to indicate email wasn't sent
    }

    const transporter = createTransporter()

    await transporter.verify()
    console.log("Email server connection verified")

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Vezoh - Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Vezoh Password Reset</h2>
          <p>Hello ${userName},</p>
          <p>You requested to reset your password. Use the following OTP to reset your password:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563eb; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>Vezoh Team</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Password reset OTP sent successfully to ${email}`)
    return true
  } catch (error) {
    console.error(`Failed to send email OTP to ${email}:`, error.message)
    if (error.code === "EAUTH") {
      console.error("[EMAIL ERROR] Authentication failed. Check your EMAIL_USER and EMAIL_PASS credentials.")
    } else if (error.code === "ECONNECTION") {
      console.error("[EMAIL ERROR] Connection failed. Check your internet connection and email service settings.")
    }
    // Log OTP for development purposes
    console.log(`[FALLBACK] OTP for ${email}: ${otp}`)
    return false
  }
}

module.exports = {
  sendEmailOTP,
}
