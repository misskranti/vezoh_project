const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    vehicle: {
      type: {
        type: String,
        enum: ["bike", "auto", "car", "truck", "van", "other"],
      },
      make: String,
      model: String,
      year: Number,
      color: String,
      plateNumber: String,
      capacity: {
        passengers: Number,
        weight: Number,
      },
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
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
    verificationStatus: {
      type: String,
      enum: ["under_review", "approved", "rejected"],//pending
      default: "approved", //pending
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);