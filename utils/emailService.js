const nodemailer = require("nodemailer")

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

// Send Email Verification OTP
const sendEmailVerificationOTP = async (email, otp, userName = "User") => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        `[EMAIL ERROR] Email service not configured. Missing EMAIL_USER or EMAIL_PASS environment variables.`,
      )
      console.log(`[MOCK EMAIL] Verification OTP ${otp} would be sent to ${email}`)
      console.log(`[SETUP REQUIRED] Please add EMAIL_USER and EMAIL_PASS to your .env file`)
      return false
    }

    const transporter = createTransporter()
    await transporter.verify()

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Vezoh - Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Vezoh!</h2>
          <p>Hello ${userName},</p>
          <p>Thank you for registering with Vezoh. Please verify your email address using the OTP below:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563eb; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't create this account, please ignore this email.</p>
          <p>Best regards,<br>Vezoh Team</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Email verification OTP sent successfully to ${email}`)
    return true
  } catch (error) {
    console.error(`Failed to send verification OTP to ${email}:`, error.message)
    console.log(`[FALLBACK] Verification OTP for ${email}: ${otp}`)
    return false
  }
}

// Send Password Reset OTP
const sendPasswordResetOTP = async (email, otp, userName = "User") => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error(
        `[EMAIL ERROR] Email service not configured. Missing EMAIL_USER or EMAIL_PASS environment variables.`,
      )
      console.log(`[MOCK EMAIL] Password Reset OTP ${otp} would be sent to ${email}`)
      console.log(`[SETUP REQUIRED] Please add EMAIL_USER and EMAIL_PASS to your .env file`)
      return false
    }

    const transporter = createTransporter()
    await transporter.verify()

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Vezoh - Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Vezoh Password Reset</h2>
          <p>Hello ${userName},</p>
          <p>You requested to reset your password. Use the following OTP to create a new password:</p>
          <div style="background-color: #fef2f2; padding: 20px; text-align: center; margin: 20px 0; border: 2px solid #dc2626;">
            <h1 style="color: #dc2626; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p><strong>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</strong></p>
          <p>Best regards,<br>Vezoh Team</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Password reset OTP sent successfully to ${email}`)
    return true
  } catch (error) {
    console.error(`Failed to send password reset OTP to ${email}:`, error.message)
    console.log(`[FALLBACK] Password Reset OTP for ${email}: ${otp}`)
    return false
  }
}

module.exports = {
  sendEmailVerificationOTP,
  sendPasswordResetOTP
}
