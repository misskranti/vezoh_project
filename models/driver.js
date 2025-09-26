const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
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
    otpExpiry: { type: Date, default: null },

    loginVerificationCode: { type: String, default: null },
    loginOtpExpiry: { type: Date, default: null },
    loginOtpVerified: { type: Boolean, default: false },

    services: [
      {
        type: String,
        enum: ["ride", "courier", "freight"],
      },
    ],
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        default: [0, 0],
      },
      address: String,
      lastUpdated: { type: Date, default: Date.now },
    },

    status: {
      type: String,
      enum: ["online", "offline", "busy", "inactive"],
      default: "offline",
    },
    availability: {
      isAvailable: { type: Boolean, default: true },
      workingHours: {
        start: String,
        end: String,
      },
    },

    earnings: {
      today: { type: Number, default: 0 },
      thisWeek: { type: Number, default: 0 },
      thisMonth: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      availableToWithdraw: { type: Number, default: 0 },
    },

    stats: {
      totalTrips: { type: Number, default: 0 },
      completedTrips: { type: Number, default: 0 },
      cancelledTrips: { type: Number, default: 0 },
      totalDistance: { type: Number, default: 0 },
      totalTime: { type: Number, default: 0 },
    },

    rating: {
      average: { type: Number, default: 5.0 },
      count: { type: Number, default: 0 },
    },

    bankDetails: {
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      bankName: String,
    },
  },
  {
    timestamps: true,
  }
);

driverSchema.index({ location: "2dsphere" });
driverSchema.index({ status: 1 });
driverSchema.index({ services: 1 });

module.exports =
  mongoose.models.Driver || mongoose.model("Driver", driverSchema);
