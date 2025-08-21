const mongoose = require("mongoose")
  
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
    password: {
      type: String,
      required: true,
      minlength: 6,
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
    documents: {
      drivingLicense: {
        number: String,
        frontImage: String,
        backImage: String,
        expiryDate: Date,
        isVerified: { type: Boolean, default: false },
      },
      vehicleRegistration: {
        number: String,
        image: String,
        expiryDate: Date,
        isVerified: { type: Boolean, default: false },
      },
      insurance: {
        number: String,
        image: String,
        expiryDate: Date,
        isVerified: { type: Boolean, default: false },
      },
      aadhar: {
        number: String,
        frontImage: String,
        backImage: String,
        isVerified: { type: Boolean, default: false },
      },
    },
    vehicle: {
      type: {
        type: String,
        enum: ["bike", "auto", "car", "truck"],
      },
      make: String,
      model: String,
      year: Number,
      color: String,
      plateNumber: String,
      capacity: {
        passengers: Number,
        weight: Number, // in kg
      },
    },
    services: [
      {
        type: String,
        enum: ["ride", "delivery", "freight"],
      },
    ],
    location: {
      coordinates: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
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
        start: String, // "09:00"
        end: String, // "22:00"
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
      totalDistance: { type: Number, default: 0 }, // in km
      totalTime: { type: Number, default: 0 }, // in minutes
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
    verificationStatus: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
)

driverSchema.index({ "location.coordinates": "2dsphere" })
driverSchema.index({ status: 1 })
driverSchema.index({ services: 1 })

module.exports = mongoose.models.Driver || mongoose.model("Driver", driverSchema)
