const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Driver = require("../models/driver");
const {generateOTP,formatPhoneNumber,isValidEmail,isValidPhone} = require("../utils/helpers");
const { sendEmailVerificationOTP } = require("../utils/emailService");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" });
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