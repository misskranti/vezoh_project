const { validationResult } = require("express-validator");

exports.throwError = (req, res, next) => {
  const errors = validationResult(req);
  const response = {};
  if (!errors.isEmpty()) {
    response["success"] = false;
    response["message"] = errors.array()[0].msg;
    return res.status(400).json(response);
  }
  next();
};