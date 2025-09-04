const express = require("express");
const { auth } = require("../middleware/auth");
const authController = require("../controllers/authController");

const router = express.Router();

// Registration

router.post("/register/user", authController.registerUser);
router.post("/register/driver", authController.registerDriver);

// Email Verification

router.post("/verify-email-otp", authController.verifyEmailOtp);
router.post("/resend-email-otp", authController.resendEmailOtp);

// Login

router.post("/login/user", authController.loginUser);
router.post("/login/driver", authController.loginDriver);

// Profile & Logout

router.get("/profile", auth, authController.getProfile);
router.post("/logout", auth, authController.logout);

module.exports = router;