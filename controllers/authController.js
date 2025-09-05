const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/driver");
const {
  generateOTP,
  formatPhoneNumber,
  isValidEmail,
  isValidPhone,
} = require("../utils/helpers");
const { sendEmailVerificationOTP } = require("../utils/emailService");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// ---------------------- REGISTER USER ----------------------

exports.registerUser = async (req, res) => {
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

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    });
    if (existingUser)
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or phone number.",
      });

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

    return res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for the verification code.",
      data: { id: user._id.toString() },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Server error during registration" });
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

// ---------------------- LOGIN USER ---------------------------

exports.loginUser = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "User not found" });

    const now = new Date();
    let otp;

    if (
      !user.loginVerificationCode ||
      user.loginOtpExpiry < now ||
      user.loginOtpVerified
    ) {
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
    return res
      .status(500)
      .json({ success: false, message: "Server error during login" });
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
      driver.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      driver.loginOtpVerified = false;
      await driver.save();
      console.log(`[LOGIN] Generated new OTP for ${driver.email}: ${otp}`);
    } else {
      otp = driver.loginVerificationCode;
      console.log(`[LOGIN] Reusing OTP for ${driver.email}: ${otp}`);
    }

    // ✅ Always send OTP to email
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

exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    if (!email || !otp || !type)
      return res.status(400).json({
        success: false,
        message: "Please provide email, otp, and type",
      });

    const user = await User.findOne({ email: email.toLowerCase() });
    const driver = await Driver.findOne({ email: email.toLowerCase() });
    let account;
    let accountRole;

    if (type === "registration") {
      let token = "";
      if (user && !user.isVerified && user.verificationCode) {
        // console.log("user")
        account = user;
        accountRole = "user";
        token = generateToken(account._id, accountRole);
      } else if (driver && !driver.isVerified && driver.verificationCode) {
        // console.log("driver")
        account = driver;
        accountRole = "driver";
        token = generateToken(account._id, accountRole);
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Email already verified" });
      }

      if (!account.verificationCode) {
        return res.status(400).json({
          success: false,
          message: "OTP not found, please resend OTP",
        });
      }

      if (
        account.verificationCode.toString() !== otp.toString() ||
        !account.otpExpiry ||
        account.otpExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }

      account.isVerified = true;
      account.verificationCode = null;
      account.otpExpiry = null;
      await account.save();
      return res.json({
        success: true,
        message: "Email verified successfully",
        data: { token: token },
      });
    }

    if (type === "login") {
      let token = "";
      if (user && user.loginVerificationCode && !user.loginOtpVerified) {
        account = user;
        accountRole = "user";
        token = generateToken(account._id, accountRole);
      } else if (
        driver &&
        driver.loginVerificationCode &&
        !driver.loginOtpVerified
      ) {
        account = driver;
        accountRole = "driver";
        token = generateToken(account._id, accountRole);
      } else {
        return res.status(400).json({
          success: false,
          message: "No pending login verification found",
        });
      }

      if (!account.loginVerificationCode) {
        return res.status(400).json({
          success: false,
          message: "OTP not found, please resend OTP",
        });
      }

      if (
        account.loginVerificationCode.toString() !== otp.toString() ||
        !account.loginOtpExpiry ||
        account.loginOtpExpiry < new Date()
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired OTP" });
      }

      account.loginOtpVerified = true;
      account.loginVerificationCode = null;
      account.loginOtpExpiry = null;
      await account.save();

      return res.json({
        success: true,
        message: "Login verified successfully",
        data: { token: token },
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
    });
  }
};

// ---------------------- RESEND EMAIL OTP ----------------------

exports.resendEmailOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type)
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and type" });

    const user = await User.findOne({ email: email.toLowerCase() });
    const driver = await Driver.findOne({ email: email.toLowerCase() });

    let account = user || driver;

    if (!account)
      return res
        .status(400)
        .json({ success: false, message: "User not found" });

    if (type === "registration") {
      if (user && !user.isVerified) account = user;
      else if (driver && !driver.isVerified) account = driver;
      else
        return res
          .status(400)
          .json({ success: false, message: "Email already verified" });

      const otp = generateOTP().toString();
      account.verificationCode = otp;
      account.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await account.save();

      await sendEmailVerificationOTP(account.email, otp, account.name);
      return res.json({
        success: true,
        message: "Registration OTP resent successfully",
      });
    }

    if (type === "login") {
      if (account.loginOtpVerified === true) {
        return res.status(400).json({
          success: false,
          message: "OTP already verified. You're logged in.",
        });
      }

      const otp = generateOTP().toString();
      account.loginVerificationCode = otp;
      account.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      account.loginOtpVerified = false;
      await account.save();

      await sendEmailVerificationOTP(account.email, otp, account.name);
      return res.json({
        success: true,
        message: "Login OTP resent successfully",
      });
    }

    return res.status(400).json({ success: false, message: "Invalid type" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Server error during resend OTP" });
  }
};

// ---------------------- GET PROFILE ----------------------

exports.getProfile = async (req, res) => {
  try {
    const Model = req.role === "user" ? User : Driver;
    const user = await Model.findById(req.user._id).select(
      "-password -verificationCode"
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, data: { [req.role]: user } });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user info",
    });
  }
};

// ---------------------- LOGOUT --------------------------

exports.logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Server error during logout" });
  }
};
