const express = require("express");
const router = express.Router();

// Middleware
const { auth } = require("../middleware/auth");
const {
  customerRegisterValidator,
  customerLoginValidator,
  customerVerifyOtpValidator,
  customerResendOtpValidator,
  estimateFareQueryValidator: nearbyDriversQueryValidator,
  requestRideBodyValidator,
  activeRideQueryValidator,
  cancelRideValidator,
  completeRideValidator,
} = require("../validators/customerValidators.js");
const { throwError } = require("../middleware/errorMiddleware.js");

// Controllers
const authController = require("../controllers/customerAuthController.js");
const profileController = require("../controllers/profileController.js");
const { getRideHistory } = require("../controllers/rideController.js");
const {
  cancelRide,
  activeRide,
  acceptedRideByDriver,
  startRide,
  createRide,
  findDriverNearBy,
  rideCompleted,
  rating,
} = require("../controllers/rideController.js");
const {
  suggetionOnLocation,
  geoDecode,
  estimateFare,
} = require("../controllers/mapController.js");

// ==============================
// AUTHENTICATION ROUTES
// ==============================

// User Registration
router.post("/register", customerRegisterValidator, throwError, authController.registerUser);

// Email Verification
router.post("/verify-email-otp", customerVerifyOtpValidator, throwError, authController.verifyUserEmailOtp);
router.post("/resend-email-otp", customerResendOtpValidator, throwError, authController.resendUserEmailOtp);

// User Login
router.post("/login", customerLoginValidator, throwError, authController.loginUser);

// User Profile
router.get("/profile", auth, profileController.getProfile);

// User Logout
router.post("/logout", auth, profileController.logout);


// ==============================
// DASHBOARD / HISTORY ROUTES
// ==============================

// Get Ride History
router.get("/ride/history", auth, getRideHistory);

// ==============================
// LOCATION / MAP ROUTES
// ==============================

// Location Autocomplete (Auto-suggestion for locations)
router.get("/autocomplete", auth, suggetionOnLocation);

// Geocode API (Get details for a selected location)
router.get("/geocode", auth, geoDecode);

// Estimate Fare
router.post("/estimate-fare", auth, estimateFare);

// Find Nearby Drivers
router.get("/nearby-drivers", auth, nearbyDriversQueryValidator, throwError, findDriverNearBy);

// ==============================
// RIDE MANAGEMENT ROUTES
// ==============================

// Request a Ride
router.post("/request", auth, requestRideBodyValidator, throwError, createRide);

// Get Active Ride
router.get("/active", auth, activeRideQueryValidator, throwError, activeRide);
//Confirm Ride 
router.patch("/rideAccespted/:rideId", auth, acceptedRideByDriver)

//start Ride
router.patch("/startRide", auth, startRide);

// Cancel Ride
router.put("/cancel/:rideId", auth, cancelRideValidator, throwError, cancelRide);

// Complete Ride
router.put("/rideCompleted/:rideId", auth, completeRideValidator, throwError, rideCompleted);

// Rate Ride
router.put("/rating/:rideId", auth, completeRideValidator, throwError, rating);

module.exports = router;