const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    licenseNumber: { type: String, required: true },
    vehicleNumber: { type: String },
    vehicleType: { type: String },
    role: { type: String, default: "driver" },
}, { timestamps: true });

module.exports = mongoose.model("Driver", driverSchema);
