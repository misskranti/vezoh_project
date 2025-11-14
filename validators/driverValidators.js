const { body, param } = require("express-validator")
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

// Auth
const driverRegisterValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be 2-50 characters"),
  body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone is required")
    .custom((value) => {
      const cleaned = value.replace(/\s/g, "")
      if (!isValidPhone(cleaned)) {
        throw new Error("Phone number must be a valid 10-digit Indian number")
      }
      return true
    }),
]

const driverLoginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail(),
]

const driverVerifyOtpValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail(),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage("Valid OTP required"),
  body("type")
    .notEmpty()
    .withMessage("Type is required")
    .isIn(["registration", "login"])
    .withMessage("Invalid verification type"),
]

const driverResendOtpValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email required")
    .normalizeEmail(),
  body("type")
    .notEmpty()
    .withMessage("Type is required")
    .isIn(["registration", "login"])
    .withMessage("Invalid verification type"),
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
    .isIn(["ride", "courier", "freight"])
    .withMessage("Invalid service selection"),
]

module.exports = {
  sendOtpValidator,
  driverRegisterValidator,
  driverLoginValidator,
  driverVerifyOtpValidator,
  driverResendOtpValidator,
  addServicesValidator,
  serviceParamValidator,
}
