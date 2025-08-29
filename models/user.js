const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      default: null,
    },
    addresses: [
      {
        type: {
          type: String,
          enum: ["home", "work", "other"],
          default: "other",
        },
        address: String,
        coordinates: {
          latitude: Number,
          longitude: Number,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    paymentMethods: [
      {
        type: {
          type: String,
          enum: ["card", "wallet", "cash"],
          default: "cash",
        },
        details: mongoose.Schema.Types.Mixed,
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    preferences: {
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
      },
    },
    rating: {
      average: { type: Number, default: 5.0 },
      count: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
)

userSchema.index({ "addresses.coordinates": "2dsphere" })

module.exports = mongoose.model("User", userSchema)
