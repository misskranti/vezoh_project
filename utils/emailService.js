const nodemailer = require("nodemailer");

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, 
    },
  });
};

const sendEmailVerificationOTP = async (email, otp, userName = "User") => {
  try {
    console.log(`[DEBUG] sendEmailVerificationOTP called for ${email} with OTP ${otp}`);

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("[EMAIL ERROR] Missing EMAIL_USER or EMAIL_PASS in .env");
      console.log(`[MOCK EMAIL] OTP ${otp} would be sent to ${email}`);
      return false;
    }

    const transporter = createTransporter();

    await transporter.verify();
    console.log(`[DEBUG] SMTP transporter verified successfully`);

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
    };

    await transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error(`[EMAIL SEND ERROR] Failed to send OTP to ${email}:`, err.message);
        console.log(`[FALLBACK] OTP for ${email}: ${otp}`);
      } else {
        console.log(`[DEBUG] OTP email sent successfully to ${email}`);
        console.log(`[DEBUG] SMTP Response:`, info.response);
      }
    });

    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send verification OTP to ${email}:`, error.message);
    console.log(`[FALLBACK] Verification OTP for ${email}: ${otp}`);
    return false;
  }
};

module.exports = { sendEmailVerificationOTP };
