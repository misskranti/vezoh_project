const { body, param } = require("express-validator")

// Auth
const driverRegisterValidator = [
  body("name").trim().isLength({ min: 2 }).withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("phone").trim().isLength({ min: 10 }).withMessage("Valid phone required"),
]

const driverLoginValidator = [body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail()]

const driverVerifyOtpValidator = [
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("otp").trim().isLength({ min: 4, max: 6 }).isNumeric().withMessage("Valid OTP required"),
  body("type").isIn(["registration", "login"]).withMessage("Invalid verification type"),
]

const driverResendOtpValidator = [
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("type").isIn(["registration", "login"]).withMessage("Invalid verification type"),
]

// Services
const addServicesValidator = [
  body("services").custom((value) => {
    if (!Array.isArray(value)) throw new Error("Invalid format of service selection")
    if (!value.length) throw new Error("Please select some services")
    for (const ele of value) {
      if (!["ride", "courier", "freight"].includes(ele)) {
        throw new Error("Invalid value in service selection")
      }
    }
    return true
  }),
]

const serviceParamValidator = [
  param("service")
    .trim()
    .notEmpty()
    .withMessage("service is required")
    .bail()
    .not()
    .isInt()
    .withMessage("Invalid service selection"),
]

module.exports = {
  driverRegisterValidator,
  driverLoginValidator,
  driverVerifyOtpValidator,
  driverResendOtpValidator,
  addServicesValidator,
  serviceParamValidator,
}
