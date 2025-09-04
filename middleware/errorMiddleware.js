const { validationResult } = require("express-validator");

exports.throwError = (req, res, next) => {
  const errors = validationResult(req);
  console.log(errors)
  const response = {};
  if (errors.array().length) {
    response["success"] = false;
    response["message"] = errors.array()[0].msg;
    return res.status(400).json(response);
  }
  next();
};
