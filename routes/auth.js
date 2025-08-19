const express = require("express");
const { registerUser, loginUser } = require("../controllers/authController");
// const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema } = require("../validators/authValidator");
//const { registerDriverSchema } = require("../validators/driverValidator");
const router = express.Router();

router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);

// router.get("/profile", authMiddleware, getMe);
//router.post("/driver/register", validate(registerDriverSchema), createDriver);


module.exports = router;
