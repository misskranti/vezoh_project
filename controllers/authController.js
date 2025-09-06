const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/driver");
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers");
const { sendEmailVerificationOTP } = require("../utils/emailService");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// ---------------------- REGISTER USER ----------------------

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone)
      return res.status(400).json({ success: false, message: "Please provide all required fields" });
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: "Please provide a valid email address" });
    if (!isValidPhone(phone)) return res.status(400).json({ success: false, message: "Please provide a valid phone number" });

    const formattedPhone = formatPhoneNumber(phone);

    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }] });
    if (existingUser)
      return res.status(400).json({ success: false, message: "User already exists with this email or phone number." });

    const otp = generateOTP().toString();
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      isVerified: false,
    });

    await user.save();

    await sendEmailVerificationOTP(user.email, otp, user.name);

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email for the verification code.",
      data: { id: user._id.toString() },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

// ---------------------- REGISTER DRIVER ----------------------

exports.registerDriver = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone)
      return res.status(400).json({ success: false, message: "Please provide all required fields" });
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: "Please provide a valid email address" });
    if (!isValidPhone(phone)) return res.status(400).json({ success: false, message: "Please provide a valid phone number" });

    const formattedPhone = formatPhoneNumber(phone);

    const existingDriver = await Driver.findOne({ $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }] });
    if (existingDriver)
      return res.status(400).json({ success: false, message: "Driver already exists with this email or phone number" });

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
      loginOtpVerified: false
    });

    await driver.save();

    await sendEmailVerificationOTP(driver.email, otp, driver.name);

    res.status(201).json({
      success: true,
      message: "Driver registered successfully. Please check your email for the verification code.",
      data: { id: driver._id.toString() },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

// ---------------------- LOGIN USER ---------------------------

exports.loginUser = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ success: false, message: "User not found" });

    const now = new Date();
    let otp;

    if (!user.loginVerificationCode || user.loginOtpExpiry < now || user.loginOtpVerified) {
      otp = generateOTP().toString();
      user.loginVerificationCode = otp;
      user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.loginOtpVerified = false;
      await user.save();
      console.log(`[LOGIN] Generated new OTP for ${user.email}: ${otp}`);
    } else {
      otp = user.loginVerificationCode;
      console.log(`[LOGIN] Reusing OTP for ${user.email}: ${otp}`);
    }

    await sendEmailVerificationOTP(user.email, otp, user.name);

    res.json({ success: true, message: "Login OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
};

// ---------------------- LOGIN DRIVER ----------------------

exports.loginDriver = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const driver = await Driver.findOne({ email: email.toLowerCase() });
    if (!driver) return res.status(400).json({ success: false, message: "Driver not found" });

    const now = new Date();
    let otp;

    if (!driver.loginVerificationCode || driver.loginOtpExpiry < now || driver.loginOtpVerified) {
      otp = generateOTP().toString();
      driver.loginVerificationCode = otp;
      driver.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
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
    res.status(500).json({ success: false, message: "Server error during login" });
  }
};

// ---------------------- VERIFY EMAIL OTP ----------------------

// Verify Email OTP for Users
exports.verifyUserEmailOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    if (!email || !otp || !type) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, otp, and type",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let token = "";

    if (type === "registration") {
      if (!user.verificationCode || user.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Email already verified or OTP not found",
        });
      }

      if (
        user.verificationCode.toString() !== otp.toString() ||
        !user.otpExpiry ||
        user.otpExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }

      user.isVerified = true;
      user.verificationCode = null;
      user.otpExpiry = null;
      await user.save();

      token = generateToken(user._id, "user");

      return res.json({
        success: true,
        message: "User email verified successfully",
        data: { id: user._id.toString(), token },
      });
    }

    if (type === "login") {
      if (!user.loginVerificationCode || user.loginOtpVerified) {
        return res.status(400).json({
          success: false,
          message: "No pending login verification found",
        });
      }

      if (
        user.loginVerificationCode.toString() !== otp.toString() ||
        !user.loginOtpExpiry ||
        user.loginOtpExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }

      user.loginOtpVerified = true;
      user.loginVerificationCode = null;
      user.loginOtpExpiry = null;
      await user.save();

      token = generateToken(user._id, "user");

      return res.json({
        success: true,
        message: "User login verified successfully",
        data: { id: user._id.toString(), token },
      });
    }
  } catch (err) {
    console.error("User OTP verification error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during User OTP verification",
    });
  }
};


//  Verify Email OTP for Drivers
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

      driver.isVerified = true;
      driver.verificationCode = null;
      driver.otpExpiry = null;
      await driver.save();

      token = generateToken(driver._id, "driver");

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

      driver.loginOtpVerified = true;
      driver.loginVerificationCode = null;
      driver.loginOtpExpiry = null;
      await driver.save();

      token = generateToken(driver._id, "driver");

      return res.json({
        success: true,
        message: "Driver login verified successfully",
        data: { id: driver._id.toString(), token },
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

exports.resendUserEmailOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and type",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (type === "registration") {
      if (user.isVerified) {
        return res
          .status(400)
          .json({ success: false, message: "Email already verified" });
      }

      const otp = generateOTP().toString();
      user.verificationCode = otp;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendEmailVerificationOTP(user.email, otp, user.name);

      return res.json({
        success: true,
        message: "Registration OTP resent successfully",
      });
    }

    if (type === "login") {
      if (user.loginOtpVerified) {
        return res.status(400).json({
          success: false,
          message: "OTP already verified. You're logged in.",
        });
      }

      const otp = generateOTP().toString();
      user.loginVerificationCode = otp;
      user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.loginOtpVerified = false;
      await user.save();

      await sendEmailVerificationOTP(user.email, otp, user.name);

      return res.json({
        success: true,
        message: "Login OTP resent successfully",
      });
    }

    return res.status(400).json({ success: false, message: "Invalid type" });
  } catch (err) {
    console.error("resendUserEmailOtp error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during resend OTP",
    });
  }
};


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


// ---------------------- GET PROFILE ----------------------

exports.getProfile = async (req, res) => {
  try {
    const Model = req.role === "user" ? User : Driver;
    const user = await Model.findById(req.user._id).select("-password -verificationCode");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: { [req.role]: user } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error while fetching user info" });
  }
};

// ---------------------- LOGOUT --------------------------

exports.logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error during logout" });
  }
};

