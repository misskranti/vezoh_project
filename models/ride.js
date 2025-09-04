
const mongoose = require("mongoose")

const rideSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },
    pickup: {
      address: { type: String, required: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
    },
    destination: {
      address: { type: String, required: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
    },
    serviceType: {
      type: String,
      enum: ["ride", "delivery", "freight"],
      default: "ride",
    },
    vehicleType: {
      type: String,
      enum: ["bike", "auto", "car", "truck"],
      required: true,
    },
    fare: {
      estimated: Number,
      offered: Number,
      final: Number,
    },
    distance: {
      estimated: Number, // in km
      actual: Number,
    },
    duration: {
      estimated: Number, // in minutes
      actual: Number,
    },
    status: {
      type: String,
      enum: ["requested", "accepted", "driver_assigned", "pickup", "in_progress", "completed", "cancelled"],
      default: "requested",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "wallet"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    rating: {
      userRating: Number,
      driverRating: Number,
      userComment: String,
      driverComment: String,
    },
    timeline: {
      requested: { type: Date, default: Date.now },
      accepted: Date,
      driverAssigned: Date,
      pickup: Date,
      started: Date,
      completed: Date,
      cancelled: Date,
    },
  },
  {
    timestamps: true,
  },
)

rideSchema.index({ user: 1 })
rideSchema.index({ driver: 1 })
rideSchema.index({ status: 1 })
rideSchema.index({ "pickup.coordinates": "2dsphere" })
rideSchema.index({ "destination.coordinates": "2dsphere" })

module.exports = mongoose.model("Ride", rideSchema)