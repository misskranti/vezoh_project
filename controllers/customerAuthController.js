const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/driver");
const {
  generateOTP,
  formatPhoneNumber,
  isValidEmail,
  generateUniquePhone
} = require("../utils/helpers");
const { sendEmailVerificationOTP } = require("../utils/emailService");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// ---------------------- SEND EMAIL OTP (Testing Completed)----------------------

exports.sendUserEmailOtp = async (req, res) => {
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
    let user = await User.findOne({ email: email.toLowerCase() });

    // Case 3: User exists AND verified → Block registration
    if (user && user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "User already exists. Please sign in.",
      });
    }

    // Case 2: User exists but NOT verified → Resend OTP
    if (user && !user.isVerified) {
      const otp = generateOTP().toString();
      user.verificationCode = otp;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendEmailVerificationOTP(user.email, otp, user.name || "User");

      return res.status(200).json({
        success: true,
        message: "New OTP sent successfully to your email.",
      });
    }

    // Case 1: New user → Create and send OTP
    const otp = generateOTP().toString();
    const newUser = new User({
      name: "dummy",
      email: email.toLowerCase(),
      phone: generateUniquePhone(),
      isVerified: false,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    await newUser.save(); 

    await sendEmailVerificationOTP(newUser.email, otp, newUser.name || "User");

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

// ---------------------- REGISTER USER (Testing Completed)----------------------
exports.completeProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const formattedPhone = formatPhoneNumber(phone);

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    });
    if (!existingUser)
      return res.status(404).json({
        success: false,
        message:
         "User not exist with this email or phone. Please register first.",
      });

    if (existingUser.isProfileCompleted) {
      return res.status(409).json({
        success: false,
        message: "Your profile has already been completed. To make changes, please go to Settings.",
      })
    }

    const updateUserProfile = await User.findOneAndUpdate(
      {
        $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
      },
      { name: name.trim(), email: email.toLowerCase(),
        phone: formattedPhone,isProfileCompleted: true,
      },
      { new: true }
    );

     const token = generateToken(updateUserProfile._id, "user")

    return res.status(201).json({
      success: true,
      message: "Profile completed successfully.",
      data: {
        id: updateUserProfile._id.toString(),
        token: token,
      },
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong. Please try again later."});
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

// ---------------------- VERIFY EMAIL OTP (Testing Completed)----------------------

exports.verifyUserEmailOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }



    if (type === "registration") {
      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: "User already verified. Please sign in.",
        })
      }

      if (!user.verificationCode) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP.",
        })
      }

      if (user.otpExpiry < new Date()) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        })
      }

      if (user.verificationCode.toString() !== otp.toString()) {
        return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP." });
      }

      user.isVerified = true;
      user.verificationCode = null;
      user.otpExpiry = null;
      await user.save();

      return res.json({
        success: true,
        message: "User email verified successfully",
        data: { id: user._id.toString() },
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
     let token = generateToken(user._id, "user");
      user.loginOtpVerified = true;
      user.loginVerificationCode = null;
      user.loginOtpExpiry = null;
      user.userToken = token;
      await user.save();

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
      message: "Something went wrong. Please try again later.",
    });
  }
};

// ---------------------- RESEND EMAIL OTP(Testing Completed) ----------------------

exports.resendUserEmailOtp = async (req, res) => {
  try {
    const { email, type } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found. Please register first." });
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
      message: "Something went wrong. Please try again later.",
    });
  }
};
