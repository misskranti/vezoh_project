const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const twilio = require("twilio")
const nodemailer = require("nodemailer")
const User = require("../models/user")
const Driver = require("../models/Driver")
const { auth } = require("../middleware/auth")
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers")
const { sendEmailOTP } = require("../utils/emailService")

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

// Generate JWT Token
const generateToken = (id, userType) => {
  return jwt.sign({ id, userType }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  })
}

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

    // If SMS fails, log the OTP for development purposes
    console.log(`[FALLBACK] OTP for ${phone}: ${otp}`)

    // Don't throw error to prevent registration/login failure
    // In production, you might want to handle this differently
    return false
  }
}

// Send OTP via email
// const sendEmailOTP = async (email, otp, name) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     })

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: "Vezoh Password Reset OTP",
//       text: `Hello ${name},\n\nYour password reset OTP is: ${otp}. This code will expire in 10 minutes.\n\nThank you,\nVezoh Team`,
//     }

//     await transporter.sendMail(mailOptions)
//     console.log(`Email sent successfully to ${email}`)
//     return true
//   } catch (error) {
//     console.error(`Failed to send email to ${email}:`, error.message)
//     return false
//   }
// }

// @route   POST /api/auth/register/user
// @desc    Register a new user
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

    // Send OTP
    await sendOTP(formattedPhone, otp)

    // Generate token
    const token = generateToken(user._id, "user")

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your phone number.",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isVerified: user.isVerified,
        },
      },
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
    const { name, email, phone, password, licenseNumber, vehicleType, services } = req.body

    if (!name || !email || !phone || !password || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields (name, email, phone, password, vehicleType)",
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

    const validVehicleTypes = ["bike", "auto", "car", "truck"]
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle type. Must be one of: bike, auto, car, truck",
      })
    }

    const driverServices = services && Array.isArray(services) ? services : ["ride"]
    const validServices = ["ride", "delivery", "freight"]
    if (!driverServices.every((s) => validServices.includes(s))) {
      return res.status(400).json({
        success: false,
        message: "Invalid services provided. Must be one of: ride, delivery, freight",
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

    // Generate OTP
    const otp = generateOTP()

    const driver = new Driver({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      password: hashedPassword,
      verificationCode: otp,
      vehicle: {
        type: vehicleType,
        ...(licenseNumber && { licenseNumber }),
      },
      services: driverServices,
    })

    await driver.save()

    // Send OTP
    await sendOTP(formattedPhone, otp)

    // Generate token
    const token = generateToken(driver._id, "driver")

    res.status(201).json({
      success: true,
      message: "Driver registered successfully. Please verify your phone number.",
      data: {
        token,
        driver: {
          id: driver._id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          isVerified: driver.isVerified,
          vehicleType: driver.vehicle.type,
          services: driver.services,
          verificationStatus: driver.verificationStatus,
        },
      },
    })
  } catch (error) {
    console.error("Driver registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    })
  }
})


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
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isVerified: user.isVerified,
          profileImage: user.profileImage,
          rating: user.rating,
        },
      },
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

    // Generate token
    const token = generateToken(driver._id, "driver")

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        driver: {
          id: driver._id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          isVerified: driver.isVerified,
          profileImage: driver.profileImage,
          vehicleType: driver.vehicle.type,
          services: driver.services,
          status: driver.status,
          verificationStatus: driver.verificationStatus,
          rating: driver.rating,
          earnings: driver.earnings,
        },
      },
    })
  } catch (error) {
    console.error("Driver login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
    })
  }
})


router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp, userType } = req.body

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide phone and OTP",
      })
    }

    if (userType && !["user", "driver"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user type. Must be 'user' or 'driver'",
      })
    }

    const formattedPhone = formatPhoneNumber(phone)
    let user = null
    let foundUserType = null

    if (userType) {
      // If userType is provided, check specific collection
      const Model = userType === "user" ? User : Driver
      user = await Model.findOne({ phone: formattedPhone })
      foundUserType = userType
    } else {
      // If userType not provided, check both collections
      user = await User.findOne({ phone: formattedPhone })
      if (user) {
        foundUserType = "user"
      } else {
        user = await Driver.findOne({ phone: formattedPhone })
        if (user) {
          foundUserType = "driver"
        }
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this phone number",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number is already verified",
      })
    }

    if (user.verificationCode !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      })
    }

    // Update user verification status
    user.isVerified = true
    user.verificationCode = null
    await user.save()

    const token = generateToken(user._id, foundUserType)

    res.json({
      success: true,
      message: "Phone number verified successfully",
      data: {
        token,
        isVerified: true,
        userType: foundUserType,
        [foundUserType]: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isVerified: user.isVerified,
        },
      },
    })
  } catch (error) {
    console.error("OTP verification error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
    })
  }
})


router.post("/resend-otp", async (req, res) => {
  try {
    const { phone, userType } = req.body

    if (!phone || !userType) {
      return res.status(400).json({
        success: false,
        message: "Please provide phone and user type",
      })
    }

    if (!["user", "driver"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user type. Must be 'user' or 'driver'",
      })
    }

    const formattedPhone = formatPhoneNumber(phone)
    const Model = userType === "user" ? User : Driver
    const user = await Model.findOne({ phone: formattedPhone })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this phone number",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number is already verified",
      })
    }

    // Generate new OTP
    const otp = generateOTP()
    user.verificationCode = otp
    await user.save()

    // Send OTP
    await sendOTP(user.phone, otp)

    res.json({
      success: true,
      message: "OTP sent successfully",
    })
  } catch (error) {
    console.error("Resend OTP error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while sending OTP",
    })
  }
})


router.post("/forgot-password", async (req, res) => {
  try {
    const { email, userType } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address",
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    if (userType && !["user", "driver"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user type. Must be 'user' or 'driver'",
      })
    }

    let user = null
    let foundUserType = null

    if (userType) {
      // If userType is provided, check specific collection
      const Model = userType === "user" ? User : Driver
      user = await Model.findOne({ email: email.toLowerCase() })
      foundUserType = userType
    } else {
      // If userType not provided, check both collections
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

    // Generate OTP for password reset
    const otp = generateOTP()
    user.verificationCode = otp
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    await user.save()

    await sendEmailOTP(user.email, otp, user.name)

    res.json({
      success: true,
      message: "Password reset OTP sent to your email address",
      data: {
        email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Mask email
        userType: foundUserType,
      },
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while processing request",
    })
  }
})


router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword, userType } = req.body

    if (!email || !otp || !newPassword || !userType) {
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

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    if (!["user", "driver"].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user type",
      })
    }

    const Model = userType === "user" ? User : Driver
    const user = await Model.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

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

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Update password and clear OTP
    user.password = hashedPassword
    user.verificationCode = null
    user.otpExpiry = null
    await user.save()

    res.json({
      success: true,
      message: "Password reset successfully",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while resetting password",
    })
  }
})


router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      })
    }

    const Model = req.userType === "user" ? User : Driver
    const user = await Model.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Update password
    user.password = hashedPassword
    await user.save()

    res.json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("Change password error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while changing password",
    })
  }
})


router.get("/me", auth, async (req, res) => {
  try {
    const Model = req.userType === "user" ? User : Driver
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
        [req.userType]: user,
        userType: req.userType,
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
