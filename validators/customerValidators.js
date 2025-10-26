const { body, query, param } = require("express-validator")

// Auth
const customerRegisterValidator = [
  body("name").trim().isLength({ min: 2 }).withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("phone").trim().isLength({ min: 10 }).withMessage("Valid phone required"),
]

const customerLoginValidator = [body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail()]

const customerVerifyOtpValidator = [
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("otp").trim().isLength({ min: 4, max: 6 }).isNumeric().withMessage("Valid OTP required"),
  body("type").isIn(["registration", "login"]).withMessage("Invalid verification type"),
]

const customerResendOtpValidator = [
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("type").isIn(["registration", "login"]).withMessage("Invalid verification type"),
]

// Maps and rides
const estimateFareQueryValidator = [
  query("latitude").isFloat().withMessage("latitude must be a number"),
  query("longitude").isFloat().withMessage("longitude must be a number"),
  query("destinationLat").isFloat().withMessage("destinationLat must be a number"),
  query("destinationLng").isFloat().withMessage("destinationLng must be a number"),
  query("serviceType").optional().isIn(["ride", "courier", "freight"]).withMessage("Invalid serviceType"),
]

const requestRideBodyValidator = [
  body("pickup").isObject().withMessage("pickup is required"),
  body("pickup.latitude").isFloat().withMessage("pickup.latitude must be a number"),
  body("pickup.longitude").isFloat().withMessage("pickup.longitude must be a number"),
  body("destination").isObject().withMessage("destination is required"),
  body("destination.latitude").isFloat().withMessage("destination.latitude must be a number"),
  body("destination.longitude").isFloat().withMessage("destination.longitude must be a number"),
  body("vehicleType")
    .isIn(["bike", "auto", "car", "truck"])
    .withMessage("vehicleType must be one of bike|auto|car|truck"),
  body("serviceType").optional().isIn(["ride", "courier", "freight"]).withMessage("Invalid serviceType"),
  body("paymentMethod").optional().isIn(["cash", "card", "wallet", "UPI"]).withMessage("Invalid paymentMethod"),
  body("offeredFare").optional().isFloat({ gt: 0 }).toFloat(),
  body("rideNotes").optional().isString().trim().isLength({ max: 500 }),
  body("userId").trim().notEmpty().withMessage("userId is required"),
]

const activeRideQueryValidator = [query("userId").trim().notEmpty().withMessage("userId is required")]

const cancelRideValidator = [
  param("rideId").trim().notEmpty().withMessage("rideId is required"),
  body("userId").trim().notEmpty().withMessage("userId is required"),
]

const completeRideValidator = [
  param("rideId").isString().notEmpty().withMessage("rideId is required"),
  body("userId").trim().notEmpty().withMessage("userId is required"),
  body("paymentMethod").optional().isIn(["cash", "card", "wallet", "UPI"]).withMessage("Invalid paymentMethod"),
  body("userRating").optional().isInt({ min: 1, max: 5 }).withMessage("userRating must be 1-5"),
  body("driverRating").optional().isInt({ min: 1, max: 5 }).withMessage("driverRating must be 1-5"),
]

module.exports = {
  customerRegisterValidator,
  customerLoginValidator,
  customerVerifyOtpValidator,
  customerResendOtpValidator,
  estimateFareQueryValidator,
  requestRideBodyValidator,
  activeRideQueryValidator,
  cancelRideValidator,
  completeRideValidator,
}
