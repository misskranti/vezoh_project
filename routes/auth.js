const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const twilio = require("twilio")
const nodemailer = require("nodemailer")
const User = require("../models/user")
const Driver = require("../models/driver")
const { auth } = require("../middleware/auth")
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers")
const { sendEmailVerificationOTP, sendPasswordResetOTP } = require("../utils/emailService")

const router = express.Router()

let twilioClient = null

const initializeTwilio = () => {
  if (
    !twilioClient &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID.startsWith("AC") &&
    process.env.TWILIO_ACCOUNT_SID !== "your_twilio_sid"
  ) {
    try {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      console.log("Twilio client initialized successfully")
    } catch (error) {
      console.error("Failed to initialize Twilio client:", error.message)
      twilioClient = null
    }
  }
  return twilioClient
}

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  })
}


router.post("/register/user", async (req, res) => {
  try {
    const { name, email, phone } = req.body

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number",
      })
    }

    const formattedPhone = formatPhoneNumber(phone)

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or phone number",
      })
    }

    // Generate OTP
    const otp = generateOTP()

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      verificationCode: otp,
    })

    await user.save()

    const emailSent = await sendEmailVerificationOTP(user.email, otp, user.name)
    
    if (!emailSent) {
      console.log(`[WARNING] Email failed to send, but user created. OTP: ${otp}`)
    }

    // Generate token
    const token = generateToken(user._id, "user")

    res.status(201).json({
      success: true,
      message: emailSent 
        ? "User registered successfully. Please check your email for the verification code." 
        : "User registered successfully. Please check server logs for the verification code.",
      id: user._id,
      token: token,
    })
  } catch (error) {
    console.error("User registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    })
  }
})



router.post("/register/driver", async (req, res) => {
  try {
    const { name, email, phone } = req.body

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number",
      })
    }

    const formattedPhone = formatPhoneNumber(phone)

    const existingDriver = await Driver.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    })

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: "Driver already exists with this email or phone number",
      })
    }

    // Generate OTP
    const otp = generateOTP()

    const driver = new Driver({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
    })

    await driver.save()

    const emailSent = await sendEmailVerificationOTP(driver.email, otp, driver.name)
    
    if (!emailSent) {
      console.log(`[WARNING] Email failed to send, but driver created. OTP: ${otp}`)
    }

    // Generate token
    const token = generateToken(driver._id, "driver")

    res.status(201).json({
      success: true,
      message: emailSent 
        ? "Driver registered successfully. Please check your email for the verification code." 
        : "Driver registered successfully. Please check server logs for the verification code.",
      id: driver._id,
      token: token,
    })
  } catch (error) {
    console.error("Driver registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    })
  }
})


router.post("/verify-email-otp", auth, async (req, res) => {
  try {
    const { email, otp } = req.body
    const role = req.role // Extract role from JWT token via auth middleware

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and OTP",
      })
    }

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Email does not match the authenticated user",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    console.log("[DEBUG] OTP Verification:")
    console.log("[DEBUG] Email:", email)
    console.log("[DEBUG] Provided OTP:", otp)
    console.log("[DEBUG] Stored OTP:", user.verificationCode)
    console.log("[DEBUG] OTP Expiry:", user.otpExpiry)
    console.log("[DEBUG] Current Time:", new Date())

    // ❌ Invalid OTP
    if (user.verificationCode !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      })
    }

    // ⏳ OTP Expired
    if (user.otpExpiry && new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      })
    }

    // ✅ OTP Valid → Verify user
    user.isVerified = true
    user.verificationCode = null
    user.otpExpiry = null
    await user.save()

    const token = generateToken(user._id, role)

    console.log("[SUCCESS] Email verification successful for:", email)

    res.json({
      success: true,
      message: "Email verified successfully",
      id: user._id,
      isVerified: true,
      token: token
    })
  } catch (error) {
    console.error("Email OTP verification error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
    })
  }
})


router.post("/resend-email-otp", auth, async (req, res) => {
  try {
    const { email } = req.body
    const role = req.role // Extract role from JWT token via auth middleware

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      })
    }

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Email does not match the authenticated user",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    // Generate new OTP
    const otp = generateOTP()
    user.verificationCode = otp
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    await user.save()

    const emailSent = await sendEmailVerificationOTP(user.email, otp, user.name)

    res.json({
      success: true,
      message: emailSent ? "OTP sent successfully to your email" : "OTP generated. Please check server logs.",
    })
  } catch (error) {
    console.error("Resend email OTP error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while sending OTP",
    })
  }
})


router.post("/login/user", async (req, res) => {
  try {
    const { identifier } = req.body

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      })
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }],
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    const token = generateToken(user._id, "user")

    res.json({
      success: true,
      message: "Login successful",
      id: user._id,
      token : token
    })
  } catch (error) {
    console.error("User login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
    })
  }
})







router.post("/login/driver", async (req, res) => {
  try {
    const { identifier } = req.body

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      })
    }

    const driver = await Driver.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: formatPhoneNumber(identifier) }],
    })

    if (!driver) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

 

    const token = generateToken(driver._id, "driver")

    res.json({
      success: true,
      message: "Login successful",
      id: driver._id,
      role: "driver",
      token: token,
    })
  } catch (error) {
    console.error("Driver login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
    })
  }
})

router.get("/profile", auth, async (req, res) => {
  try {
    const Model = req.role === "user" ? User : Driver
    const user = await Model.findById(req.user._id).select("-password -verificationCode")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      data: {
        [req.role]: user,
       // role: req.role,
      },
    })
  } catch (error) {
    console.error("Get user info error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while fetching user info",
    })
  }
})

router.post("/logout", auth, async (req, res) => {
  try {

    res.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    })
  }
})

module.exports = router
