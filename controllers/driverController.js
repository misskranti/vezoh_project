const Driver = require("../models/driver.js");
const Vehicle = require("../models/vehicle.js");

//-------------------------- Driver Opt Services -----------------------------------------//
exports.driverOptServices = async (req, res) => {
  try {
    const { services } = req.body;
    const driverId = req.user._id;

    const updatedDriver = await Driver.findByIdAndUpdate(
      driverId,
      { $set: { services: services } },
      { new: true, runValidators: true }
    ).select("_id name email phone services");

    if (!updatedDriver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Driver services registered successfully",
    });
  } catch (err) {
    console.error("Error registering driver services:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while registering driver services",
    });
  }
};

// ----------------------- Driver Vehicle Registration (Need to be Update Kaya)----------------------//
exports.vehicleRegistration = async (req, res) => {
  try {
    const { driverId, vehicleType, vehicleNumber, ownerName } = req.body;

    if (!driverId || !vehicleType || !vehicleNumber || !ownerName) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide driverId, vehicle type, vehicle number, and owner name",
      });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    if (!driver.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify OTP before submitting vehicle details",
      });
    }

    const existingVehicle = await Driver.findOne({
      "vehicle.number": vehicleNumber.toUpperCase(),
    });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: "Vehicle with this number is already registered",
      });
    }

    const requiredFiles = [
      "drivingLicense",
      "rcCertificate",
      "vehicleInsurance",
    ];
    const missingFiles = requiredFiles.filter(
      (field) => !req.files?.[field]
    );
    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload all required documents",
        missingFiles,
      });
    }

    driver.vehicle = {
      type: vehicleType.toLowerCase(),
      number: vehicleNumber.toUpperCase(),
      ownerName: ownerName.trim(),
    };

    driver.documents = {
      drivingLicense: {
        image: req.files.drivingLicense[0].path,
        isVerified: false,
      },
      rcCertificate: {
        image: req.files.rcCertificate[0].path,
        isVerified: false,
      },
      vehicleInsurance: {
        image: req.files.vehicleInsurance[0].path,
        isVerified: false,
      },
    };

    driver.registrationStep = "vehicle-submitted";
    driver.verificationStatus = "pending";

    await driver.save();

    res.status(200).json({
      success: true,
      message: "Vehicle details submitted successfully",
      data: {
        id: driver._id.toString(),
        vehicle: driver.vehicle,
      },
    });
  } catch (error) {
    console.error("Vehicle registration error:", error);
    res.status(500).json({
      success: false,
      message: "Vehicle registration failed. Please try again.",
    });
  }
};