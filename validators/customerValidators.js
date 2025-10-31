const { body, query, param } = require("express-validator")
const { isValidPhone } = require("../utils/helpers.js")
const sendOtpValidator = [
  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required")
    .bail()
    .notEmpty()
    .withMessage("Email is required")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email address")
    .normalizeEmail(),
]

const customerRegisterValidator = [
  body("name")
    .exists({ checkFalsy: true })
    .withMessage("Name is required")
    .bail()
    .notEmpty()
    .withMessage("Name cannot be empty")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters long"),

  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required")
    .bail()
    .notEmpty()
    .withMessage("Email cannot be empty")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail(),

  body("phone")
    .exists({ checkFalsy: true })
    .withMessage("Phone number is required")
    .bail()
    .custom((value) => {
      // Allow +91 or 91 prefix, validate remaining digits(remove spaces)
      const cleaned = value.replace(/\s/g, "");
      if (!isValidPhone(cleaned)) {
        throw new Error("Phone number must be a valid 10-digit Indian number");
      }
      return true;
    }),
];

const customerLoginValidator = [
  body("email")
  .trim()
  .isEmail()
  .withMessage("Valid email required")
  .normalizeEmail(),
];

const customerVerifyOtpValidator = [
  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required")
    .bail()
    .notEmpty()
    .withMessage("Email cannot be empty")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail(),
  body("otp")
    .exists({ checkFalsy: true })
    .withMessage("OTP is required")
    .bail()
    .trim()
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage("Valid OTP required"),
  body("type")
    .exists({ checkFalsy: true })
    .withMessage("Type is required")
    .bail()
    .isIn(["registration", "login"])
    .withMessage("Invalid verification type"),
];

const customerResendOtpValidator = [
  body("email")
    .exists({ checkFalsy: true })
    .withMessage("Email is required")
    .bail()
    .notEmpty()
    .withMessage("Email cannot be empty")
    .trim()
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail(),
  body("type")
    .exists({ checkFalsy: true })
    .withMessage("Type is required")
    .bail()
    .isIn(["registration", "login"])
    .withMessage("Invalid request type"),
];

const nearbyDriversQueryValidator = [
  query("latitude")
    .exists({ checkFalsy: true })
    .withMessage("latitude is required")
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be a valid number between -90 and 90"),
  query("longitude")
    .exists({ checkFalsy: true })
    .withMessage("longitude is required")
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be a valid number between -180 and 180"),
  query("destinationLat")
    .exists({ checkFalsy: true })
    .withMessage("destinationLat is required")
    .isFloat({ min: -90, max: 90 })
    .withMessage("destinationLat must be a valid number between -90 and 90"),
  query("destinationLng")
    .exists({ checkFalsy: true })
    .withMessage("destinationLng is required")
    .isFloat({ min: -180, max: 180 })
    .withMessage("destinationLng must be a valid number between -180 and 180"),
  query("serviceType")
    .exists({ checkFalsy: true })
    .withMessage("serviceType is required")
    .isIn(["ride", "courier", "freight"])
    .withMessage("Invalid serviceType"),
  query("vehicleType").optional().isIn(["bike", "auto", "car", "truck"]).withMessage("Invalid vehicleType"),
  query("radius")
    .optional()
    .isInt({ min: 1000, max: 50000 })
    .withMessage("radius must be between 1000 and 50000 meters"),
]

const requestRideBodyValidator = [
  body("pickup").isObject().withMessage("pickup is required"),
  body("pickup.latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("pickup.latitude must be a valid number between -90 and 90"),
  body("pickup.longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("pickup.longitude must be a valid number between -180 and 180"),
  body("destination").isObject().withMessage("destination is required"),
  body("destination.latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("destination.latitude must be a valid number between -90 and 90"),
  body("destination.longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("destination.longitude must be a valid number between -180 and 180"),
  body("vehicleType")
    .isIn(["bike", "auto", "car", "truck"])
    .withMessage("vehicleType must be one of bike|auto|car|truck"),
  body("serviceType").optional().isIn(["ride", "courier", "freight"]).withMessage("Invalid serviceType"),
  body("paymentMethod").optional().isIn(["cash", "card", "wallet", "UPI"]).withMessage("Invalid paymentMethod"),
  body("offeredFare").optional().isFloat({ gt: 0 }).toFloat().withMessage("offeredFare must be positive"),
  body("rideNotes").optional().isString().trim().isLength({ max: 500 }).withMessage("rideNotes max 500 chars"),
  body("userId").trim().notEmpty().withMessage("userId is required").isMongoId().withMessage("userId must be valid"),
]

const activeRideQueryValidator = [
  query("userId").trim().notEmpty().withMessage("userId is required").isMongoId().withMessage("userId must be valid"),
]

const cancelRideValidator = [
  param("rideId").isMongoId().withMessage("rideId must be valid"),
  body("userId").trim().notEmpty().withMessage("userId is required").isMongoId().withMessage("userId must be valid"),
  body("reason").optional().isString().trim().isLength({ max: 200 }).withMessage("reason max 200 chars"),
]

const completeRideValidator = [
  param("rideId").isMongoId().withMessage("rideId must be valid"),
  body("userId").trim().notEmpty().withMessage("userId is required").isMongoId().withMessage("userId must be valid"),
  body("paymentMethod").optional().isIn(["cash", "card", "wallet", "UPI"]).withMessage("Invalid paymentMethod"),
  body("userRating").optional().isInt({ min: 1, max: 5 }).withMessage("userRating must be 1-5"),
  body("driverRating").optional().isInt({ min: 1, max: 5 }).withMessage("driverRating must be 1-5"),
  body("userComment").optional().isString().trim().isLength({ max: 500 }).withMessage("userComment max 500 chars"),
  body("driverComment").optional().isString().trim().isLength({ max: 500 }).withMessage("driverComment max 500 chars"),
]

module.exports = {
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
};
