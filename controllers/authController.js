

const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/user");
// const Driver = require("../models/Driver");
const { registerSchema, loginSchema } = require("../validators/authValidator");

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ---------------- Register User/Driver ----------------
const registerUser = async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.details.map((err) => err.message),
      });
    }

    const { phonenumber, fullname, emailaddress, password, role, addresses } = req.body;

    let existingUser = await User.findOne({ phonenumber });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: "DuplicatePhoneNumber",
        message: "Phone number already registered. Please use a different phone number or try logging in."
      });
    }

    if (emailaddress) {
      const existingEmail = await User.findOne({ emailaddress });
      if (existingEmail) {
        return res.status(400).json({ 
          success: false,
          error: "DuplicateEmailAddress",
          message: "Email address already registered. Please use a different email or try logging in."
        });
      }
    }

    const processedAddresses = (addresses && Array.isArray(addresses) && addresses.length > 0)
      ? addresses.map(addr => ({
        ...addr,
      addressId: addr.addressId || uuidv4(),
        }))
      : []; 

    const userData = {
      userId: new Date().getTime().toString(),
      phonenumber,
      fullname,
      emailaddress,
      password,
      role: role || "user",
      addresses: processedAddresses,
    };


    const user = new User(userData);
    await user.save();


    if (role === "driver") {
      const { licenseNumber, vehicleNumber, vehicleType } = req.body;

      const driver = new Driver({
        user: user._id,
        licenseNumber,
        vehicleNumber,
        vehicleType,
        role: "driver",
      });

      await driver.save();
    }

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: `${role === "driver" ? "Driver" : "User"} registered successfully`,
      token,
      user: {
        id: user._id,
        phonenumber: user.phonenumber,
        fullname: user.fullname,
        emailaddress: user.emailaddress,
        role: user.role,
        ...(user.addresses.length > 0 && { addresses: user.addresses }),
      },
    });
  } catch (err) {
    console.error(err);
    
    
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: "Please check your input data.",
        details: validationErrors
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      message: "Something went wrong. Please try again later." 
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.details.map((err) => err.message),
      });
    }

    const { phonenumber, password } = req.body;

    const user = await User.findOne({ phonenumber });
    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid credentials",
        message: "Phone number not found. Please check your phone number or register first."
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid credentials",
        message: "Incorrect password. Please try again."
      });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        phonenumber: user.phonenumber,
        fullname: user.fullname,
        emailaddress: user.emailaddress,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      let message = "Login failed due to data conflict.";
      
      return res.status(400).json({
        error: "Login failed",
        message: "Unable to process login. Please contact support.",
      });
    }
    
    // Generic server error
    res.status(500).json({ 
      error: "Server error", 
      message: "Something went wrong. Please try again later." 
    });
  }
};

// ---------------- Get Logged In User/Driver ----------------
// const getMe = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId).select("-password");
    
//     // If user is a driver, also fetch driver info
//     if (req.user.role === "driver") {
//       const driver = await Driver.findOne({ user: req.user.userId });
//       return res.json({ 
//         success: true,
//         user: { ...user.toObject(), driver }
//       });
//     }

//     res.json({
//       success: true,
//       user: user
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ 
//       error: "Server error", 
//       message: "Unable to fetch user data. Please try again later." 
//     });
//   }
// };

module.exports = { registerUser, loginUser };