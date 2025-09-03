const jwt = require("jsonwebtoken")
const twilio = require("twilio")
const User = require("../models/user")
const Driver = require("../models/driver")
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers")
const { sendEmailVerificationOTP } = require("../utils/emailService")

let twilioClient = null

// Initialize Twilio client
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
    } catch (error) {
      twilioClient = null
    }
  }
  return twilioClient
}

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" })
}

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body
    if (!name || !email || !phone) return res.status(400).json({ success: false, message: "Please provide all required fields" })
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: "Please provide a valid email address" })
    if (!isValidPhone(phone)) return res.status(400).json({ success: false, message: "Please provide a valid phone number" })

    const formattedPhone = formatPhoneNumber(phone)
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }] })
    const existingDriver = await Driver.findOne({ $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }] })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or phone number."
      })
    }

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: "This email or phone number is already registered in the Vezoh Driver app."
})
    }

    const otp = generateOTP()
    const user = new User({ name: name.trim(), email: email.toLowerCase(), phone: formattedPhone, verificationCode: otp })
    await user.save()

    await sendEmailVerificationOTP(user.email, otp, user.name)

    const token = generateToken(user._id, "user")
    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email for the verification code.",
      data: { id: user._id.toString(), token: token },
    })
  } catch {
    res.status(500).json({ success: false, message: "Server error during registration" })
  }
}

// Register Driver
exports.registerDriverComplete = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      services,
      vehicleType,
      vehicleNumber,
      ownerName
    } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields (name, email, phone)"
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number"
      });
    }

    const formattedPhone = formatPhoneNumber(phone)
    const existingDriver = await Driver.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }]
    })
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }]
    })

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: "Driver already exists with this email or phone number"
      })
    }

      if ( existingUser) {
      return res.status(400).json({
        success: false,
        message: "This email or phone number is already registered in the Vezoh User app"
      })
    }


    let parsedServices;
    try {
      parsedServices = typeof services === 'string' ? JSON.parse(services) : services;
      if (!Array.isArray(parsedServices) || parsedServices.length === 0) {
        throw new Error('Services must be a non-empty array');
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one service'
      });
    }

    if (!vehicleType || !vehicleNumber || !ownerName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide vehicle type, vehicle number, and owner name'
      });
    }

    const existingVehicle = await Driver.findOne({
      'vehicle.number': vehicleNumber.toUpperCase()
    });

    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this number is already registered'
      });
    }

    const requiredFiles = [
      'drivingLicense',
      'rcCertificate',
      'vehicleInsurance'
    ];

    const missingFiles = requiredFiles.filter(field => !req.files?.[field]);

    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload all required documents',
        missingFiles: missingFiles.map(file => {
          switch (file) {
            case 'drivingLicense': return 'Driving License';
            case 'rcCertificate': return 'RC Registration Certificate';
            case 'vehicleInsurance': return 'Vehicle Insurance';
            default: return file;
          }
        })
      });
    }

    const otp = generateOTP();

    const driverData = {
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      services: parsedServices,
      vehicle: {
        type: vehicleType.toLowerCase(),
        number: vehicleNumber.toUpperCase(),
        ownerName: ownerName.trim()
      },

      documents: {
        drivingLicense: {
          image: req.files.drivingLicense[0].path,
          isVerified: false
        },
        rcCertificate: {
          image: req.files.rcCertificate[0].path,
          isVerified: false
        },
        vehicleInsurance: {
          image: req.files.vehicleInsurance[0].path,
          isVerified: false
        }
      },


      verificationStatus: 'pending',
      registrationStep: 'completed',
      isEmailVerified: false,
      isApproved: false
    };


    const driver = new Driver(driverData);
    await driver.save();


    await sendEmailVerificationOTP(driver.email, otp, driver.name);


    const token = jwt.sign(
      { id: driver._id, role: "driver" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    )


    res.status(201).json({
      success: true,
      message: "Driver registered successfully. Please check your email for the verification code.",
      data: {
        id: driver._id.toString(),
        token: token

      }
    });

  } catch (error) {
    console.error('Driver registration error:', error);


    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      });
    }


    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
}


// Verify Email OTP
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body
    const role = req.role
    if (!email || !otp) return res.status(400).json({ success: false, message: "Please provide email and OTP" })

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: "User not found" })
    if (user.email.toLowerCase() !== email.toLowerCase()) return res.status(400).json({ success: false, message: "Email does not match the authenticated user" })
    if (user.isVerified) return res.status(400).json({ success: false, message: "Email is already verified" })
    if (user.verificationCode !== otp) return res.status(400).json({ success: false, message: "Invalid OTP" })
    if (user.otpExpiry && new Date() > user.otpExpiry) return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." })

    user.isVerified = true
    user.verificationCode = null
    user.otpExpiry = null
    await user.save()

    const token = generateToken(user._id, role)
    res.json({ success: true, message: "Email verified successfully" })
  } catch {
    res.status(500).json({ success: false, message: "Server error during email verification" })
  }
}

// Resend Email OTP
exports.resendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body
    const role = req.role
    if (!email) return res.status(400).json({ success: false, message: "Please provide email" })

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: "User not found" })
    if (user.email.toLowerCase() !== email.toLowerCase()) return res.status(400).json({ success: false, message: "Email does not match the authenticated user" })
    if (user.isVerified) return res.status(400).json({ success: false, message: "Email is already verified" })

    const otp = generateOTP()
    user.verificationCode = otp
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000)
    await user.save()

    await sendEmailVerificationOTP(user.email, otp, user.name)
    res.json({ success: true, message: "OTP sent successfully to your email" })
  } catch {
    res.status(500).json({ success: false, message: "Server error while sending OTP" })
  }
}

// Login User
exports.loginUser = async (req, res) => {
  try {
    const { identifier } = req.body
    if (!identifier) return res.status(400).json({ success: false, message: "Please provide email" })

    const user = await User.findOne({ email: identifier.toLowerCase() })
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" })

    const token = generateToken(user._id, "user")
    res.json({ success: true, message: "Login successful", data: { id: user._id.toString(), token: token } })
  } catch {
    res.status(500).json({ success: false, message: "Server error during login" })
  }
}

// Login Driver
exports.loginDriver = async (req, res) => {
  try {
    const { identifier } = req.body
    if (!identifier) return res.status(400).json({ success: false, message: "Please provide email" })

    const driver = await Driver.findOne({ $or: [{ email: identifier.toLowerCase() }, { phone: formatPhoneNumber(identifier) }] })
    if (!driver) return res.status(400).json({ success: false, message: "Invalid credentials" })

    const token = generateToken(driver._id, "driver")
    res.json({ success: true, message: "Login successful", data: { id: driver._id.toString(), token: token } })
  } catch {
    res.status(500).json({ success: false, message: "Server error during login" })
  }
}

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const Model = req.role === "user" ? User : Driver
    const user = await Model.findById(req.user._id).select("-password -verificationCode")
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    res.json({ success: true, data: { [req.role]: user } })
  } catch {
    res.status(500).json({ success: false, message: "Server error while fetching user info" })
  }
}

// Logout
exports.logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" })
  } catch {
    res.status(500).json({ success: false, message: "Server error during logout" })
  }
}


const getNextStep = (registrationStep, verificationStatus) => {
  if (verificationStatus === 'approved') return 'registration_complete';
  if (verificationStatus === 'rejected') return 'resubmit_application';
  if (verificationStatus === 'under_review') return 'wait_for_approval';

  switch (registrationStep) {
    case 'basic_info': return 'submit_for_verification';
    case 'service_selection': return 'submit_for_verification';
    case 'completed': return 'wait_for_approval';
    default: return 'submit_for_verification';
  }
}