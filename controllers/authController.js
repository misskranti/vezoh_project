const jwt = require("jsonwebtoken")
const twilio = require("twilio")
const User = require("../models/user")
const Driver = require("../models/driver")
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers")
const { sendEmailVerificationOTP } = require("../utils/emailService")


const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" })
}

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body
    if (!name || !email || !phone)
      return res.status(400).json({ success: false, message: "Please provide all required fields" })
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: "Please provide a valid email address" })
    if (!isValidPhone(phone)) return res.status(400).json({ success: false, message: "Please provide a valid phone number" })

    const formattedPhone = formatPhoneNumber(phone)
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }] })
    if (existingUser)
      return res.status(400).json({ success: false, message: "User already exists with this email or phone number." });

    const otp = generateOTP();
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
      isVerified: false,
    });

    await user.save()
    await sendEmailVerificationOTP(user.email, otp, user.name)

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


exports.loginUser = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const otp = generateOTP();
    user.loginVerificationCode = otp;
    user.loginOtpExpiry = new Date(Date.now() + 5 * 60 * 1000); 
    user.loginOtpVerified = false;   
    await user.save();

    console.log(`[LOGIN] Generated OTP for ${user.email}: ${otp}`);
    await sendEmailVerificationOTP(user.email, otp, user.name);

    res.json({ success: true, message: "Login OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
};


exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    if (!email || !otp || !type) {
      return res.status(400).json({ success: false, message: "Please provide email, otp, and type" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    console.log(`[VERIFY] Incoming request ->`, { email, otp, type });
    console.log(`[VERIFY] User record from DB ->`, {
      verificationCode: user.verificationCode,
      otpExpiry: user.otpExpiry,
      loginVerificationCode: user.loginVerificationCode,
      loginOtpExpiry: user.loginOtpExpiry,
      isVerified: user.isVerified,
    });

    if (type === "registration") {
      if (user.isVerified) {
        return res.status(400).json({ success: false, message: "Email already verified" });
      }

      console.log(`[VERIFY-REG] Checking -> DB OTP: ${user.verificationCode}, Incoming OTP: ${otp}, Expiry: ${user.otpExpiry}`);

      if (user.verificationCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
        return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      }

      user.isVerified = true;
      user.verificationCode = null;
      user.otpExpiry = null;
      await user.save();

      return res.json({ success: true, message: "Email verified successfully" });
    }

    else if (type === "login") {
      console.log("[VERIFY-LOGIN] Checking login OTP...");

      if (
        user.loginVerificationCode !== otp ||
        !user.loginOtpExpiry ||
        user.loginOtpExpiry < new Date()
      ) {
        console.log(`[VERIFY-LOGIN] Invalid OTP! Expected: ${user.loginVerificationCode} Received: ${otp}`);
        return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      }

      user.loginOtpVerified = true;
      user.loginVerificationCode = null;
      user.loginOtpExpiry = null;
      await user.save();

      return res.json({ success: true, message: "Login verified successfully" });
    }

    else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error during OTP verification" });
  }
};


exports.resendEmailOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type) {
      return res.status(400).json({ success: false, message: "Please provide email and type" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    if (type === "registration") {
      if (user.isVerified) {
        return res.status(400).json({ success: false, message: "Email already verified" });
      }

      const otp = generateOTP();
      user.verificationCode = otp;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      console.log(`[RESEND-REG] New OTP for ${user.email}: ${otp}`);

      await sendEmailVerificationOTP(user.email, otp, user.name);
      return res.json({ success: true, message: "Registration OTP resent successfully" });
    }

    else if (type === "login") {
      if (user.loginOtpVerified) {
        return res.status(400).json({
          success: false,
          message: "OTP already verified. You're logged in."
        });
      }

      const otp = generateOTP();
      user.loginVerificationCode = otp;
      user.loginOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      await sendEmailVerificationOTP(user.email, otp, user.name);
      return res.json({ success: true, message: "Login OTP resent successfully" });
    }


    else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error during resend OTP" });
  }
};


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
    

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: "Driver already exists with this email or phone number"
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
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
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