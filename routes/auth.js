const express = require("express")
const { auth } = require("../middleware/auth")
const authController = require("../controllers/authController")

const { driverDocuments, handleUploadErrors } = require('../middleware/upload');

const router = express.Router()

// Registration
router.post("/register/user", authController.registerUser)

// Email verification
router.post("/verify-email-otp", auth, authController.verifyEmailOtp)
router.post("/resend-email-otp", auth, authController.resendEmailOtp)

// Login
router.post("/login/user", authController.loginUser)
router.post("/login/driver", authController.loginDriver)

// Profile & Logout
router.get("/profile", auth, authController.getProfile)
router.post("/logout", auth, authController.logout)

// Driver verification submit
router.post("/register/driver/complete", driverDocuments, handleUploadErrors, authController.registerDriverComplete);

module.exports = router
