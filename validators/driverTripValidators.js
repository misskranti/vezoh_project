const { param, body } = require("express-validator")

const mongoId = param("rideId").isMongoId().withMessage("rideId must be a valid Mongo ID")

exports.rideId = [mongoId]

exports.verifyPickupOtp = [
  mongoId,
  body("otp")
    .trim()
    .isLength({ min: 4, max: 6 })
    .withMessage("otp must be 4-6 digits")
    .matches(/^[0-9]+$/)
    .withMessage("otp must be numeric"),
]

exports.completeTrip = [
  mongoId,
  body("paymentMethod")
    .optional()
    .isIn(["cash", "card", "wallet", "UPI"])
    .withMessage("paymentMethod must be one of cash|card|wallet|UPI"),
  body("finalFare").optional().toFloat().isFloat({ min: 0 }).withMessage("finalFare must be a positive number"),
]

exports.progressUpdate = [
  mongoId,
  body("progressPercent")
    .exists()
    .toFloat()
    .isFloat({ min: 0, max: 100 })
    .withMessage("progressPercent 0-100 required"),
  body("remainingMin").optional().toFloat().isFloat({ min: 0 }).withMessage("remainingMin must be >= 0"),
  body("distanceKm").optional().toFloat().isFloat({ min: 0 }).withMessage("distanceKm must be >= 0"),
]
