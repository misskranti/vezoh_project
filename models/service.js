const mongoose = require("mongoose")

const serviceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      required: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePerKm: {
      type: Number,
      required: true,
      min: 0,
    },
    vehicleTypes: [
      {
        type: String,
        required: true,
      },
    ],
    features: [
      {
        type: String,
        required: true,
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    estimatedTime: {
      type: String,
      default: "5-10 mins",
    },
    availability: {
      startTime: {
        type: String,
        default: "00:00",
      },
      endTime: {
        type: String,
        default: "23:59",
      },
      days: [
        {
          type: String,
          enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          default: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        },
      ],
    },
    maxDistance: {
      type: Number,
      default: 50, // in kilometers
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

serviceSchema.index({ active: 1 })
serviceSchema.index({ sortOrder: 1 })

module.exports = mongoose.model("Service", serviceSchema)
