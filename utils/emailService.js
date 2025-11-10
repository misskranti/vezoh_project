const nodemailer = require("nodemailer");

// 🔹 Common transporter setup
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// 🔹 Common reusable sender
const sendEmail = async (to, subject, html) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("[EMAIL ERROR] Missing EMAIL_USER or EMAIL_PASS in .env");
      console.log(`[MOCK EMAIL] ${subject} would be sent to ${to}`);
      return false;
    }

    const transporter = createTransporter();
    await transporter.verify();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[DEBUG] Email sent successfully to ${to}:`, info.response);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error.message);
    return false;
  }
};

//
// 🔹 1️⃣ Registration Email Verification OTP
//
const sendEmailVerificationOTP = async (email, otp, userName = "User") => {
  const html = `
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
  `;
  return sendEmail(email, "Vezoh - Email Verification OTP", html);
};

//
// 🔹 2️⃣ Pickup OTP (for Ride, Parcel, Freight)
//
const sendPickupOTPEmail = async (email, otp, userName = "User", type = "Ride", referenceId) => {
  const subject = `Vezoh - ${type} Pickup OTP`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">${type} Pickup Verification</h2>
      <p>Hello ${userName},</p>
      <p>Your ${type.toLowerCase()} ${
        referenceId ? `(<strong>${referenceId}</strong>)` : ""
      } is scheduled for pickup. Please share the OTP below with the pickup agent to verify your pickup:</p>
      <div style="background-color: #fff7ed; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">${otp}</h1>
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>Thank you for choosing <strong>Vezoh</strong>.</p>
      <p>Best regards,<br>Vezoh Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

//
// 🔹 3️⃣ Pre-Delivery OTP (for Parcel, Freight)
//
const sendPreDeliveryOTPEmail = async (email, otp, userName = "User", type = "Parcel", referenceId) => {
  const subject = `Vezoh - ${type} Pre-Delivery OTP`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #eab308;">${type} Pre-Delivery Verification</h2>
      <p>Hello ${userName},</p>
      <p>Your ${type.toLowerCase()} ${
        referenceId ? `(<strong>${referenceId}</strong>)` : ""
      } is reached for delivery. Please share the OTP below with the delivery agent to verify your delivery:</p>
      <div style="background-color: #fef9c3; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #eab308; font-size: 32px; margin: 0;">${otp}</h1>
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>Thank you for using <strong>Vezoh</strong>.</p>
      <p>Best regards,<br>Vezoh Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

//
// 🔹 4️⃣ Delivery Completed Confirmation
//
const sendDeliveryCompletedEmail = async (email, userName = "User", type = "Parcel", referenceId) => {
  const subject = `Vezoh - ${type} Delivered Successfully`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">${type} Delivered Successfully!</h2>
      <p>Hello ${userName},</p>
      <p>We’re happy to inform you that your ${type.toLowerCase()} ${
        referenceId ? `(<strong>${referenceId}</strong>)` : ""
      } has been successfully delivered.</p>
      <p>We hope you had a smooth experience with <strong>Vezoh</strong>.</p>
      <p>If you have any feedback, please contact our support team.</p>
      <p>Thank you for trusting us!</p>
      <p>Best regards,<br>Vezoh Team</p>
    </div>
  `;
  return sendEmail(email, subject, html);
};

module.exports = {
  sendEmailVerificationOTP,
  sendPickupOTPEmail,
  sendPreDeliveryOTPEmail,
  sendDeliveryCompletedEmail,
};
