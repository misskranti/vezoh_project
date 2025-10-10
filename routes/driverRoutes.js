const express = require("express");
const router = express.Router();

// Middleware
const { auth } = require("../middleware/auth");
const { driverDocuments, handleUploadErrors } = require("../middleware/upload");
const { throwError } = require("../middleware/errorMiddleware.js");

// Express Validator
const { param, body } = require("express-validator");

// Controllers
const driverAuthController = require("../controllers/driverAuthController.js");
const profileController = require("../controllers/profileController.js");
const {
  driverOptServices,
  selectedServices,
  servicesList,
  particularService,
  addServices,
} = require("../controllers/driverServiceController.js");
const {
  statusUpdate,
  driverdashboard,
  incomingrequest,
} = require("../controllers/driverDashboardController.js");
const { vehicleRegistration } = require("../controllers/driverDocumentController.js");

// ==============================
// DRIVER AUTHENTICATION ROUTES
// ==============================

// Driver Registration
router.post("/register", driverAuthController.registerDriver);

// Driver Login
router.post("/login", driverAuthController.loginDriver);

// Email Verification
router.post("/verify-email-otp", driverAuthController.verifyDriverEmailOtp);
router.post("/resend-email-otp", driverAuthController.resendDriverEmailOtp);

// Driver Profile & Logout
router.get("/profile", auth, profileController.getProfile);
router.post("/logout", auth, profileController.logout);

// ==============================
// DRIVER SERVICE & VEHICLE ROUTES
// ==============================

// Select/Opt for Services
router.post(
  "/opt-services",
  auth,
  body("services")
    .trim()
    .notEmpty()
    .withMessage("Please select some services")
    .bail()
    .isArray()
    .withMessage("Invalid format of service selection")
    .bail()
    .custom((value) => {
      if (!value.length) throw new Error("Please select some services");
      for (let ele of value) {
        if (!["ride", "courier", "freight"].includes(ele)) {
          throw new Error("Invalid value in service selection");
        }
      }
      return true;
    }),
  throwError,
  driverOptServices
);

// Get Selected Services
router.get("/selected-services", auth, selectedServices);

// Vehicle Registration (with file upload)
router.post("/register-vehicle", auth, driverDocuments, handleUploadErrors, vehicleRegistration);

// Add New Services
router.post("/services/add-services", addServices);

// Get All Services
router.get("/services", auth, servicesList);

// Get Particular Service
router.get(
  "/services/:service",
  auth,
  param("service")
    .trim()
    .notEmpty()
    .withMessage("service is required")
    .bail()
    .not()
    .isInt()
    .withMessage("Invalid service selection"),
  throwError,
  particularService
);

// ==============================
// DRIVER DASHBOARD & STATUS ROUTES
// ==============================

// Driver Dashboard
router.get("/dashboard", auth, driverdashboard);

// Update Driver Status
router.put("/status-update", auth, statusUpdate);

// Get Incoming Requests for a Driver
router.get("/incoming/:driverId", auth, incomingrequest);

module.exports = router;