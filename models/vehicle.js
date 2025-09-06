const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ["Car", "Bike", "Auto Rickshaw", "Van", "Other"], // optional enum
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    documents: {
      drivingLicense: { type: String },
      rcCertificate: { type: String },
      vehicleInsurance: { type: String },
    },
    status: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
