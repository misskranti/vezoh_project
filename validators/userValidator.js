const Joi = require("joi");

const addressSchema = Joi.object({
  addressId: Joi.string().optional(),
  label: Joi.string().required(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postalCode: Joi.string().required(),
  coordinates: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }).required(),
});

const userSchema = Joi.object({
  phonenumber: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required(),
  emailaddress: Joi.string().email().optional(),
  fullname: Joi.string().min(2).max(50).required(),
  avatarUrl: Joi.string().uri().optional(),
  role: Joi.string().valid("user", "driver").default("user"),
  addresses: Joi.array().items(addressSchema).optional(),
  password: Joi.string().min(6).max(128).required(),
  preferences: Joi.object({
    notifications: Joi.boolean().default(true),
    preferredPaymentMethod: Joi.string().valid("card", "wallet").optional(),
  }).optional(),
});

module.exports = { userSchema };
