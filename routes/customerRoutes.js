const express = require("express");
const router = express.Router();

// Middleware
const { auth } = require("../middleware/auth");
const { body } = require("express-validator");

// Controllers
const authController = require("../controllers/customerAuthController.js");
const profileController = require("../controllers/profileController.js");
const { getRideHistory } = require("../controllers/rideController.js");
const {
  cancelRide,
  activeRide,
  // confirmRide,
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
router.post("/register",authController.registerUser);

// Email Verification
router.post("/verify-email-otp", authController.verifyUserEmailOtp);
router.post("/resend-email-otp", authController.resendUserEmailOtp);

// User Login
router.post("/login", authController.loginUser);

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
router.get("/nearby-drivers", auth, findDriverNearBy);

 // ==============================
 // RIDE MANAGEMENT ROUTES
 // ==============================

// Request a Ride
router.post("/request", auth, createRide);

// Get Active Ride
router.get("/active", auth, activeRide);

//Confirm Ride 
router.patch("/rideAccespted/:rideId", auth, acceptedRideByDriver)

//start Ride
router.patch("/startRide", auth, startRide);

// Cancel Ride
router.put("/cancel/:rideId", auth, cancelRide);

// Complete Ride
router.put("/rideCompleted/:rideId", auth, rideCompleted);

// Rate Ride
router.put("/rating/:rideId", auth, rating);

module.exports = router;