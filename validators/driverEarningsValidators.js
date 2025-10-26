const { body, query } = require("express-validator")

exports.earningsSummary = [query("limit").optional().isInt({ min: 1, max: 50 }).toInt()]

exports.withdraw = [
  body("amount")
    .exists()
    .withMessage("amount is required")
    .isFloat({ gt: 0 })
    .withMessage("amount must be greater than 0")
    .toFloat(),
]
