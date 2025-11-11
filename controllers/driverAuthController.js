const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/driver");
const {generateOTP,formatPhoneNumber,isValidEmail,isValidPhone,generateUniquePhone} = require("../utils/helpers");
const { sendEmailVerificationOTP } = require("../utils/emailService");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};


exports.sendDriverEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // Case 4: Empty email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user exists
    let driver = await Driver.findOne({ email: email.toLowerCase() });

    // Case 3: User exists AND verified → Block registration
    if (driver && driver.isVerified) {
      return res.status(400).json({
        success: false,
        message: "User already exists. Please sign in.",
      });
    }

    // Case 2: User exists but NOT verified → Resend OTP
    if (driver && !driver.isVerified) {
      const otp = generateOTP().toString();
      driver.verificationCode = otp;
      driver.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await driver.save();

      await sendEmailVerificationOTP(driver.email, otp, driver.name || "User");

      return res.status(200).json({
        success: true,
        message: "New OTP sent successfully to your email.",
      });
    }

    // Case 1: New driver → Create and send OTP
    const otp = generateOTP().toString();
    const newUser = new Driver({
      name: "dummy",
      email: email.toLowerCase(),
      phone: generateUniquePhone(),
      isVerified: false,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    await newUser.save(); 

    await sendEmailVerificationOTP(newUser.email, otp, newUser.name || "Driver");

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email.", 
    });

  } catch (err) {
    console.error("sendUserEmailOtp error:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};


// ---------------------- REGISTER DRIVER ----------------------

exports.registerDriver = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone)
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    if (!isValidEmail(email))
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    if (!isValidPhone(phone))
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number",
      });

    const formattedPhone = formatPhoneNumber(phone);

    const existingDriver = await Driver.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    });
    if (existingDriver)
      return res.status(400).json({
        success: false,
        message: "Driver already exists with this email or phone number",
      });

    const otp = generateOTP().toString();
    const driver = new Driver({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      isVerified: false,
      loginVerificationCode: null,
      loginOtpExpiry: null,
      loginOtpVerified: false,
    });

    await driver.save();

    await sendEmailVerificationOTP(driver.email, otp, driver.name);

    return res.status(201).json({
      success: true,
      message:
        "Driver registered successfully. Please check your email for the verification code.",
      data: { id: driver._id.toString() },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Server error during registration" });
  }
};

// ---------------------- LOGIN DRIVER ----------------------

exports.loginDriver = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email required" });

    const driver = await Driver.findOne({ email: email.toLowerCase() });
    if (!driver)
      return res
        .status(400)
        .json({ success: false, message: "Driver not found" });

    const now = new Date();
    let otp;

    if (
      !driver.loginVerificationCode ||
      driver.loginOtpExpiry < now ||
      driver.loginOtpVerified
    ) {
      otp = generateOTP().toString();
      driver.loginVerificationCode = otp;
      driver.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      driver.loginOtpVerified = false;
      await driver.save();
      console.log(`[LOGIN] Generated new OTP for ${driver.email}: ${otp}`);
    } else {
      otp = driver.loginVerificationCode;
      console.log(`[LOGIN] Reusing OTP for ${driver.email}: ${otp}`);
    }
    await sendEmailVerificationOTP(driver.email, otp, driver.name);

    res.json({ success: true, message: "Login OTP sent to your email" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Server error during login" });
  }
};

// ---------------------- VERIFY EMAIL OTP ----------------------

exports.verifyDriverEmailOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    if (!email || !otp || !type) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, otp, and type",
      });
    }

    const driver = await Driver.findOne({ email: email.toLowerCase() });
    if (!driver) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    let token = "";

    if (type === "registration") {
      if (!driver.verificationCode || driver.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Email already verified or OTP not found",
        });
      }

      if (
        driver.verificationCode.toString() !== otp.toString() ||
        !driver.otpExpiry ||
        driver.otpExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }

      token = generateToken(driver._id, "driver");
      driver.isVerified = true;
      driver.verificationCode = null;
      driver.otpExpiry = null;
      driver.driverToken = token ;
      await driver.save();

      return res.json({
        success: true,
        message: "Driver email verified successfully",
        data: { id: driver._id.toString(), token },
      });
    }

    if (type === "login") {
      if (!driver.loginVerificationCode || driver.loginOtpVerified) {
        return res.status(400).json({
          success: false,
          message: "No pending login verification found",
        });
      }

      if (
        driver.loginVerificationCode.toString() !== otp.toString() ||
        !driver.loginOtpExpiry ||
        driver.loginOtpExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }
      token = generateToken(driver._id, "driver");
      driver.loginOtpVerified = true;
      driver.loginVerificationCode = null;
      driver.loginOtpExpiry = null;
      driver.driverToken = token ;
      await driver.save();


      return res.json({
        success: true,
        message: "Driver login verified successfully",
        data: { id: driver._id.toString()},
      });
    }
  } catch (err) {
    console.error("Driver OTP verification error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during Driver OTP verification",
    });
  }
};

// ---------------------- RESEND EMAIL OTP ----------------------

exports.resendDriverEmailOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and type",
      });
    }

    const driver = await Driver.findOne({ email: email.toLowerCase() });
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    if (type === "registration") {
      if (driver.isVerified) {
        return res
          .status(400)
          .json({ success: false, message: "Email already verified" });
      }

      const otp = generateOTP().toString();
      driver.verificationCode = otp;
      driver.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await driver.save();

      await sendEmailVerificationOTP(driver.email, otp, driver.name);

      return res.json({
        success: true,
        message: "Registration OTP resent successfully",
      });
    }

    if (type === "login") {
      if (driver.loginOtpVerified) {
        return res.status(400).json({
          success: false,
          message: "OTP already verified. You're logged in.",
        });
      }

      const otp = generateOTP().toString();
      driver.loginVerificationCode = otp;
      driver.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      driver.loginOtpVerified = false;
      await driver.save();

      await sendEmailVerificationOTP(driver.email, otp, driver.name);

      return res.json({
        success: true,
        message: "Login OTP resent successfully",
      });
    }

    return res.status(400).json({ success: false, message: "Invalid type" });
  } catch (err) {
    console.error("resendDriverEmailOtp error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during resend OTP",
    });
  }
};