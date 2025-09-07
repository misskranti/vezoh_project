const express = require("express");
const { auth } = require("../middleware/auth");
const authController = require("../controllers/authController");
const router = express.Router();

// Registration

router.post("/register/user", authController.registerUser);
router.post("/register/driver", authController.registerDriver);

// Email Verification

router.post("/user/verify-email-otp",  authController.verifyUserEmailOtp);
router.post("/driver/verify-email-otp",  authController.verifyDriverEmailOtp);

router.post("/user/resend-email-otp",  authController.resendUserEmailOtp);
router.post("/driver/resend-email-otp",  authController.resendDriverEmailOtp);

// Login

router.post("/login/user", authController.loginUser);
router.post("/login/driver", authController.loginDriver);

// Profile & Logout

router.get("/profile", auth, authController.getProfile);
router.post("/logout", auth, authController.logout);


module.exports = router;