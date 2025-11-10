const express = require("express");
const router = express.Router();

// Middleware
const { auth } = require("../middleware/auth");
const {
  sendOtpValidator,
  customerRegisterValidator,
  customerLoginValidator,
  customerVerifyOtpValidator,
  customerResendOtpValidator,
  nearbyDriversQueryValidator,
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

const {findDriverNearByForCurior, createRideForCurior, acceptedCuriorRideByDriverr, startCurior, cancelCurior, curiorRideCompleted, ratingForCurior} = require("../controllers/curriorController.js");

const {findDriverNearByForFreight, createRideForFreight, acceptedFreightRideByDriverr, startFreight, cancelFreight, freightRideCompleted, ratingForFreight} = require("../controllers/freightController.js");

// ==============================
// AUTHENTICATION ROUTES
// ==============================

// User Registration
router.post("/send-otp", sendOtpValidator, throwError, authController.sendUserEmailOtp);
router.post("/complete_profile", customerRegisterValidator, throwError, authController.completeProfile);

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
router.get("/nearby-drivers",  nearbyDriversQueryValidator, throwError, findDriverNearBy);

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
//router.patch("/startRide", auth, startRide);

// Cancel Ride
router.put("/cancel/:rideId", auth, cancelRideValidator, throwError, cancelRide);

// Complete Ride
router.put("/rideCompleted/:rideId", auth, completeRideValidator, throwError, rideCompleted);

// Rate Ride
router.put("/rating/:rideId", auth, rating);


// ==============================
// CURIOR MANAGEMENT ROUTES
// ==============================

// Find Nearby Drivers for Curior
router.get("/nearby_drivers_for_curior", auth, findDriverNearByForCurior);

// Request a curior Ride
router.post("/create_curior", auth, createRideForCurior);

//Confirm curior Ride 
router.patch("/currior_ride_accepted/:rideId", auth, acceptedCuriorRideByDriverr)

//start curier Ride
router.patch("/start_currior", auth, startCurior);

// Cancel curier pickup
router.put("/cancel_curior_pickup/:rideId", auth, cancelCurior);

// Complete curior Ride(curior delevered)
router.put("/curior_delivered/:rideId", auth, curiorRideCompleted);

// Rate curior Ride
router.put("/curior_rating/:rideId", auth, ratingForCurior);


// ==============================
// FREIGHT MANAGEMENT ROUTES
// ==============================

// Find Nearby Drivers for Freight
router.get("/nearby_drivers_for_freight", auth, findDriverNearByForFreight);    

// Request a Freight Ride
router.post("/create_freight", auth, createRideForFreight); 

//Confirm Freight Ride
router.patch("/freight_ride_accepted/:rideId", auth, acceptedFreightRideByDriverr);

//start Freight Ride
router.patch("/start_freight", auth, startFreight);

// Cancel Freight pickup
router.put("/cancel_freight_pickup/:rideId", auth, cancelFreight);

// Complete Freight Ride(freight delevered)
router.put("/freight_completed/:rideId", auth, freightRideCompleted);

// Rate Freight Ride     
router.put("/freight_rating/:rideId", auth, ratingForFreight);



module.exports = router;