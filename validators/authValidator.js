const Joi = require("joi");

const passwordComplexity = Joi.string()
  .min(8)
  .max(30)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
  .message(
    "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character"
  );

const registerSchema = Joi.object({
  phonenumber: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be between 10-15 digits",
      "any.required": "Phone number is required",
    }),
  fullname: Joi.string().min(2).max(50).required().messages({
    "string.min": "fullname must be at least 2 characters",
    "string.max": "fullname cannot exceed 50 characters",
    "any.required": "fullname is required",
  }),
  emailaddress: Joi.string().email().optional().messages({
    "string.email": "Invalid email format",
  }),
  password: passwordComplexity.required(),
  role: Joi.string().valid("user", "admin").optional().messages({
    "any.only": "role must be either 'user' or 'admin'",
  }),
});

const loginSchema = Joi.object({
  phonenumber: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be between 10-15 digits",
      "any.required": "Phone number is required",
    }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

module.exports = { registerSchema, loginSchema };
