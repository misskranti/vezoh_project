const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const twilio = require("twilio")
const nodemailer = require("nodemailer")
const User = require("../models/user")
const Driver = require("../models/driver")
const { auth } = require("../middleware/auth")
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers")

const router = express.Router()

// ============================================================================
// INITIALIZATION & UTILITY FUNCTIONS
// ============================================================================

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

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  })
}

// Send OTP via SMS
const sendOTP = async (phone, otp) => {
  try {
    const client = initializeTwilio()

    // Check if Twilio credentials are configured and valid
    if (!client || !process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER === "your_twilio_phone") {
      console.log(`[MOCK SMS] OTP ${otp} would be sent to ${phone} (Twilio not configured)`)
      return true
    }

    // Send actual SMS using Twilio
    const message = await client.messages.create({
      body: `Your Vezoh verification code is: ${otp}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    })

    console.log(`SMS sent successfully to ${phone}. Message SID: ${message.sid}`)
    return true
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}:`, error.message)
    console.log(`[FALLBACK] OTP for ${phone}: ${otp}`)
    return false
  }
}

// Send OTP via email
const sendEmailOTP = async (email, otp, name) => {
  try {
    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`[MOCK EMAIL] OTP ${otp} would be sent to ${email} (Email not configured)`)
      return false
    }

    console.log(`[DEBUG] Attempting to send email to: ${email}`)
    console.log(`[DEBUG] Using email user: ${process.env.EMAIL_USER}`)

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    // Verify transporter configuration
    await transporter.verify()
    console.log("[DEBUG] Email transporter verified successfully")

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Vezoh Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Hello ${name},</p>
          <p>Your Vezoh email verification OTP is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <p>Thank you,<br>Vezoh Team</p>
        </div>
      `,
      text: `Hello ${name},\n\nYour Vezoh email verification OTP is: ${otp}\n\nThis code will expire in 10 minutes.\n\nThank you,\nVezoh Team`,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`[SUCCESS] Email sent successfully to ${email}. Message ID: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`[ERROR] Failed to send email to ${email}:`, error.message)
    console.log(`[FALLBACK] OTP for ${email}: ${otp}`)
    return false
  }
}

// ============================================================================
// STEP 1: REGISTRATION FLOW
// ============================================================================

// @route   POST /api/auth/register/user
// @desc    Register a new user (Step 1 of registration)
// @access  Public
router.post("/register/user", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body

    // Validation
    if (!name || !email || !phone || !password) {
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

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
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

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Generate OTP
    const otp = generateOTP()

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      password: hashedPassword,
      verificationCode: otp,
    })

    await user.save()

    // FIXED: Check if email was sent successfully
    const emailSent = await sendEmailOTP(user.email, otp, user.name)
    
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
           role: "user",
           token : token,
    
    })
  } catch (error) {
    console.error("User registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    })
  }
})

// @route   POST /api/auth/register/driver
// @desc    Register a new driver with email OTP verification
// @access  Public
router.post("/register/driver", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body

    // Validation - exactly same as user registration
    if (!name || !email || !phone || !password) {
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

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    const formattedPhone = formatPhoneNumber(phone)

    // Check if driver already exists
    const existingDriver = await Driver.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    })

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: "Driver already exists with this email or phone number",
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Generate OTP for email verification
    const otp = generateOTP()

    const driver = new Driver({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      password: hashedPassword,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
    })

    await driver.save()

    // FIXED: Check if email was sent successfully
    const emailSent = await sendEmailOTP(driver.email, otp, driver.name)
    
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
         role:"driver",
         token: token,
      // data: {
      //   token,
      //   // driver: {
      //   //  // id: driver._id,
      //   //   name: driver.name,
      //   //   email: driver.email,
      //   //   phone: driver.phone,
      //   //   isVerified: driver.isVerified,
      //   // },
      // },
    })
  } catch (error) {
    console.error("Driver registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    })
  }
})

// ============================================================================
// STEP 2: PHONE VERIFICATION FLOW
// ============================================================================

// @route   POST /api/auth/verify-otp
// @desc    Verify phone number with OTP (Step 2 of registration)
// @access  Public
router.post("/verify-email-otp", async (req, res) => {
  try {
    const { email, otp, role } = req.body

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and OTP",
      })
    }

    if (role && !["user", "driver"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user type. Must be 'user' or 'driver'",
      })
    }

    let user = null
    let foundUserType = null

    if (role) {
      // If role is provided, check specific collection
      const Model = role === "user" ? User : Driver
      user = await Model.findOne({ email: email.toLowerCase() })
      foundUserType = role
    } else {
      // If role not provided, check both collections
      user = await User.findOne({ email: email.toLowerCase() })
      if (user) {
        foundUserType = "user"
      } else {
        user = await Driver.findOne({ email: email.toLowerCase() })
        if (user) {
          foundUserType = "driver"
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email address",
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

    if (user.verificationCode !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      })
    }

    if (user.otpExpiry && new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      })
    }

    // Update user verification status
    user.isVerified = true
    user.verificationCode = null
    user.otpExpiry = null
    await user.save()

    const token = generateToken(user._id, foundUserType)

    console.log("[SUCCESS] Email verification successful for:", email)

    res.json({
      success: true,
      message: "Email verified successfully",
      id: user._id,
       role: foundUserType,
      isVerified: true,
     
      token: token

      // data: {
      //   token,
      //   isVerified: true,
      //   role: foundUserType,
      //   [foundUserType]: {
      //     id: user._id,
      //     name: user.name,
      //     email: user.email,
      //     phone: user.phone,
      //     isVerified: user.isVerified,
      //   },
      // },
    })
  } catch (error) {
    console.error("Email OTP verification error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
    })
  }
})

// @route   POST /api/auth/resend-email-otp
// @desc    Resend email OTP for registration
// @access  Public
router.post("/resend-email-otp", async (req, res) => {
  try {
    const { email, role } = req.body

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and user type",
      })
    }

    if (!["user", "driver"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user type. Must be 'user' or 'driver'",
      })
    }

    const Model = role === "user" ? User : Driver
    const user = await Model.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email address",
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

    // Send OTP via email
    const emailSent = await sendEmailOTP(user.email, otp, user.name)

    res.json({
      success: true,
      message: emailSent 
        ? "OTP sent successfully to your email" 
        : "OTP generated. Please check server logs.",
    })
  } catch (error) {
    console.error("Resend email OTP error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while sending OTP",
    })
  }
})

// ============================================================================
// STEP 3: LOGIN FLOW
// ============================================================================

// @route   POST /api/auth/login/user
// @desc    Login user
// @access  Public
router.post("/login/user", async (req, res) => {
  try {
    const { identifier, password } = req.body

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password",
      })
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: formatPhoneNumber(identifier) }],
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Account is suspended. Please contact support.",
      })
    }

    // Generate token
    const token = generateToken(user._id, "user")

    res.json({
      success: true,
      message: "Login successful",
      id: user._id,
      role: "user",
      token : token
      //data: {
       // token,
        //user: {
         // id: user._id,
        //   name: user.name,
        //   email: user.email,
        //   phone: user.phone,
        //   isVerified: user.isVerified,
        //   profileImage: user.profileImage,
        //   rating: user.rating,
        // },
     // },
    })
  } catch (error) {
    console.error("User login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
    })
  }
})

// @route   POST /api/auth/login/driver
// @desc    Login driver (same format as user login)
// @access  Public
router.post("/login/driver", async (req, res) => {
  try {
    const { identifier, password } = req.body

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password",
      })
    }

    // Find driver by email or phone
    const driver = await Driver.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: formatPhoneNumber(identifier) }],
    })

    if (!driver) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, driver.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // if (driver.status !== "active") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Account is suspended. Please contact support.",
    //   })
    // }

    // Generate token
    const token = generateToken(driver._id, "driver")

    res.json({
      success: true,
      message: "Login successful",
      id: driver._id,
      role: "driver",
      token: token,
      // data: {
      //   token,
      //   driver: {
      //     id: driver._id,
      //     name: driver.name,
      //     email: driver.email,
      //     phone: driver.phone,
      //     isVerified: driver.isVerified,
      //     profileImage: driver.profileImage,
      //     rating: driver.rating,
      //   },
      // },
    })
  } catch (error) {
    console.error("Driver login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
    })
  }
})

// @route   GET /api/auth/me
// @desc    Get current user/driver info
// @access  Private
router.get("/me", auth, async (req, res) => {
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
        role: req.role,
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

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
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
