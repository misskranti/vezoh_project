const express = require("express");
const router = express.Router();

// Middleware
const { auth } = require("../middleware/auth");
const { driverDocuments, handleUploadErrors } = require("../middleware/upload");
const { throwError } = require("../middleware/errorMiddleware.js");

// Validators
const {
  sendOtpValidator,
  driverRegisterValidator,
  driverLoginValidator,
  driverVerifyOtpValidator,
  driverResendOtpValidator,
  addServicesValidator,
  serviceParamValidator,
} = require("../validators/driverValidators.js");

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

const driverTrip = require("../controllers/driverTripController.js")
const driverEarnings = require("../controllers/driverEarningsController.js")
const tripVal = require("../validators/driverTripValidators.js")
const earningVal = require("../validators/driverEarningsValidators.js")

// ==============================
// DRIVER AUTHENTICATION ROUTES
// ==============================

router.post("/send-otp", sendOtpValidator, throwError, driverAuthController.sendDriverEmailOtp);

// Driver Registration
router.post("/register", driverRegisterValidator, throwError, driverAuthController.registerDriver);

// Driver Login
router.post("/login", driverLoginValidator, throwError, driverAuthController.loginDriver);

// Email Verification
router.post("/verify-email-otp", driverVerifyOtpValidator, throwError, driverAuthController.verifyDriverEmailOtp);
router.post("/resend-email-otp", driverResendOtpValidator, throwError, driverAuthController.resendDriverEmailOtp);

// Driver Profile & Logout
router.get("/profile", auth, profileController.getProfile);
router.post("/logout", auth, profileController.logout);

// ==============================
// DRIVER SERVICE & VEHICLE ROUTES
// ==============================

// Select/Opt for Services
router.post("/opt-services",auth, addServicesValidator, throwError,driverOptServices);

// Get Selected Services
router.get("/selected-services", auth, selectedServices);

// Vehicle Registration (with file upload)
router.post("/register-vehicle", auth, driverDocuments, handleUploadErrors, vehicleRegistration);

// Add New Services
router.post("/services/add-services", auth, addServicesValidator, throwError, addServices);

// Get All Services
router.get("/services", auth, servicesList);

// Get Particular Service
router.get("/services/:service", auth, serviceParamValidator, throwError, particularService)

// ==============================
// DRIVER DASHBOARD & STATUS ROUTES
// ==============================

// Driver Dashboard
router.get("/dashboard", auth, driverdashboard);

// Update Driver Status
router.put("/status-update", auth, statusUpdate);

// Get Incoming Requests for a Driver
router.get("/incoming/:driverId", auth, incomingrequest);

router.post("/rides/:rideId/accept", auth, tripVal.rideId, throwError, driverTrip.acceptRide)
router.post("/rides/:rideId/decline", auth, tripVal.rideId, throwError, driverTrip.declineRide)
router.post("/rides/:rideId/verify-pickup-otp", auth, tripVal.verifyPickupOtp, throwError, driverTrip.verifyPickupOtp)
router.put("/rides/:rideId/progress", auth, tripVal.progressUpdate, throwError, driverTrip.progressUpdate)
router.post("/rides/:rideId/complete", auth, tripVal.completeTrip, throwError, driverTrip.completeTrip)

router.get("/earnings/summary", auth, earningVal.earningsSummary, throwError, driverEarnings.earningsSummary)
router.post("/earnings/withdraw", auth, earningVal.withdraw, throwError, driverEarnings.withdraw)

module.exports = router;

