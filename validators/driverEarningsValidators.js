const { body, query } = require("express-validator")

exports.earningsSummary = [
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt().withMessage("limit must be between 1 and 50"),
]

exports.withdraw = [
  body("amount")
    .exists({ checkFalsy: true })
    .withMessage("amount is required")
    .isFloat({ gt: 0 })
    .withMessage("amount must be greater than 0")
    .toFloat()
    .custom((value) => {
      if (value > 999999) {
        throw new Error("Withdrawal amount cannot exceed 999999")
      }
      return true
    }),
]
